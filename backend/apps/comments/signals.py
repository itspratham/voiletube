from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Comment
from ..videos.models import Video

@receiver([post_save, post_delete], sender=Comment)
def update_video_comments_count(sender, instance, **kwargs):
    """
    Synchronizes the comments_count on the Video model.
    """
    video = instance.video
    count = Comment.objects.filter(video=video).count()
    Video.objects.filter(pk=video.pk).update(comments_count=count)
