import os
import django
import urllib.request
from django.core.files.base import ContentFile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viewtube.settings')
django.setup()

from apps.videos.models import Video, Category
from apps.users.models import User
from apps.videos.tasks import process_video

# Create a sample user
user, _ = User.objects.get_or_create(username='creative_commons', defaults={
    'email': 'cc@example.com',
    'channel_name': 'Creative Commons Archive',
})

# Create a sample category
category, _ = Category.objects.get_or_create(name='Short Films', slug='short-films')

videos_data = [
    {
        "title": "Ocean Breeze",
        "description": "A relaxing ocean view with calming waves.",
    },
    {
        "title": "Mountain Hike",
        "description": "Climbing up the steepest trails.",
    },
    {
        "title": "City Lights",
        "description": "A bustling metropolis at midnight.",
    },
    {
        "title": "Space Exploration",
        "description": "Journey through the cosmos.",
    },
    {
        "title": "Desert Safari",
        "description": "Driving through the hot dunes.",
    }
]

video_url = "https://www.w3schools.com/html/mov_bbb.mp4"
thumb_url = "https://picsum.photos/1280/720"

print("Starting video seed process...")

for i, data in enumerate(videos_data):
    if Video.objects.filter(title=data['title']).exists():
        print(f"Skipping '{data['title']}' (already exists)")
        continue

    print(f"Downloading '{data['title']}'...")
    
    video = Video(
        uploader=user,
        title=data['title'],
        description=data['description'],
        category=category,
        status='processing'
    )
    
    # Download random thumbnail
    req = urllib.request.Request(f"{thumb_url}?random={i}", headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as thumb_resp:
            if thumb_resp.status == 200:
                video.thumbnail.save(f"{data['title'].replace(' ', '_')}.jpg", ContentFile(thumb_resp.read()), save=False)
    except Exception as e:
        print(f"Failed to download thumbnail: {e}")
        
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
        req_vid = urllib.request.Request(video_url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req_vid) as r:
                while True:
                    chunk = r.read(8192)
                    if not chunk:
                        break
                    temp_file.write(chunk)
            temp_file.flush()
            
            with open(temp_file.name, 'rb') as f:
                video.video_file.save(f"{data['title'].replace(' ', '_')}.mp4", ContentFile(f.read()), save=False)
        except Exception as e:
            print(f"Failed to download video: {e}")
            
    video.save()
    os.unlink(temp_file.name)
    
    print(f"Saved '{data['title']}'. Queuing celery task...")
    try:
        process_video.delay(str(video.id))
    except Exception as e:
        print(f"Celery failed, running synchronously: {e}")
        process_video.apply(args=[str(video.id)])
        
print("Seed process complete!")
