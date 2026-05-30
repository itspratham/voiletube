from rest_framework import serializers
from django.utils import timezone
from .models import Video, Category, Tag, VideoLike, Playlist, PlaylistVideo
from .media_utils import probe_video_metadata
from ..users.serializers import UserSerializer


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'icon']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name']


class VideoListSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    thumbnail_url = serializers.ReadOnlyField()
    duration_formatted = serializers.ReadOnlyField()
    user_like_status = serializers.SerializerMethodField()
    stream_url = serializers.SerializerMethodField()
    available_qualities = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'title', 'thumbnail_url', 'duration', 'duration_formatted',
            'views_count', 'likes_count', 'created_at', 'uploader', 'status',
            'user_like_status', 'video_file', 'url_360p', 'url_480p',
            'url_720p', 'url_1080p', 'hls_url', 'stream_url',
            'available_qualities'
        ]

    def get_user_like_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            like = obj.likes.filter(user=request.user).first()
            return like.action if like else None
        return None

    def get_stream_url(self, obj):
        request = self.context.get('request')
        if not request or not obj.video_file:
            return None
        return request.build_absolute_uri(f'/api/videos/{obj.id}/stream/')

    def get_available_qualities(self, obj):
        return get_video_quality_options(obj, self.context.get('request'))


class VideoDetailSerializer(serializers.ModelSerializer):
    uploader = UserSerializer(read_only=True)
    thumbnail_url = serializers.ReadOnlyField()
    duration_formatted = serializers.ReadOnlyField()
    category = CategorySerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    user_like_status = serializers.SerializerMethodField()
    is_in_watch_later = serializers.SerializerMethodField()
    stream_url = serializers.SerializerMethodField()
    available_qualities = serializers.SerializerMethodField()

    class Meta:
        model = Video
        fields = [
            'id', 'title', 'description', 'thumbnail_url', 'video_file',
            'url_360p', 'url_480p', 'url_720p', 'url_1080p', 'hls_url',
            'stream_url', 'available_qualities',
            'duration', 'duration_formatted', 'views_count', 'likes_count',
            'dislikes_count', 'comments_count', 'status', 'category', 'tags',
            'allow_comments', 'is_age_restricted', 'created_at', 'published_at',
            'uploader', 'user_like_status', 'is_in_watch_later'
        ]

    def get_user_like_status(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            like = obj.likes.filter(user=request.user).first()
            return like.action if like else None
        return None

    def get_is_in_watch_later(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.watchlater_set.filter(user=request.user).exists()
        return False

    def get_stream_url(self, obj):
        request = self.context.get('request')
        if not request or not obj.video_file:
            return None
        return request.build_absolute_uri(f'/api/videos/{obj.id}/stream/')

    def get_available_qualities(self, obj):
        return get_video_quality_options(obj, self.context.get('request'))


def get_video_quality_options(video, request=None):
    auto_url = video.hls_url
    auto_type = 'hls'
    if not auto_url:
        auto_url = get_best_mp4_url(video, request)
        auto_type = 'mp4'

    options = [{'label': 'Auto', 'value': 'auto', 'url': auto_url, 'type': auto_type}]

    for label, field_name in [
        ('1080p', 'url_1080p'),
        ('720p', 'url_720p'),
        ('480p', 'url_480p'),
        ('360p', 'url_360p'),
    ]:
        url = getattr(video, field_name, '')
        if url:
            options.append({'label': label, 'value': label, 'url': absolutize_url(url, request), 'type': 'mp4'})

    if video.video_file:
        url = request.build_absolute_uri(f'/api/videos/{video.id}/stream/') if request else None
        label = get_original_quality_label(video)
        options.append({'label': label, 'value': 'original', 'url': url, 'type': 'mp4'})

    return options


def absolutize_url(url, request=None):
    if not url or not request or url.startswith(('http://', 'https://')):
        return url
    return request.build_absolute_uri(url)


def get_best_mp4_url(video, request=None):
    for field_name in ['url_1080p', 'url_720p', 'url_480p', 'url_360p']:
        url = getattr(video, field_name, '')
        if url:
            return absolutize_url(url, request)
    if video.video_file and request:
        return request.build_absolute_uri(f'/api/videos/{video.id}/stream/')
    return None


def get_original_quality_label(video):
    height = get_original_video_height(video)
    if not height:
        return 'Original'
    if height >= 1080:
        return '1080p'
    if height >= 720:
        return '720p'
    if height >= 480:
        return '480p'
    if height >= 360:
        return '360p'
    return f'{height}p'


def get_original_video_height(video):
    if not video.video_file:
        return 0
    try:
        metadata = probe_video_metadata(settings.MEDIA_ROOT / video.video_file.name)
    except Exception:
        return 0
    return metadata.get('height') or 0


class VideoUploadSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    category_id = serializers.IntegerField(write_only=True, required=False)
    thumbnail_url = serializers.ReadOnlyField()

    class Meta:
        model = Video
        fields = [
            'id',
            'title', 'description', 'video_file', 'thumbnail',
            'thumbnail_url', 'status', 'category_id', 'tags',
            'allow_comments', 'is_age_restricted', 'created_at'
        ]
        read_only_fields = ['id', 'thumbnail_url', 'created_at']

    def create(self, validated_data):
        tags_data = validated_data.pop('tags', [])
        category_id = validated_data.pop('category_id', None)
        requested_status = validated_data.get('status') or 'published'

        validated_data['status'] = requested_status
        if requested_status == 'published':
            validated_data['published_at'] = timezone.now()

        video = Video.objects.create(
            uploader=self.context['request'].user,
            category_id=category_id,
            **validated_data
        )
        for tag_name in tags_data:
            tag, _ = Tag.objects.get_or_create(name=tag_name.lower().strip())
            video.tags.add(tag)
        set_video_duration_from_file(video)
        return video

    def update(self, instance, validated_data):
        tags_data = validated_data.pop('tags', None)
        category_id = validated_data.pop('category_id', None)
        old_video_file = instance.video_file.name if instance.video_file else ''

        if category_id is not None:
            instance.category_id = category_id

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if instance.status == 'published' and instance.published_at is None:
            instance.published_at = timezone.now()

        new_video_file = instance.video_file.name if instance.video_file else ''
        if new_video_file and new_video_file != old_video_file:
            set_video_duration_from_file(instance)

        instance.save()

        if tags_data is not None:
            instance.tags.clear()
            for tag_name in tags_data:
                tag, _ = Tag.objects.get_or_create(name=tag_name.lower().strip())
                instance.tags.add(tag)

        return instance


def set_video_duration_from_file(video):
    if not video.video_file:
        return

    try:
        metadata = probe_video_metadata(video.video_file.path)
    except Exception:
        return

    duration = metadata.get('duration') or 0
    if duration > 0 and video.duration != duration:
        video.duration = duration
        video.save(update_fields=['duration'])


class PlaylistSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    video_count = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    videos = VideoListSerializer(many=True, read_only=True)

    class Meta:
        model = Playlist
        fields = [
            'id', 'title', 'description', 'is_public', 'owner', 'video_count',
            'thumbnail', 'videos', 'created_at'
        ]

    def get_video_count(self, obj):
        return obj.videos.count()

    def get_thumbnail(self, obj):
        first_video = obj.videos.filter(status='published').first()
        return first_video.thumbnail_url if first_video else None
