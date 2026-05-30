from django.db.models.signals import post_save, post_delete, m2m_changed
from django.dispatch import receiver
from django.contrib.postgres.search import SearchVector
from .models import Video, VideoLike, Tag

@receiver([post_save, post_delete], sender=VideoLike)
def update_video_likes(sender, instance, **kwargs):
    """
    Synchronizes the likes_count and dislikes_count on the Video model.
    """
    video = instance.video
    likes = VideoLike.objects.filter(video=video, action=VideoLike.LIKE).count()
    dislikes = VideoLike.objects.filter(video=video, action=VideoLike.DISLIKE).count()
    Video.objects.filter(pk=video.pk).update(likes_count=likes, dislikes_count=dislikes)

def _update_search_vector(video):
    from django.db.models import Value
    tags_str = ' '.join([tag.name for tag in video.tags.all()])
    uploader_str = f"{video.uploader.username} {video.uploader.display_name or ''}"
    vector = SearchVector('title', weight='A') + \
             SearchVector('description', weight='C') + \
             SearchVector(Value(tags_str), weight='B') + \
             SearchVector(Value(uploader_str), weight='B')
    Video.objects.filter(pk=video.pk).update(search_vector=vector)

@receiver(post_save, sender=Video)
def update_video_search_vector_on_save(sender, instance, **kwargs):
    """
    Update the SearchVectorField when a Video is saved.
    """
    _update_search_vector(instance)

@receiver(m2m_changed, sender=Video.tags.through)
def update_video_search_vector_on_tags(sender, instance, action, **kwargs):
    """
    Update the SearchVectorField when tags are added or removed.
    """
    if action in ["post_add", "post_remove", "post_clear"]:
        _update_search_vector(instance)
