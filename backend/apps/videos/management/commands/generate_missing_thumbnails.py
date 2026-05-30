from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.videos.models import Video
from apps.videos.thumbnail_utils import generate_video_thumbnail


class Command(BaseCommand):
    help = 'Generate thumbnails from video files for videos that are missing thumbnails.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--overwrite',
            action='store_true',
            help='Regenerate thumbnails even when a video already has one.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Maximum number of videos to process. Defaults to all matching videos.',
        )

    def handle(self, *args, **options):
        queryset = Video.objects.exclude(Q(video_file='') | Q(video_file__isnull=True))
        if not options['overwrite']:
            queryset = queryset.filter(Q(thumbnail='') | Q(thumbnail__isnull=True))

        if options['limit'] > 0:
            queryset = queryset[:options['limit']]

        generated = 0
        skipped = 0
        failed = 0

        for video in queryset:
            try:
                changed = generate_video_thumbnail(video, overwrite=options['overwrite'])
                if changed:
                    video.save(update_fields=['thumbnail'])
                    generated += 1
                    self.stdout.write(f'Generated thumbnail for {video.title}')
                else:
                    skipped += 1
            except Exception as exc:
                failed += 1
                self.stdout.write(self.style.WARNING(f'Could not thumbnail {video.title}: {exc}'))

        self.stdout.write(
            self.style.SUCCESS(
                f'Thumbnail generation complete. Generated: {generated}, skipped: {skipped}, failed: {failed}.'
            )
        )
