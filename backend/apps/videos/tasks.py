from celery import shared_task
import logging
import shutil
import subprocess
from pathlib import Path
import concurrent.futures

from django.conf import settings
from django.utils import timezone
from .media_utils import probe_video_metadata
from .thumbnail_utils import generate_video_thumbnail

logger = logging.getLogger(__name__)

QUALITY_PROFILES = [
    {
        'name': '360p',
        'height': 360,
        'video_bitrate': '800k',
        'maxrate': '856k',
        'bufsize': '1200k',
        'audio_bitrate': '96k',
    },
    {
        'name': '480p',
        'height': 480,
        'video_bitrate': '1400k',
        'maxrate': '1498k',
        'bufsize': '2100k',
        'audio_bitrate': '128k',
    },
    {
        'name': '720p',
        'height': 720,
        'video_bitrate': '2800k',
        'maxrate': '2996k',
        'bufsize': '4200k',
        'audio_bitrate': '128k',
    },
    {
        'name': '1080p',
        'height': 1080,
        'video_bitrate': '5000k',
        'maxrate': '5350k',
        'bufsize': '7500k',
        'audio_bitrate': '192k',
    },
]


@shared_task(bind=True, max_retries=3)
def process_video(self, video_id):
    from .models import Video

    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        logger.error('Video %s not found', video_id)
        return

    try:
        if not video.video_file:
            raise ValueError('Video file is missing')

        logger.info('Starting local transcoding for video %s', video_id)
        source_path = Path(video.video_file.path)
        if not source_path.exists():
            raise FileNotFoundError(f'Source video not found at {source_path}')

        metadata = _probe_video(source_path)
        _set_video_duration(video, metadata)
        output_dir = Path(settings.MEDIA_ROOT) / 'videos' / 'processed' / str(video.id)
        if output_dir.exists():
            shutil.rmtree(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        renditions = _select_quality_profiles(metadata)
        if not renditions:
            raise ValueError('No valid renditions could be selected for this video')

        _transcode_mp4_renditions(source_path, output_dir, renditions)
        _transcode_hls_variants(source_path, output_dir, renditions)
        _create_hls_master_playlist(output_dir, renditions)
        _assign_output_urls(video, renditions)
        _generate_thumbnail(video, source_path, metadata)

        update_fields = [
            'duration',
            'url_360p',
            'url_480p',
            'url_720p',
            'url_1080p',
            'hls_url',
            'thumbnail',
        ]
        if video.status == 'processing':
            video.status = 'published'
            update_fields.append('status')
        if video.status == 'published' and video.published_at is None:
            video.published_at = timezone.now()
            update_fields.append('published_at')

        video.save(update_fields=update_fields)
        logger.info('Video %s processed successfully', video_id)
    except Exception as exc:
        logger.error('Error processing video %s: %s', video_id, exc)
        try:
            self.retry(countdown=60 * (self.request.retries + 1), exc=exc)
        except self.MaxRetriesExceededError:
            Video.objects.filter(id=video_id).update(status='failed')


def _probe_video(source_path):
    metadata = probe_video_metadata(source_path)
    if not metadata['width'] or not metadata['height']:
        raise ValueError('Uploaded file does not contain valid video dimensions')
    return metadata


def _set_video_duration(video, metadata):
    duration = metadata.get('duration') or 0
    if duration > 0:
        video.duration = duration


def _select_quality_profiles(metadata):
    source_height = metadata['height']
    source_width = metadata['width']
    if source_height <= 0 or source_width <= 0:
        raise ValueError('Source video dimensions are invalid')

    renditions = []
    for profile in QUALITY_PROFILES:
        if profile['height'] > source_height:
            continue
        renditions.append({
            **profile,
            'width': _scaled_width(source_width, source_height, profile['height']),
        })

    if not renditions:
        smallest = QUALITY_PROFILES[0]
        fallback_height = min(source_height, smallest['height']) if source_height > 0 else smallest['height']
        renditions.append({
            **smallest,
            'height': fallback_height,
            'width': _scaled_width(source_width, source_height, fallback_height),
        })

    return renditions


def _scaled_width(source_width, source_height, target_height):
    width = int(round((source_width / source_height) * target_height))
    return width if width % 2 == 0 else width + 1


def _transcode_mp4_renditions(source_path, output_dir, renditions):
    ffmpeg_bin = _get_ffmpeg_binary()
    commands = []
    for rendition in renditions:
        output_path = output_dir / f"{rendition['name']}.mp4"
        commands.append([
            ffmpeg_bin,
            '-y',
            '-i',
            str(source_path),
            '-vf',
            f"scale={rendition['width']}:{rendition['height']}:force_original_aspect_ratio=decrease,"
            f"pad={rendition['width']}:{rendition['height']}:(ow-iw)/2:(oh-ih)/2",
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-profile:v',
            'main',
            '-crf',
            '21',
            '-b:v',
            rendition['video_bitrate'],
            '-maxrate',
            rendition['maxrate'],
            '-bufsize',
            rendition['bufsize'],
            '-c:a',
            'aac',
            '-b:a',
            rendition['audio_bitrate'],
            '-movflags',
            '+faststart',
            str(output_path),
        ])

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(commands))) as executor:
        list(executor.map(_run_ffmpeg, commands))


