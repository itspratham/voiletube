# views.from rest_framework import generics, status, permissions
from rest_framework import generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import F
from .models import Comment, CommentLike
from .serializers import CommentSerializer
from ..videos.models import Video


class CommentListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        video_id = self.kwargs['video_id']
        queryset = Comment.objects.filter(
            video_id=video_id, parent=None
        ).select_related('author')
        if self.request.query_params.get('sort') == 'new':
            return queryset.order_by('-created_at')
        return queryset.order_by('-is_pinned', '-likes_count', '-created_at')

    def perform_create(self, serializer):
        video = get_object_or_404(Video, id=self.kwargs['video_id'])
        comment = serializer.save(author=self.request.user, video=video)
        Video.objects.filter(pk=video.pk).update(comments_count=F('comments_count') + 1)
        return comment


class ReplyListView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        return Comment.objects.filter(
            parent_id=self.kwargs['comment_id']
        ).select_related('author').order_by('created_at')

    def perform_create(self, serializer):
        parent = get_object_or_404(Comment, id=self.kwargs['comment_id'])
        serializer.save(author=self.request.user, video=parent.video, parent=parent)


class CommentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    lookup_field = 'id'

    def perform_destroy(self, instance):
        if instance.author != self.request.user and not self.request.user.is_staff:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        if instance.parent_id is None:
            Video.objects.filter(pk=instance.video_id).update(comments_count=F('comments_count') - 1)
        instance.delete()


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def like_comment(request, comment_id):
    comment = get_object_or_404(Comment, id=comment_id)
    like, created = CommentLike.objects.get_or_create(user=request.user, comment=comment)
    if not created:
        like.delete()
        Comment.objects.filter(pk=comment.pk).update(likes_count=F('likes_count') - 1)
        return Response({'liked': False})
    Comment.objects.filter(pk=comment.pk).update(likes_count=F('likes_count') + 1)
    return Response({'liked': True})
