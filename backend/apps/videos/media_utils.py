import math
from pathlib import Path


def probe_video_metadata(source_path):
    try:
        import imageio_ffmpeg
    except ImportError as exc:
        raise RuntimeError('imageio-ffmpeg is required for video metadata probing') from exc

    source = Path(source_path)
    if not source.exists():
        raise FileNotFoundError(f'Video source not found at {source}')

    reader = imageio_ffmpeg.read_frames(str(source))
    try:
        metadata = next(reader)
    finally:
        try:
            reader.close()
        except Exception:
            pass

    source_size = metadata.get('source_size') or metadata.get('size') or (0, 0)
    return {
        'width': int(source_size[0] or 0),
        'height': int(source_size[1] or 0),
        'duration': _duration_seconds(metadata),
    }


def _duration_seconds(metadata):
    duration = metadata.get('duration')
    if not duration:
        return 0
    return max(0, int(math.ceil(float(duration))))
