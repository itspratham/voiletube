from django.db import models
from ..users.models import User


class Notification(models.Model):
    TYPE_CHOICES = [
        ('new_video', 'New Video'),
        ('comment', 'Comment'),
        ('reply', 'Reply'),
        ('like', 'Like'),
        ('subscription', 'Subscription'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='sent_notifications')
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.CharField(max_length=500)
    link = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'
        ordering = ['-created_at']
