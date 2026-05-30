from django.contrib import admin
from .models import Comment, CommentLike  # noqa — register models as needed


admin.site.register(Comment)
admin.site.register(CommentLike)