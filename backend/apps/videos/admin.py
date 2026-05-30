from django.contrib import admin
from .models import (Video, VideoView, VideoLike, PlaylistVideo, Category
, Tag, WatchLater) # noqa — register models as needed
admin.site.register(Video)
admin.site.register(VideoLike)
admin.site.register(VideoView)
admin.site.register(PlaylistVideo)
admin.site.register(Category)
admin.site.register(Tag)
admin.site.register(WatchLater)
