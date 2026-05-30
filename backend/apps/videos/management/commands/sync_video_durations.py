from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.videos.media_utils import probe_video_metadata
from apps.videos.models import Video


class Command(BaseCommand):
    help = 'Update video.duration from the actual local video file metadata.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Maximum number of videos to process. Defaults to all videos with local files.',
        )

    def handle(self, *args, **options):
        queryset = Video.objects.exclude(Q(video_file='') | Q(video_file__isnull=True))
        if options['limit'] > 0:
            queryset = queryset[:options['limit']]

        updated = 0
        unchanged = 0
        failed = 0

        for video in queryset:
            try:
                metadata = probe_video_metadata(video.video_file.path)
                duration = metadata.get('duration') or 0
                if duration and video.duration != duration:
                    video.duration = duration
                    video.save(update_fields=['duration'])
                    updated += 1
                    self.stdout.write(f'Updated {video.title}: {duration}s')
                else:
                    unchanged += 1
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.WARNING(f'Could not update {video.title}: {exc}'))

        self.stdout.write(
            self.style.SUCCESS(
                f'Duration sync complete. Updated: {updated}, unchanged: {unchanged}, failed: {failed}.'
            )
        )
