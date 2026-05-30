import subprocess
from pathlib import Path

from django.conf import settings


def generate_video_thumbnail(video, source_path=None, seek_seconds=None, overwrite=False):
    if video.thumbnail and not overwrite:
        return False

    source = Path(source_path or video.video_file.path)
    if not source.exists():
        raise FileNotFoundError(f'Video source not found at {source}')

    output_dir = Path(settings.MEDIA_ROOT) / 'thumbnails' / 'auto'
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f'{video.id}.jpg'

    if seek_seconds is None:
        seek_seconds = _default_seek_seconds(video)

    _run_ffmpeg([
        _get_ffmpeg_binary(),
        '-y',
        '-ss',
        str(seek_seconds),
        '-i',
        str(source),
        '-frames:v',
        '1',
        '-vf',
        'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720',
        '-q:v',
        '2',
        str(output_path),
    ])

    if not output_path.exists() or output_path.stat().st_size == 0:
        raise RuntimeError('Thumbnail generation produced no output file')

    video.thumbnail.name = f'thumbnails/auto/{video.id}.jpg'
    return True


def _default_seek_seconds(video):
    duration = int(video.duration or 0)
    if duration <= 0:
        return 1
    return max(1, min(duration // 3, 10))


def _get_ffmpeg_binary():
    try:
        import imageio_ffmpeg
    except ImportError as exc:
        raise RuntimeError('imageio-ffmpeg is required for thumbnail generation') from exc
    return imageio_ffmpeg.get_ffmpeg_exe()


def _run_ffmpeg(command):
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise RuntimeError(f'ffmpeg binary is unavailable: {command[0]}') from exc
    except subprocess.CalledProcessError as exc:
        stderr = exc.stderr.strip() if exc.stderr else 'No ffmpeg stderr output'
        raise RuntimeError(stderr) from exc
