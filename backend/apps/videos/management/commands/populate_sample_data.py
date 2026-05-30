import os
import uuid
import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.users.models import User
from apps.videos.models import Video, Category, Tag

SAMPLE_VIDEOS = [
    {
        'title': 'Big Buck Bunny',
        'description': 'Big Buck Bunny tells the story of a giant rabbit with a heart bigger than himself. When one sunny day three rodents rudely harass him, something snaps... and the rabbit ain\'t no bunny anymore! In the typical cartoon tradition he prepares the nasty rodents a comical revenge.',
        'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        'thumbnail': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        'duration': 596.0,
        'tags': ['animation', 'blender', 'bunny'],
        'category': 'Film & Animation'
    },
    {
        'title': 'Elephants Dream',
        'description': 'The first Blender Open Movie from 2006',
        'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        'thumbnail': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        'duration': 653.0,
        'tags': ['animation', 'blender', 'scifi'],
        'category': 'Film & Animation'
    },
    {
        'title': 'For Bigger Blazes',
        'description': 'HBO GO now works with Chromecast -- the easiest way to enjoy online video on your TV. For when you want to settle into your Iron Throne to watch the latest episodes.',
        'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        'thumbnail': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        'duration': 15.0,
        'tags': ['chromecast', 'commercial'],
        'category': 'Science & Technology'
    },
    {
        'title': 'Tears of Steel',
        'description': 'Tears of Steel was realized with crowd-funding by users of the open source 3D creation tool Blender. Target was to improve and test a complete open and free pipeline for visual effects in film - and to make a compelling sci-fi film in Amsterdam, the Netherlands.',
        'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        'thumbnail': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
        'duration': 734.0,
        'tags': ['blender', 'vfx', 'scifi', 'shortfilm'],
        'category': 'Film & Animation'
    },
    {
        'title': 'Sintel',
        'description': 'Sintel is an independently produced short film, initiated by the Blender Foundation as a means to further improve and validate the free/open source 3D creation suite Blender.',
        'url': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
        'thumbnail': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',
        'duration': 888.0,
        'tags': ['blender', 'animation', 'dragon'],
        'category': 'Film & Animation'
    }
]

class Command(BaseCommand):
    help = 'Populates the database with sample data from the web.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting sample data population...")

        # 1. Create a sample user
        user, created = User.objects.get_or_create(
            username='blender_foundation',
            defaults={
                'email': 'blender@example.com',
                'display_name': 'Blender Foundation',
                'verified': True,
                'subscribers_count': 1500000,
                'avatar_url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Blender_logo_no_text.svg/512px-Blender_logo_no_text.svg.png'
            }
        )
        if created:
            user.set_password('blender123')
            user.save()
            self.stdout.write(f"Created user: {user.username}")

        # 2. Add videos
        for v_data in SAMPLE_VIDEOS:
            if Video.objects.filter(title=v_data['title']).exists():
                self.stdout.write(f"Video '{v_data['title']}' already exists. Skipping.")
                continue

            # Create or get category
            cat, _ = Category.objects.get_or_create(
                name=v_data['category'],
                defaults={'slug': v_data['category'].lower().replace(' ', '-').replace('&', 'and')}
            )

            # Create video
            video = Video.objects.create(
                title=v_data['title'],
                description=v_data['description'],
                uploader=user,
                category=cat,
                duration=v_data['duration'],
                status='published',
                visibility='public',
                url_1080p=v_data['url'], # using original URL as the 1080p source
                views_count=random.randint(1000, 5000000),
                likes_count=random.randint(100, 100000),
                created_at=timezone.now() - timedelta(days=random.randint(1, 365))
            )
            
            # Since FileField/ImageField expect a file, and we are putting raw URLs into 
            # the processed URL fields and keeping `video_file` blank is a problem if `video_file`
            # is required, but it's required at form level, at DB level it's just a string path.
            # We will use the thumbnail URL as a fallback directly in the API or mock it here.
            # We'll just leave `video_file` blank since we have url_1080p set and our video player handles fallbacks.
            # Let's save the thumbnail string in the ImageField column even though it's technically a FileField.
            # For ImageField, it might validate existence if we try to access `url`. We can just store the URL if S3 is not enforced, 
            # but wait, ViewTube's frontend uses `video.thumbnail` or `video.thumbnail_url`.
            # We'll update the DB directly with the URL strings.
            
            Video.objects.filter(id=video.id).update(
                thumbnail=v_data['thumbnail'],
                video_file=v_data['url'] # Mocking the original file
            )

            # Add tags
            for tag_name in v_data['tags']:
                t, _ = Tag.objects.get_or_create(name=tag_name)
                video.tags.add(t)

            self.stdout.write(f"Created video: {v_data['title']}")

        self.stdout.write(self.style.SUCCESS("Sample data populated successfully!"))
