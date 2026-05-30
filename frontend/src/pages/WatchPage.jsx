import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useDispatch, useSelector } from 'react-redux'
import { ThumbsUp, ThumbsDown, Share2, BookmarkPlus, BookmarkCheck, Bell, BellOff, Copy, X } from 'lucide-react'
import { videoService, subscriptionService } from '@/services/api'
import { openAuthModal } from '@/store/slices/uiSlice'
import VideoPlayer from '@/components/player/VideoPlayer'
import CommentsSection from '@/components/comments/CommentsSection'
import VideoCard from '@/components/video/VideoCard'
import VerifiedBadge from '@/components/brand/VerifiedBadge'
import { formatCount, formatTimeAgo } from '@/utils/format'
import toast from 'react-hot-toast'

export default function WatchPage() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  const qc = useQueryClient()
  const [descExpanded, setDescExpanded] = useState(false)
  const [likeStatus, setLikeStatus] = useState(null)
  const [likeCounts, setLikeCounts] = useState({ likes: 0, dislikes: 0 })
  const [inWatchLater, setInWatchLater] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [theaterMode, setTheaterMode] = useState(false)
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem('vt-autoplay') === 'true')
  const navigate = useNavigate()

  const toggleAutoplay = () => {
    const nextAutoplay = !autoplay
    setAutoplay(nextAutoplay)
    localStorage.setItem('vt-autoplay', String(nextAutoplay))
  }

  const { data: video, isLoading, error } = useQuery(
    ['video', id],
    () => videoService.getById(id).then((r) => r.data),
    {
      enabled: !!id,
      onSuccess: (data) => {
        setLikeStatus(data.user_like_status)
        setLikeCounts({ likes: data.likes_count, dislikes: data.dislikes_count })
        setInWatchLater(Boolean(data.is_in_watch_later))
        if (isAuthenticated) qc.invalidateQueries('history')
      },
    }
  )

  const { data: related = [] } = useQuery(
    ['videos-related', id],
    () => videoService.getAll().then((r) => (r.data.results || r.data).filter((v) => v.id !== id).slice(0, 20)),
    { staleTime: 120000, enabled: !!id }
  )

  const likeMutation = useMutation(
    (action) => videoService.like(id, action),
    {
      onMutate: (action) => {
        const previousStatus = likeStatus
        const previousCounts = likeCounts
        const nextStatus = previousStatus === action ? null : action
        const nextCounts = { ...previousCounts }

        if (previousStatus === 'like') nextCounts.likes = Math.max(0, nextCounts.likes - 1)
        if (previousStatus === 'dislike') nextCounts.dislikes = Math.max(0, nextCounts.dislikes - 1)
        if (nextStatus === 'like') nextCounts.likes += 1
        if (nextStatus === 'dislike') nextCounts.dislikes += 1

        setLikeStatus(nextStatus)
        setLikeCounts(nextCounts)

        return { previousStatus, previousCounts }
      },
      onSuccess: (res) => {
        setLikeStatus(res.data.action)
        setLikeCounts({ likes: res.data.likes, dislikes: res.data.dislikes })
        qc.invalidateQueries(['video', id])
        qc.invalidateQueries(['videos-related', id])
        qc.invalidateQueries('videos')
        qc.invalidateQueries('liked-videos')
      },
      onError: (_, __, context) => {
        if (context) {
          setLikeStatus(context.previousStatus)
          setLikeCounts(context.previousCounts)
        }
        toast.error('Could not update like')
      },
    }
  )

  const subscribeMutation = useMutation(
    (subscribed) =>
      subscribed
        ? subscriptionService.unsubscribe(video?.uploader?.username)
        : subscriptionService.subscribe(video?.uploader?.username),
    {
      onSuccess: (_, subscribed) => {
        toast.success(subscribed ? 'Unsubscribed' : 'Subscribed!')
        qc.invalidateQueries(['video', id])
        qc.invalidateQueries('feed')
      },
    }
  )

  const watchLaterMutation = useMutation(
    (nextSaved) => nextSaved ? videoService.addWatchLater(id) : videoService.removeWatchLater(id),
    {
      onMutate: (nextSaved) => {
        const previousSaved = inWatchLater
        setInWatchLater(nextSaved)
        return { previousSaved }
      },
      onSuccess: (_, nextSaved) => {
        toast.success(nextSaved ? 'Saved to Watch later' : 'Removed from Watch later')
        qc.invalidateQueries(['video', id])
        qc.invalidateQueries('watch-later')
      },
      onError: (_, __, context) => {
        if (context) setInWatchLater(context.previousSaved)
        toast.error('Could not update Watch later')
      },
    }
  )

  const handleLike = (action) => {
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    likeMutation.mutate(action)
  }

  const handleSubscribe = () => {
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    subscribeMutation.mutate(video?.uploader?.is_subscribed)
  }

  const handleWatchLater = () => {
    if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
    watchLaterMutation.mutate(!inWatchLater)
  }

  const handleShare = () => {
    setShareOpen(true)
  }

  const handleCopyShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied!')
  }

  if (isLoading) return <WatchSkeleton />
  if (error || !video) return (
    <div className="flex items-center justify-center py-32 text-vt-muted">
      <p>Video not found or unavailable.</p>
    </div>
  )

  const isOwner = isAuthenticated && user?.id === video.uploader?.id

  return (
    <div className={theaterMode ? 'w-full py-6' : 'mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8'}>
      <div className={`flex gap-7 ${theaterMode ? 'flex-col' : 'flex-col xl:flex-row'}`}>
        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* Player */}
          <div className={theaterMode ? 'w-full bg-black' : ''}>
            <div className={theaterMode ? 'mx-auto w-full max-w-[1800px]' : ''}>
              <VideoPlayer
                video={video}
                isTheater={theaterMode}
                onToggleTheater={() => setTheaterMode(!theaterMode)}
                onEnded={() => {
                  if (autoplay && related.length > 0) {
                    navigate(`/watch/${related[0].id}`)
                  }
                }}
              />
            </div>
          </div>

          {/* Video info */}
          <div className={theaterMode ? 'mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 mt-5' : 'mt-5'}>
            <h1 className="text-2xl font-semibold leading-tight tracking-normal">{video.title}</h1>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {/* Channel info */}
              <div className="flex items-center gap-3">
                <Link to={`/channel/${video.uploader?.username}`}>
                  <img src={video.uploader?.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                </Link>
                <div>
                  <Link to={`/channel/${video.uploader?.username}`} className="font-medium text-sm hover:text-vt-accent transition-colors">
                    {video.uploader?.display_name}
                    {video.uploader?.verified && <VerifiedBadge className="ml-1 h-3 w-3 align-[-1px]" />}
                  </Link>
                  <p className="text-xs text-vt-muted">{formatCount(video.uploader?.subscribers_count)} subscribers</p>
                </div>
                <button
                  onClick={handleSubscribe}
                  className={`ml-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    video.uploader?.is_subscribed
                      ? 'bg-vt-chip text-vt-muted hover:bg-vt-chip-hover flex items-center gap-2'
                      : 'bg-vt-accent text-white hover:bg-vt-accent-hover'
                  }`}
                >
                  {video.uploader?.is_subscribed ? (
                    <><BellOff size={14} /> Subscribed</>
                  ) : 'Subscribe'}
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Like / Dislike */}
                <div className="flex overflow-hidden rounded-full border border-vt-border/70 bg-vt-chip/80">
                  <button
                    onClick={() => handleLike('like')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-vt-chip-hover transition-colors border-r border-vt-border ${
                      likeStatus === 'like' ? 'text-vt-accent' : ''
                    }`}
                  >
                    <ThumbsUp size={16} fill={likeStatus === 'like' ? 'currentColor' : 'none'} />
                    {formatCount(likeCounts.likes)}
                  </button>
                  <button
                    onClick={() => handleLike('dislike')}
                    className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-vt-chip-hover transition-colors ${
                      likeStatus === 'dislike' ? 'text-red-400' : ''
                    }`}
                  >
                    <ThumbsDown size={16} fill={likeStatus === 'dislike' ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <button onClick={handleShare} className="btn-secondary flex items-center gap-2">
                  <Share2 size={16} /> Share
                </button>

                <button
                  onClick={handleWatchLater}
                  disabled={watchLaterMutation.isLoading}
                  className={`btn-secondary flex items-center gap-2 ${inWatchLater ? 'text-vt-accent' : ''}`}
                >
                  {inWatchLater ? <BookmarkCheck size={16} /> : <BookmarkPlus size={16} />}
                  {inWatchLater ? 'Saved' : 'Save'}
                </button>

                {isOwner && (
                  <Link to="/studio" className="btn-secondary flex items-center gap-2">
                    Edit
                  </Link>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="premium-surface mt-5 p-5">
              <p className="text-sm text-vt-muted mb-1">
                {formatCount(video.views_count)} views · {formatTimeAgo(video.created_at)}
                {video.category && ` · ${video.category.name}`}
              </p>
              <div className={`text-sm whitespace-pre-wrap overflow-hidden transition-all ${descExpanded ? '' : 'line-clamp-3'}`}>
                {video.description || 'No description provided.'}
              </div>
              {video.description && video.description.length > 200 && (
                <button onClick={() => setDescExpanded(!descExpanded)} className="text-sm font-medium mt-2">
                  {descExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
              {video.tags?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {video.tags.map((t) => (
                    <span key={t.id} className="text-xs text-vt-accent">#{t.name}</span>
                  ))}
                </div>
              )}
            </div>

          {/* Comments */}
          {video.allow_comments && (
            <CommentsSection videoId={id} commentsCount={video.comments_count} />
          )}
          </div>
        </div>

        {/* Sidebar — related videos */}
        <aside className={theaterMode ? 'mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'flex-shrink-0 xl:w-[420px]'}>
          <div className="mb-4 hidden items-center justify-between xl:flex">
            <div>
              <p className="lux-eyebrow">Continue watching</p>
              <h2 className="mt-1 font-semibold">Up next</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-vt-muted">Autoplay</span>
              <button
                onClick={toggleAutoplay}
                className={`relative h-5 w-9 rounded-full transition-colors ${autoplay ? 'bg-vt-accent' : 'bg-vt-chip'}`}
              >
                <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${autoplay ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
          <div className={theaterMode ? 'contents' : 'flex flex-col gap-3'}>
            {related.map((v) => (
              <VideoCard key={v.id} video={v} layout={theaterMode ? 'grid' : 'list'} />
            ))}
          </div>
        </aside>
      </div>
      {shareOpen && (
        <ShareDialog
          video={video}
          url={window.location.href}
          onCopy={handleCopyShareLink}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  )
}

function ShareDialog({ video, url, onCopy, onClose }) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(video.title || 'ViewTube video')
  const shareTargets = [
    { label: 'WhatsApp', icon: 'whatsapp', href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
    { label: 'X', icon: 'x', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { label: 'Facebook', icon: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: 'Email', icon: 'email', href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-vt-border bg-vt-surface p-5 shadow-[0_28px_90px_rgb(var(--vt-shadow)/0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Share</h2>
          <button onClick={onClose} className="btn-ghost h-9 w-9 rounded-full p-0" aria-label="Close share dialog">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {shareTargets.map((target) => (
            <a
              key={target.label}
              href={target.href}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-20 flex-col items-center gap-2 text-xs text-vt-muted transition-colors hover:text-vt-text"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vt-chip text-vt-text">
                <ShareIcon name={target.icon} />
              </span>
              {target.label}
            </a>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-full border border-vt-border bg-vt-bg/70 p-1.5">
          <input
            value={url}
            readOnly
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-vt-muted outline-none"
            onFocus={(e) => e.target.select()}
          />
          <button onClick={onCopy} className="btn-primary flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            <Copy size={15} /> Copy
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareIcon({ name }) {
  if (name === 'whatsapp') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2a9.86 9.86 0 0 0-8.46 14.94L2.48 22l5.18-1.35A9.94 9.94 0 1 0 12.04 2Zm0 1.8a8.14 8.14 0 0 1 6.92 12.42 8.07 8.07 0 0 1-9.96 2.7l-.37-.18-3.08.8.82-3-.2-.39A8.05 8.05 0 0 1 12.04 3.8Zm-3.5 4.1c-.18 0-.47.07-.72.34-.25.27-.94.92-.94 2.24 0 1.32.97 2.6 1.1 2.78.13.18 1.88 3 4.64 4.08 2.3.9 2.77.72 3.27.67.5-.05 1.62-.66 1.85-1.3.23-.64.23-1.18.16-1.3-.07-.11-.25-.18-.53-.32-.27-.14-1.62-.8-1.87-.9-.25-.09-.43-.14-.61.14-.18.27-.7.9-.86 1.08-.16.18-.32.2-.6.07-.27-.14-1.15-.42-2.18-1.34-.8-.72-1.35-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.04-.22-.52-.45-.45-.62-.46h-.52Z" />
      </svg>
    )
  }
  if (name === 'x') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M17.53 3h3.18l-6.95 7.95L21.94 21h-6.4l-5.02-6.56L4.78 21H1.6l7.43-8.5L1.2 3h6.56l4.53 5.99L17.53 3Zm-1.12 16.23h1.76L6.8 4.68H4.91l11.5 14.55Z" />
      </svg>
    )
  }
  if (name === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.78-3.91 1.1 0 2.24.2 2.24.2V8.6H15.2c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22A10.04 10.04 0 0 0 22 12.06Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  )
}

function WatchSkeleton() {
  return (
    <div className="max-w-[1800px] mx-auto px-4 py-6">
      <div className="flex gap-6 flex-col xl:flex-row">
        <div className="flex-1 min-w-0 space-y-4">
          <div className="aspect-video skeleton rounded-xl" />
          <div className="h-7 skeleton rounded w-3/4" />
          <div className="flex gap-3">
            <div className="w-10 h-10 skeleton rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton rounded w-40" />
              <div className="h-3 skeleton rounded w-24" />
            </div>
          </div>
        </div>
        <aside className="xl:w-96 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-40 aspect-video skeleton rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded" />
                <div className="h-3 skeleton rounded w-2/3" />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}
