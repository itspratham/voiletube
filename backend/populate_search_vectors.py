import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viewtube.settings')
django.setup()

from apps.videos.models import Video
from apps.videos.signals import _update_search_vector

videos = Video.objects.all()
count = 0
for video in videos:
    _update_search_vector(video)
    count += 1

print(f"Updated search vectors for {count} videos.")