def _transcode_hls_variants(source_path, output_dir, renditions):
    ffmpeg_bin = _get_ffmpeg_binary()
    hls_dir = output_dir / 'hls'
    hls_dir.mkdir(parents=True, exist_ok=True)

    commands = []
    for rendition in renditions:
        rendition_dir = hls_dir / rendition['name']
        rendition_dir.mkdir(parents=True, exist_ok=True)
        playlist_path = rendition_dir / 'index.m3u8'
        segment_pattern = rendition_dir / 'segment_%03d.ts'

        commands.append([
            ffmpeg_bin,
            '-y',
            '-i',
            str(source_path),
            '-vf',
            f"scale={rendition['width']}:{rendition['height']}:force_original_aspect_ratio=decrease,"
            f"pad={rendition['width']}:{rendition['height']}:(ow-iw)/2:(oh-ih)/2",
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-profile:v',
            'main',
            '-crf',
            '22',
            '-g',
            '48',
            '-keyint_min',
            '48',
            '-sc_threshold',
            '0',
            '-b:v',
            rendition['video_bitrate'],
            '-maxrate',
            rendition['maxrate'],
            '-bufsize',
            rendition['bufsize'],
            '-c:a',
            'aac',
            '-b:a',
            rendition['audio_bitrate'],
            '-ar',
            '48000',
            '-ac',
            '2',
            '-f',
            'hls',
            '-hls_time',
            '6',
            '-hls_playlist_type',
            'vod',
            '-hls_segment_filename',
            str(segment_pattern),
            str(playlist_path),
        ])

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(commands))) as executor:
        list(executor.map(_run_ffmpeg, commands))


def _create_hls_master_playlist(output_dir, renditions):
    hls_dir = output_dir / 'hls'
    master_playlist_path = hls_dir / 'index.m3u8'
    lines = ['#EXTM3U', '#EXT-X-VERSION:3']

    for rendition in renditions:
        bandwidth = _bitrate_to_int(rendition['maxrate']) + _bitrate_to_int(rendition['audio_bitrate'])
        lines.append(
            f"#EXT-X-STREAM-INF:BANDWIDTH={bandwidth},RESOLUTION={rendition['width']}x{rendition['height']}"
        )
        lines.append(f"{rendition['name']}/index.m3u8")

    master_playlist_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def _bitrate_to_int(value):
    normalized = value.lower().strip()
    if normalized.endswith('k'):
        return int(float(normalized[:-1]) * 1000)
    if normalized.endswith('m'):
        return int(float(normalized[:-1]) * 1000 * 1000)
    return int(float(normalized))


def _assign_output_urls(video, renditions):
    base_media_url = settings.MEDIA_URL.rstrip('/')
    base_path = f'{base_media_url}/videos/processed/{video.id}'

    video.url_360p = ''
    video.url_480p = ''
    video.url_720p = ''
    video.url_1080p = ''

    for rendition in renditions:
        setattr(video, f"url_{rendition['name']}", f'{base_path}/{rendition["name"]}.mp4')

    video.hls_url = f'{base_path}/hls/index.m3u8'


def _generate_thumbnail(video, source_path, metadata):
    seek_seconds = min(1, metadata.get('duration') or 1)
    generate_video_thumbnail(video, source_path=source_path, seek_seconds=seek_seconds)


def _get_ffmpeg_binary():
    try:
        import imageio_ffmpeg
    except ImportError as exc:
        raise RuntimeError('imageio-ffmpeg is required for local transcoding') from exc
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run_ffmpeg(command):
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(f'ffmpeg binary is unavailable: {command[0]}') from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else 'No ffmpeg stderr output'
        raise RuntimeError(stderr) from exc
