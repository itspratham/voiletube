import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MoreVertical, Clock, BookmarkPlus, Check, Plus } from 'lucide-react'
import { formatCount, formatTimeAgo, formatDuration } from '@/utils/format'
import { useDispatch, useSelector } from 'react-redux'
import { openAuthModal } from '@/store/slices/uiSlice'
import { videoService } from '@/services/api'
import toast from 'react-hot-toast'
import BrandMark from '@/components/brand/BrandMark'
import VerifiedBadge from '@/components/brand/VerifiedBadge'

export default function VideoCard({ video, layout = 'grid' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(false)
  const [playlists, setPlaylists] = useState([])
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('')
  const [playlistLoading, setPlaylistLoading] = useState(false)
  const [playlistSaving, setPlaylistSaving] = useState(false)
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()

  const handleWatchLater = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    try {
      await videoService.addWatchLater(video.id)
      toast.success('Saved to Watch later')
    } catch {
      toast.error('Could not save')
    }
    setMenuOpen(false)
  }

  const loadPlaylists = async () => {
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    setPlaylistOpen(true)
    setPlaylistLoading(true)
    try {
      const { data } = await videoService.myPlaylists()
      setPlaylists(data.results || data)
    } catch {
      toast.error('Could not load playlists')
    } finally {
      setPlaylistLoading(false)
    }
  }

  const saveToPlaylist = async (playlistId) => {
    setPlaylistSaving(true)
    try {
      await videoService.addToPlaylist(playlistId, video.id)
      setPlaylists((items) => items.map((playlist) => (
        playlist.id === playlistId
          ? { ...playlist, videos: [...(playlist.videos || []), video], video_count: (playlist.video_count || 0) + 1 }
          : playlist
      )))
      toast.success('Saved to playlist')
      setMenuOpen(false)
      setPlaylistOpen(false)
    } catch {
      toast.error('Could not save to playlist')
    } finally {
      setPlaylistSaving(false)
    }
  }

  const createAndSavePlaylist = async (e) => {
    e.preventDefault()
    const title = newPlaylistTitle.trim()
    if (!title) return
    setPlaylistSaving(true)
    try {
      const { data: playlist } = await videoService.createPlaylist({ title, is_public: true })
      await videoService.addToPlaylist(playlist.id, video.id)
      setPlaylists((items) => [{ ...playlist, videos: [video], video_count: 1 }, ...items])
      toast.success('Created playlist and saved video')
      setNewPlaylistTitle('')
      setMenuOpen(false)
      setPlaylistOpen(false)
    } catch {
      toast.error('Could not create playlist')
    } finally {
      setPlaylistSaving(false)
    }
  }

  if (layout === 'list') {
    return (
      <Link to={`/watch/${video.id}`} className="group flex gap-3 rounded-lg p-1.5 transition-colors hover:bg-vt-chip/60">
        <ThumbnailBox video={video} className="w-40 flex-shrink-0 sm:w-64" compact />
        <div className="min-w-0 flex-1 py-1.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-vt-accent">
            {video.title}
          </h3>
          <ChannelInfo video={video} />
        </div>
      </Link>
    )
  }

  return (
    <div className="group animate-fade-in rounded-lg p-1.5 transition-colors hover:bg-vt-surface/50">
      <Link to={`/watch/${video.id}`} className="block">
        <ThumbnailBox video={video} />
      </Link>
      <div className="mt-3 flex gap-3 px-0.5 pb-1">
        <Link to={`/channel/${video.uploader?.username}`} className="flex-shrink-0">
          <img
            src={video.uploader?.avatar_url}
            alt={video.uploader?.display_name}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-vt-border/90"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/watch/${video.id}`}>
            <h3 className="line-clamp-2 text-sm font-medium leading-snug transition-colors hover:text-vt-accent">
              {video.title}
            </h3>
          </Link>
          <ChannelInfo video={video} />
        </div>
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMenuOpen(!menuOpen)
            }}
            className="btn-ghost h-8 w-8 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="glass-panel-strong absolute right-0 top-8 z-20 w-52 rounded-lg py-1 animate-fade-in">
              <button onClick={handleWatchLater} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-vt-chip transition-colors">
                <Clock size={16} /> Add to Watch later
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  loadPlaylists()
                }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-vt-chip transition-colors"
              >
                <BookmarkPlus size={16} /> Save to playlist
              </button>
              {playlistOpen && (
                <div className="border-t border-vt-border p-2">
                  {playlistLoading ? (
                    <p className="px-2 py-2 text-xs text-vt-muted">Loading playlists...</p>
                  ) : playlists.length > 0 ? (
                    <div className="max-h-36 overflow-y-auto">
                      {playlists.map((playlist) => {
                        const alreadySaved = (playlist.videos || []).some((item) => item.id === video.id)
                        return (
                        <button
                          key={playlist.id}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (!alreadySaved && !playlistSaving) saveToPlaylist(playlist.id)
                          }}
                          disabled={alreadySaved || playlistSaving}
                          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-vt-chip disabled:cursor-default disabled:text-vt-muted"
                        >
                          <span className="truncate">{playlist.title}</span>
                          {alreadySaved && <Check size={13} />}
                        </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="px-2 py-2 text-xs text-vt-muted">No playlists yet</p>
                  )}
                  <form onSubmit={createAndSavePlaylist} className="mt-2 flex gap-1">
                    <input
                      value={newPlaylistTitle}
                      onChange={(e) => setNewPlaylistTitle(e.target.value)}
                      onClick={(e) => e.preventDefault()}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="New playlist"
                      className="min-w-0 flex-1 rounded-md border border-vt-border bg-vt-surface/80 px-2 py-1 text-xs outline-none focus:border-vt-accent"
                    />
                    <button
                      className="btn-ghost rounded-md p-1 disabled:opacity-50"
                      title="Create playlist"
                      disabled={playlistSaving || !newPlaylistTitle.trim()}
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ThumbnailBox({ video, className = '', compact = false }) {
  const [loaded, setLoaded] = useState(!video.thumbnail_url)
  const [generatedThumbnail, setGeneratedThumbnail] = useState(null)
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    setLoaded(!video.thumbnail_url)
    setThumbnailFailed(false)
    setGeneratedThumbnail(null)
  }, [video.id, video.thumbnail_url])

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true)
    }
  }, [video.thumbnail_url])

  useEffect(() => {
    if (video.thumbnail_url && !thumbnailFailed) {
      setGeneratedThumbnail(null)
      return undefined
    }

    const sourceUrl = video.stream_url || video.url_720p || video.url_480p || video.url_360p || video.video_file
    if (!sourceUrl || typeof document === 'undefined') {
      setLoaded(true)
      return undefined
    }

    let cancelled = false
    const previewVideo = document.createElement('video')
    const canvas = document.createElement('canvas')

    previewVideo.preload = 'metadata'
    previewVideo.muted = true
    previewVideo.playsInline = true
    previewVideo.crossOrigin = 'anonymous'
    previewVideo.src = sourceUrl

    const cleanup = () => {
      previewVideo.pause()
      previewVideo.removeAttribute('src')
      previewVideo.load()
    }

    const captureFrame = () => {
      if (cancelled || !previewVideo.videoWidth || !previewVideo.videoHeight) return

      canvas.width = previewVideo.videoWidth
      canvas.height = previewVideo.videoHeight

      try {
        canvas.getContext('2d')?.drawImage(previewVideo, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
        if (!cancelled) {
          setGeneratedThumbnail(dataUrl)
          setLoaded(true)
        }
      } catch {
        if (!cancelled) setLoaded(true)
      } finally {
        cleanup()
      }
    }

    const handleLoadedMetadata = () => {
      const captureAt = Math.min(1, Math.max(previewVideo.duration / 3, 0))
      if (captureAt > 0) {
        previewVideo.currentTime = captureAt
      } else {
        captureFrame()
      }
    }

    const handleSeeked = () => captureFrame()
    const handleError = () => {
      if (!cancelled) setLoaded(true)
      cleanup()
    }

    previewVideo.addEventListener('loadedmetadata', handleLoadedMetadata)
    previewVideo.addEventListener('seeked', handleSeeked, { once: true })
    previewVideo.addEventListener('error', handleError)

    return () => {
      cancelled = true
      previewVideo.removeEventListener('loadedmetadata', handleLoadedMetadata)
      previewVideo.removeEventListener('seeked', handleSeeked)
      previewVideo.removeEventListener('error', handleError)
      cleanup()
    }
  }, [
    video.thumbnail_url,
    thumbnailFailed,
    video.stream_url,
    video.url_720p,
    video.url_480p,
    video.url_360p,
    video.video_file,
  ])

  const thumbnailSrc = (!thumbnailFailed && video.thumbnail_url) || generatedThumbnail
  const showFallback = !thumbnailSrc || (thumbnailFailed && !generatedThumbnail)

  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg bg-vt-surface shadow-[0_18px_50px_rgb(var(--vt-shadow)/0.13)] ring-1 ring-vt-border/80 ${className}`}>
      {!loaded && !showFallback && <div className="absolute inset-0 skeleton" />}
      {!showFallback ? (
        <img
          ref={imgRef}
          src={thumbnailSrc}
          alt={video.title}
          className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.025] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setThumbnailFailed(true)
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-vt-chip/80">
          <BrandMark className={`${compact ? 'h-8 w-8' : 'h-12 w-12'} opacity-60`} />
        </div>
      )}
      {video.duration_formatted && (
        <span className={`absolute bottom-2 right-2 rounded-full bg-black/75 px-2 py-0.5 text-xs font-medium text-white backdrop-blur ${compact ? 'text-[11px]' : ''}`}>
          {video.duration_formatted}
        </span>
      )}
      {video.status === 'processing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <span className="rounded-full bg-black/80 px-3 py-1 text-xs text-white">Processing...</span>
        </div>
      )}
    </div>
  )
}

function ChannelInfo({ video }) {
  return (
    <>
      <Link
        to={`/channel/${video.uploader?.username}`}
        className="mt-1 block text-xs text-vt-muted transition-colors hover:text-vt-text"
      >
        {video.uploader?.display_name}
        {video.uploader?.verified && (
          <VerifiedBadge className="ml-1 h-3 w-3 align-[-1px]" />
        )}
      </Link>
      <p className="text-xs text-vt-muted">
        {formatCount(video.views_count)} views - {formatTimeAgo(video.created_at)}
      </p>
    </>
  )
}
