import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipForward, SkipBack, RectangleHorizontal
} from 'lucide-react'

export default function VideoPlayer({ video, onProgress, isTheater, onToggleTheater, onEnded }) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const hlsRef = useRef(null)
  const progressRef = useRef(null)
  const activeSrcRef = useRef(null)
  const currentTimeRef = useRef(0)
  const pendingSeekRef = useRef(null)
  const draggingProgressRef = useRef(false)
  const previewVideoRef = useRef(null)
  const previewCanvasRef = useRef(null)
  const previewRequestRef = useRef(0)
  const previewTimeoutRef = useRef(null)
  const previewSourceRef = useRef(null)

  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem('vt-muted') === 'true'
  })
  const [volume, setVolume] = useState(() => {
    const v = localStorage.getItem('vt-volume')
    return v !== null ? parseFloat(v) : 1
  })
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [quality, setQuality] = useState('auto')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [hlsLevels, setHlsLevels] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [scrubPreview, setScrubPreview] = useState({
    visible: false,
    x: 0,
    time: 0,
    image: null,
  })
  const hideTimeout = useRef(null)

  const clampTime = (time, maxTime) => {
    const numericTime = Number(time)
    if (!Number.isFinite(numericTime)) return 0
    if (!Number.isFinite(maxTime) || maxTime <= 0) return Math.max(0, numericTime)
    return Math.max(0, Math.min(maxTime, numericTime))
  }

  const directSources = [
    ['1080p', video?.url_1080p],
    ['720p', video?.url_720p],
    ['480p', video?.url_480p],
    ['360p', video?.url_360p],
  ].filter(([, url]) => Boolean(url))
  const dbQualityOptions = Array.isArray(video?.available_qualities)
    ? video.available_qualities.filter((option) => option?.url)
    : []
  const dbDirectSources = dbQualityOptions
    .filter((option) => option.type !== 'hls')
    .map((option) => [option.value, option.url, option.label])
  const hlsQualityOption = dbQualityOptions.find((option) => option.type === 'hls')
  const effectiveDirectSources = dbDirectSources.length ? dbDirectSources : directSources.map(([label, url]) => [label, url, label])

  const autoQualityOption = dbQualityOptions.find((option) => option.value === 'auto')
  const fallbackUrl = autoQualityOption?.url || video?.stream_url || effectiveDirectSources[0]?.[1] || video?.video_file
  const videoUrl = hlsQualityOption?.url || video?.hls_url || fallbackUrl
  const selectedDirectUrl = quality === 'auto'
    ? fallbackUrl
    : effectiveDirectSources.find(([value]) => value === quality)?.[1] || fallbackUrl
  const qualityOptions = dbQualityOptions.length
    ? dbQualityOptions.map((option) => ({ value: option.value, label: option.label }))
    : [
        { value: 'auto', label: 'Auto' },
        ...[...new Set([
          ...hlsLevels.map((level) => `${level.height}p`),
          ...directSources.map(([label]) => label),
        ])].map((label) => ({ value: label, label })),
      ]

  const getApiDuration = () => {
    const seconds = Number(video?.duration)
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  }

  useEffect(() => {
    setDuration(getApiDuration())
    setCurrentTime(0)
    setBuffered(0)
    setQuality('auto')
    setHlsLevels([])
    currentTimeRef.current = 0
    pendingSeekRef.current = null
    setScrubPreview((preview) => ({ ...preview, visible: false, time: 0, image: null }))
  }, [video?.id, video?.duration])

  useEffect(() => {
    return () => {
      window.clearTimeout(previewTimeoutRef.current)
      if (previewVideoRef.current) {
        previewVideoRef.current.removeAttribute('src')
        previewVideoRef.current.load()
      }
    }
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      videoRef.current.muted = muted
    }
  }, []) // Apply initial volume on mount

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate, videoUrl, selectedDirectUrl])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !videoUrl) return
    if (!videoUrl.includes('.m3u8')) return

    if (Hls.isSupported() && videoUrl.includes('.m3u8')) {
      const hls = new Hls({ startLevel: -1, autoStartLoad: true })
      hlsRef.current = hls
      activeSrcRef.current = videoUrl
      hls.loadSource(videoUrl)
      hls.attachMedia(el)
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setHlsLevels(data.levels || [])
        el.play().catch(() => {})
      })
      return () => {
        hls.destroy()
        hlsRef.current = null
        activeSrcRef.current = null
      }
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      const playWhenReady = () => el.play().catch(() => {})
      if (activeSrcRef.current !== videoUrl) {
        activeSrcRef.current = videoUrl
        el.src = videoUrl
      }
      el.addEventListener('loadedmetadata', playWhenReady)
      return () => el.removeEventListener('loadedmetadata', playWhenReady)
    }
  }, [videoUrl])

  useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return
    if (quality === 'auto') {
      hls.currentLevel = -1
      return
    }
    const levelIndex = hls.levels.findIndex((level) => `${level.height}p` === quality)
    if (levelIndex >= 0) hls.currentLevel = levelIndex
  }, [quality])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !selectedDirectUrl || videoUrl?.includes('.m3u8')) return
    if (activeSrcRef.current === selectedDirectUrl) return

    const wasPlaying = !el.paused
    const previousTime = pendingSeekRef.current ?? currentTimeRef.current ?? el.currentTime ?? 0
    activeSrcRef.current = selectedDirectUrl
    el.src = selectedDirectUrl
    el.load()
    const restore = () => {
      if (Number.isFinite(previousTime) && previousTime > 0) {
        const maxTime = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : previousTime
        const restoredTime = Math.min(previousTime, maxTime)
        el.currentTime = restoredTime
        currentTimeRef.current = restoredTime
        setCurrentTime(restoredTime)
      }
      if (wasPlaying) el.play().catch(() => {})
    }
    el.addEventListener('loadedmetadata', restore, { once: true })
    return () => el.removeEventListener('loadedmetadata', restore)
  }, [quality, selectedDirectUrl, videoUrl])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const getMediaDuration = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) return el.duration
      const seekableEnd = el.seekable.length ? el.seekable.end(el.seekable.length - 1) : 0
      if (Number.isFinite(seekableEnd) && seekableEnd > 0) return seekableEnd
      return getApiDuration()
    }
    const syncTime = () => {
      const mediaTime = Number.isFinite(el.currentTime) ? el.currentTime : 0
      const pendingSeek = pendingSeekRef.current
      const nextTime = pendingSeek !== null && mediaTime === 0 && pendingSeek > 0
        ? pendingSeek
        : mediaTime

      if (pendingSeek !== null && Math.abs(mediaTime - pendingSeek) < 0.5) {
        pendingSeekRef.current = null
      }

      currentTimeRef.current = nextTime
      setCurrentTime(nextTime)
      if (el.buffered.length) {
        const nextBuffered = el.buffered.end(el.buffered.length - 1)
        if (Number.isFinite(nextBuffered)) setBuffered(nextBuffered)
      }
      onProgress?.(nextTime)
    }
    const onDurationChange = () => {
      setDuration(getMediaDuration())
    }

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', syncTime)
    el.addEventListener('seeked', syncTime)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('loadedmetadata', onDurationChange)
    if (onEnded) el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', syncTime)
      el.removeEventListener('seeked', syncTime)
      el.removeEventListener('durationchange', onDurationChange)
      el.removeEventListener('loadedmetadata', onDurationChange)
      if (onEnded) el.removeEventListener('ended', onEnded)
    }
  }, [video?.duration, onEnded])

  const togglePlay = () => {
    const el = videoRef.current
    playing ? el.pause() : el.play()
  }

  const toggleMute = () => {
    const nextMuted = !muted
    videoRef.current.muted = nextMuted
    setMuted(nextMuted)
    localStorage.setItem('vt-muted', nextMuted)
  }

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value)
    videoRef.current.volume = v
    setVolume(v)
    const nextMuted = v === 0
    setMuted(nextMuted)
    localStorage.setItem('vt-volume', v)
    localStorage.setItem('vt-muted', nextMuted)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return
      const el = videoRef.current
      if (!el) return
      
      const seekDuration = getSeekableDuration()

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          playing ? el.pause() : el.play()
          break
        case 'm':
          e.preventDefault()
          const nextMuted = !muted
          el.muted = nextMuted
          setMuted(nextMuted)
          localStorage.setItem('vt-muted', nextMuted)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 't':
          e.preventDefault()
          if (onToggleTheater) onToggleTheater()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          skip(-10)
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          skip(10)
          break
        case 'arrowup':
          e.preventDefault()
          handleVolumeChange({ target: { value: Math.min(1, volume + 0.05) } })
          break
        case 'arrowdown':
          e.preventDefault()
          handleVolumeChange({ target: { value: Math.max(0, volume - 0.05) } })
          break
        default:
          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault()
            const pct = parseInt(e.key) / 10
            const nextTime = clampTime(pct * seekDuration, seekDuration)
            pendingSeekRef.current = nextTime
            el.currentTime = nextTime
            currentTimeRef.current = nextTime
            setCurrentTime(nextTime)
          }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playing, muted, volume, fullscreen, isTheater, duration])

  const getSeekableDuration = () => {
    const el = videoRef.current
    if (!el) return duration || getApiDuration()
    if (Number.isFinite(el.duration) && el.duration > 0) return el.duration
    if (el.seekable.length) {
      const seekableEnd = el.seekable.end(el.seekable.length - 1)
      if (Number.isFinite(seekableEnd) && seekableEnd > 0) return seekableEnd
    }
    return duration || getApiDuration()
  }

  const getPreviewSource = () => {
    if (selectedDirectUrl) return selectedDirectUrl
    if (video?.stream_url) return video.stream_url
    if (video?.video_file) return video.video_file
    return null
  }

  const capturePreviewFrame = (time) => {
    const source = getPreviewSource()
    if (!source || source.includes('.m3u8')) return

    const requestId = previewRequestRef.current + 1
    previewRequestRef.current = requestId
    window.clearTimeout(previewTimeoutRef.current)

    previewTimeoutRef.current = window.setTimeout(() => {
      if (!previewVideoRef.current) {
        const previewVideo = document.createElement('video')
        previewVideo.preload = 'metadata'
        previewVideo.muted = true
        previewVideo.playsInline = true
        previewVideo.crossOrigin = 'anonymous'
        previewVideoRef.current = previewVideo
      }

      if (!previewCanvasRef.current) {
        previewCanvasRef.current = document.createElement('canvas')
      }

      const previewVideo = previewVideoRef.current
      const canvas = previewCanvasRef.current

      const drawFrame = () => {
        if (requestId !== previewRequestRef.current || !previewVideo.videoWidth || !previewVideo.videoHeight) return
        canvas.width = previewVideo.videoWidth
        canvas.height = previewVideo.videoHeight
        try {
          canvas.getContext('2d')?.drawImage(previewVideo, 0, 0, canvas.width, canvas.height)
          const image = canvas.toDataURL('image/jpeg', 0.72)
          setScrubPreview((preview) => (
            requestId === previewRequestRef.current
              ? { ...preview, image }
              : preview
          ))
        } catch {
          setScrubPreview((preview) => ({ ...preview, image: video?.thumbnail_url || null }))
        }
      }

      const seekToFrame = () => {
        if (requestId !== previewRequestRef.current) return
        const maxTime = Number.isFinite(previewVideo.duration) && previewVideo.duration > 0
          ? previewVideo.duration
          : getSeekableDuration()
        try {
          previewVideo.currentTime = clampTime(time, maxTime)
        } catch {
          setScrubPreview((preview) => ({ ...preview, image: video?.thumbnail_url || null }))
        }
      }

      previewVideo.onseeked = drawFrame
      previewVideo.onloadedmetadata = seekToFrame
      previewVideo.onerror = () => {
        if (requestId === previewRequestRef.current) {
          setScrubPreview((preview) => ({ ...preview, image: video?.thumbnail_url || null }))
        }
      }

      if (previewSourceRef.current !== source) {
        previewSourceRef.current = source
        previewVideo.src = source
        previewVideo.load()
      } else if (previewVideo.readyState >= 1) {
        seekToFrame()
      }
    }, 80)
  }

  const updateScrubPreview = (e) => {
    const rect = progressRef.current?.getBoundingClientRect()
    const seekDuration = getSeekableDuration()
    if (!rect?.width || !seekDuration) return

    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const nextTime = clampTime(pct * seekDuration, seekDuration)
    setScrubPreview((preview) => ({
      visible: true,
      x: pct * 100,
      time: nextTime,
      image: preview.image || video?.thumbnail_url || null,
    }))
    capturePreviewFrame(nextTime)
  }

  const seekToPointer = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const el = videoRef.current
    const rect = progressRef.current?.getBoundingClientRect()
    const seekDuration = getSeekableDuration()
    if (!el || !rect?.width || !seekDuration) return

    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const nextTime = clampTime(pct * seekDuration, seekDuration)
    pendingSeekRef.current = nextTime
    el.currentTime = nextTime
    currentTimeRef.current = nextTime
    setCurrentTime(nextTime)
  }

  const beginSeek = (e) => {
    draggingProgressRef.current = true
    progressRef.current?.setPointerCapture?.(e.pointerId)
    updateScrubPreview(e)
    seekToPointer(e)
  }

  const dragSeek = (e) => {
    updateScrubPreview(e)
    if (!draggingProgressRef.current) return
    seekToPointer(e)
  }

  const endSeek = (e) => {
    if (!draggingProgressRef.current) return
    draggingProgressRef.current = false
    progressRef.current?.releasePointerCapture?.(e.pointerId)
    updateScrubPreview(e)
    seekToPointer(e)
  }

  const skip = (secs, e) => {
    e?.preventDefault()
    e?.stopPropagation()
    const el = videoRef.current
    const seekDuration = getSeekableDuration()
    if (!el || !seekDuration) return

    const nextTime = clampTime((currentTimeRef.current || el.currentTime || 0) + secs, seekDuration)
    pendingSeekRef.current = nextTime
    el.currentTime = nextTime
    currentTimeRef.current = nextTime
    setCurrentTime(nextTime)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  const showControlsTemporarily = () => {
    setShowControls(true)
    clearTimeout(hideTimeout.current)
    hideTimeout.current = setTimeout(() => playing && setShowControls(false), 3000)
  }

  const formatTime = (s) => {
    if (!Number.isFinite(s) || s < 0) return '0:00'
    const totalSeconds = Math.floor(s)
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const sec = totalSeconds % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
    }
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const displayDuration = getSeekableDuration()
  const progressPct = displayDuration
    ? Math.min(100, Math.max(0, (currentTime / displayDuration) * 100))
    : 0
  const bufferedPct = displayDuration
    ? Math.min(100, Math.max(0, (buffered / displayDuration) * 100))
    : 0

  return (
    <div
      ref={containerRef}
      className={`video-container group relative w-full overflow-hidden bg-black shadow-[0_28px_90px_rgb(var(--vt-shadow)/0.22)] ring-1 ring-vt-border/80 ${isTheater ? 'aspect-video md:h-[calc(100vh-140px)] md:max-h-[800px]' : 'aspect-video rounded-lg'}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => playing && setShowControls(false)}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        playsInline
      />

      {/* Full-cover click zone for play/pause, above video and below controls. */}
      <div
        className="absolute inset-0"
        onClick={togglePlay}
      />

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-200 ${
          showControls ? 'opacity-100' : 'opacity-0'
        } pointer-events-none`}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pointer-events-none" />

          <div className="relative px-4 pb-3 space-y-1 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          {/* Progress bar */}
          <div
            ref={progressRef}
            onPointerEnter={updateScrubPreview}
            onPointerLeave={() => {
              if (!draggingProgressRef.current) {
                window.clearTimeout(previewTimeoutRef.current)
                setScrubPreview((preview) => ({ ...preview, visible: false }))
              }
            }}
            onPointerDown={beginSeek}
            onPointerMove={dragSeek}
            onPointerUp={endSeek}
            onPointerCancel={endSeek}
            className="relative h-1 cursor-pointer rounded bg-white/25 transition-all hover:h-1.5 group/progress"
            role="slider"
            aria-label="Video progress"
            aria-valuemin={0}
            aria-valuemax={Math.floor(displayDuration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(displayDuration)}`}
          >
            {scrubPreview.visible && (
              <div
                className="pointer-events-none absolute bottom-4 z-20 w-36 overflow-hidden rounded-md border border-white/15 bg-black/90 shadow-2xl"
                style={{
                  left: `${scrubPreview.x}%`,
                  transform: `translateX(${scrubPreview.x < 12 ? '0' : scrubPreview.x > 88 ? '-100%' : '-50%'})`,
                }}
              >
                <div className="aspect-video bg-black">
                  {scrubPreview.image ? (
                    <img
                      src={scrubPreview.image}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-full w-full bg-white/10" />
                  )}
                </div>
                <div className="px-2 py-1 text-center text-xs font-medium tabular-nums text-white">
                  {formatTime(scrubPreview.time)}
                </div>
              </div>
            )}
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded bg-vt-accent" style={{ width: `${progressPct}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 text-white">
            <button onClick={(e) => skip(-10, e)} className="hover:scale-110 transition-transform p-1">
              <SkipBack size={18} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="hover:scale-110 transition-transform p-1">
              {playing ? <Pause size={22} fill="white" /> : <Play size={22} fill="white" />}
            </button>
            <button onClick={(e) => skip(10, e)} className="hover:scale-110 transition-transform p-1">
              <SkipForward size={18} />
            </button>

            {/* Volume */}
            <div className="group/vol flex items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute() }}
                  className="p-1 text-white transition-transform duration-200 hover:scale-110"
                  aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <div className="flex items-center overflow-hidden transition-all duration-300 w-16 opacity-80 group-hover/vol:w-24 group-hover/vol:opacity-100">
                  <input
                    type="range" min="0" max="1" step="0.05"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-vt-accent"
                  />
                </div>
              </div>
            </div>

            <span className="text-xs ml-1 tabular-nums">
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </span>

            <div className="flex-1" />

            {/* Settings */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings) }}
                className="p-1 transition-transform hover:scale-110"
                aria-label="Quality settings"
              >
                <Settings size={18} />
              </button>
              {showSettings && (
                <div className="absolute bottom-8 right-0 w-40 rounded-lg border border-white/10 bg-black/88 p-2 text-sm shadow-2xl backdrop-blur-xl overflow-y-auto max-h-72 scrollbar-none">
                  <p className="text-vt-muted text-xs mb-1 px-2">Quality</p>
                  {qualityOptions.map((q) => (
                    <button
                      key={q.value}
                      onClick={(e) => { e.stopPropagation(); setQuality(q.value); setShowSettings(false) }}
                      className={`w-full text-left px-3 py-1.5 rounded hover:bg-white/10 ${quality === q.value ? 'text-vt-accent' : ''}`}
                    >
                      {q.label}
                    </button>
                  ))}

                  <div className="my-2 border-t border-white/10" />

                  <p className="text-vt-muted text-xs mb-1 px-2">Speed</p>
                  {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={(e) => { e.stopPropagation(); setPlaybackRate(rate); setShowSettings(false) }}
                      className={`w-full text-left px-3 py-1.5 rounded hover:bg-white/10 ${playbackRate === rate ? 'text-vt-accent' : ''}`}
                    >
                      {rate === 1 ? 'Normal' : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {onToggleTheater && (
              <button onClick={(e) => { e.stopPropagation(); onToggleTheater() }} className="p-1 hover:scale-110 transition-transform" title="Theater mode (t)">
                <RectangleHorizontal size={18} />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen() }} className="p-1 hover:scale-110 transition-transform" title="Fullscreen (f)">
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Centered play icon shown when paused */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-black/60 shadow-2xl backdrop-blur">
            <Play size={28} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  )
}
