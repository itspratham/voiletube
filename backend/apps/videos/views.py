from rest_framework import generics, status, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q, F, Count
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.http import Http404, HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.contrib.postgres.search import SearchVector, SearchQuery, SearchRank
from .models import Video, Category, VideoLike, VideoView, WatchLater, Playlist, PlaylistVideo
from .serializers import (
    VideoListSerializer, VideoDetailSerializer, VideoUploadSerializer,
    CategorySerializer, PlaylistSerializer
)
from .tasks import process_video
import logging
import mimetypes
import os
import re

logger = logging.getLogger(__name__)


RANGE_RE = re.compile(r'bytes=(\d*)-(\d*)')


def _can_watch_video(request, video):
    if video.status in ['published', 'unlisted']:
        return True
    return request.user.is_authenticated and request.user == video.uploader


def _file_iterator(file_path, start, length, chunk_size=8192):
    with open(file_path, 'rb') as video_file:
        video_file.seek(start)
        remaining = length
        while remaining > 0:
            chunk = video_file.read(min(chunk_size, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


class VideoListView(generics.ListAPIView):
    serializer_class = VideoListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'tags__name']
    ordering_fields = ['created_at', 'views_count', 'likes_count']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Video.objects.filter(status='published').select_related('uploader')
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category__slug__iexact=category)
        return queryset


class VideoUploadView(generics.CreateAPIView):
    serializer_class = VideoUploadSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        video = serializer.save()
        # Prefer background processing, but do not leave uploads stuck when the
        # local worker/broker is unavailable in development.
        try:
            process_video.delay(str(video.id))
        except Exception as e:
            logger.warning(f'Could not queue video processing: {e}')
            process_video.apply(args=[str(video.id)])


class VideoDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Video.objects.select_related('uploader', 'category').prefetch_related('tags')
    lookup_field = 'id'

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return VideoUploadSerializer
        return VideoDetailSerializer

    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def retrieve(self, request, *args, **kwargs):
        video = self.get_object()
        if video.status not in ['published', 'unlisted']:
            if not request.user.is_authenticated or request.user != video.uploader:
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Record view with spam resistance
        from django.core.cache import cache
        ip_address = self.get_client_ip()
        user_id = request.user.id if request.user.is_authenticated else 'anon'
        cache_key = f"view:{video.pk}:{ip_address}:{user_id}"
        
        if not cache.get(cache_key):
            Video.objects.filter(pk=video.pk).update(views_count=F('views_count') + 1)
            VideoView.objects.create(
                video=video,
                user=request.user if request.user.is_authenticated else None,
                ip_address=ip_address,
            )
            # Set cache to expire in 15 minutes (900 seconds)
            cache.set(cache_key, True, 900)
            video.refresh_from_db()

        serializer = self.get_serializer(video)
        return Response(serializer.data)

    def get_client_ip(self):
        forwarded_for = self.request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        return self.request.META.get('REMOTE_ADDR')

    def perform_destroy(self, instance):
        if instance.uploader != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        instance.delete()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def like_video(request, video_id):
    video = get_object_or_404(Video, id=video_id)
    action = request.data.get('action')  # 'like' or 'dislike'

    if action not in ['like', 'dislike']:
        return Response({'error': 'Invalid action'}, status=400)

    with transaction.atomic():
        existing = VideoLike.objects.select_for_update().filter(user=request.user, video=video).first()

        if existing:
            if existing.action == action:
                existing.delete()
                current_action = None
            else:
                existing.action = action
                existing.save(update_fields=['action'])
                current_action = action
        else:
            VideoLike.objects.create(user=request.user, video=video, action=action)
            current_action = action

        counts = VideoLike.objects.filter(video=video).values('action').annotate(total=Count('id'))
        like_counts = {row['action']: row['total'] for row in counts}
        likes = like_counts.get(VideoLike.LIKE, 0)
        dislikes = like_counts.get(VideoLike.DISLIKE, 0)
        Video.objects.filter(pk=video.pk).update(likes_count=likes, dislikes_count=dislikes)

    return Response({'action': current_action, 'likes': likes, 'dislikes': dislikes})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def stream_video(request, video_id):
    video = get_object_or_404(Video, id=video_id)
    if not _can_watch_video(request, video):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not video.video_file:
        raise Http404('Video file not found')

    if settings.USE_S3:
        return Response({'detail': 'Streaming endpoint is only used for local media.'}, status=status.HTTP_404_NOT_FOUND)

    file_path = video.video_file.path
    if not os.path.exists(file_path):
        raise Http404('Video file not found')

    file_size = os.path.getsize(file_path)
    content_type = mimetypes.guess_type(file_path)[0] or 'video/mp4'
    range_header = request.META.get('HTTP_RANGE', '').strip()
    range_match = RANGE_RE.match(range_header)

    if range_match:
        first_byte, last_byte = range_match.groups()
        if first_byte == '' and last_byte == '':
            return HttpResponse(status=416)

        if first_byte == '':
            suffix_length = int(last_byte)
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        else:
            start = int(first_byte)
            end = int(last_byte) if last_byte else file_size - 1

        if start >= file_size or end < start:
            response = HttpResponse(status=416)
            response['Content-Range'] = f'bytes */{file_size}'
            response['Accept-Ranges'] = 'bytes'
            return response

        end = min(end, file_size - 1)
        length = end - start + 1
        response = StreamingHttpResponse(
            _file_iterator(file_path, start, length),
            status=206,
            content_type=content_type,
        )
        response['Content-Length'] = str(length)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    else:
        response = StreamingHttpResponse(
            _file_iterator(file_path, 0, file_size),
            status=200,
            content_type=content_type,
        )
        response['Content-Length'] = str(file_size)

    response['Accept-Ranges'] = 'bytes'
    response['Content-Disposition'] = 'inline'
    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def feed(request):
    """Subscriptions feed"""
    subscribed_channels = request.user.subscriptions.values_list('channel_id', flat=True)
    videos = Video.objects.filter(
        uploader__in=subscribed_channels,
        status='published'
    ).select_related('uploader').order_by('-published_at')
    
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 20
    paginated_videos = paginator.paginate_queryset(videos, request)
    serializer = VideoListSerializer(paginated_videos, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def watch_history(request):
    views = VideoView.objects.filter(user=request.user).select_related('video__uploader').order_by('-created_at')[:50]
    videos = []
    seen_video_ids = set()
    for view in views:
        if view.video.status != 'published' or view.video_id in seen_video_ids:
            continue
        seen_video_ids.add(view.video_id)
        videos.append(view.video)
    serializer = VideoListSerializer(videos, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def liked_videos(request):
    likes = VideoLike.objects.filter(
        user=request.user,
        action=VideoLike.LIKE,
        video__status='published',
    ).select_related('video__uploader').order_by('-created_at')[:50]

    videos = []
    seen_video_ids = set()
    for like in likes:
        if like.video_id in seen_video_ids:
            continue
        seen_video_ids.add(like.video_id)
        videos.append(like.video)

    serializer = VideoListSerializer(videos, many=True, context={'request': request})
    return Response(serializer.data)


class WatchLaterView(generics.ListCreateDestroyAPIView if False else generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VideoListSerializer

    def get_queryset(self):
        return Video.objects.filter(
            watchlater__user=self.request.user
        ).select_related('uploader').order_by('-watchlater__added_at')


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def watch_later(request, video_id):
    video = get_object_or_404(Video, id=video_id)
    if request.method == 'POST':
        WatchLater.objects.get_or_create(user=request.user, video=video)
        return Response({'added': True})
    else:
        WatchLater.objects.filter(user=request.user, video=video).delete()
        return Response({'removed': True})


class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.AllowAny]


class UserVideosView(generics.ListAPIView):
    serializer_class = VideoListSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        username = self.kwargs['username']
        qs = Video.objects.filter(uploader__username=username).select_related('uploader')
        if not self.request.user.is_authenticated or self.request.user.username != username:
            qs = qs.filter(status='published')
        return qs.order_by('-created_at')


class PlaylistListView(generics.ListCreateAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        username = self.kwargs.get('username')
        if username:
            return Playlist.objects.filter(owner__username=username, is_public=True)
        return Playlist.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def playlist_video(request, playlist_id, video_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.user)
    video = get_object_or_404(Video, id=video_id)

    if request.method == 'POST':
        next_position = playlist.playlistvideo_set.count()
        PlaylistVideo.objects.get_or_create(
            playlist=playlist,
            video=video,
            defaults={'position': next_position},
        )
        return Response({'saved': True})

    PlaylistVideo.objects.filter(playlist=playlist, video=video).delete()
    return Response({'removed': True})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def trending(request):
    videos = Video.objects.filter(status='published').order_by('-views_count', '-likes_count')
    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 20
    paginated_videos = paginator.paginate_queryset(videos, request)
    serializer = VideoListSerializer(paginated_videos, many=True, context={'request': request})
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def search(request):
    query = request.query_params.get('q', '').strip()
    sort = request.query_params.get('sort', 'relevance')
    category = request.query_params.get('category', '')

    videos = Video.objects.filter(status='published').select_related('uploader')

    if query:
        search_query = SearchQuery(query)
        videos = videos.annotate(
            rank=SearchRank('search_vector', search_query)
        ).filter(search_vector=search_query, rank__gte=0.05).distinct()

        if sort == 'relevance':
            videos = videos.order_by('-rank')

    if category:
        videos = videos.filter(category__slug__iexact=category)

    if sort == 'views':
        videos = videos.order_by('-views_count')
    elif sort == 'recent':
        videos = videos.order_by('-created_at')
    elif sort == 'likes':
        videos = videos.order_by('-likes_count')

    from rest_framework.pagination import PageNumberPagination
    paginator = PageNumberPagination()
    paginator.page_size = 20
    paginated_videos = paginator.paginate_queryset(videos, request)
    serializer = VideoListSerializer(paginated_videos, many=True, context={'request': request})
    
    response = paginator.get_paginated_response(serializer.data)
    
    if query and request.query_params.get('page', 1) in [1, '1']:
        from django.db.models import Q
        from ..users.models import User
        from ..users.serializers import UserSerializer
        
        channels = User.objects.filter(
            Q(username__icontains=query) | Q(channel_name__icontains=query)
        )[:5]
        
        response.data['channels'] = UserSerializer(channels, many=True, context={'request': request}).data

    return response


class PlaylistDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        from django.db.models import Q
        if self.request.method in permissions.SAFE_METHODS:
            user = self.request.user if self.request.user.is_authenticated else None
            if user:
                return Playlist.objects.filter(Q(is_public=True) | Q(owner=user))
            return Playlist.objects.filter(is_public=True)
        return Playlist.objects.filter(owner=self.request.user if self.request.user.is_authenticated else None)


@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def playlist_video_reorder(request, playlist_id, video_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.user)
    video = get_object_or_404(Video, id=video_id)
    new_position = request.data.get('position')
    
    if new_position is None:
        return Response({'error': 'position is required'}, status=400)
    
    try:
        pv = PlaylistVideo.objects.get(playlist=playlist, video=video)
        old_position = pv.position
        new_position = int(new_position)
        
        other_pv = PlaylistVideo.objects.filter(playlist=playlist, position=new_position).first()
        if other_pv:
            other_pv.position = old_position
            other_pv.save()
            
        pv.position = new_position
        pv.save()
    except PlaylistVideo.DoesNotExist:
        return Response({'error': 'Video not in playlist'}, status=404)
        
    return Response({'reordered': True})
