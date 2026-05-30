import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useSelector, useDispatch } from 'react-redux'
import { userService, videoService, subscriptionService } from '@/services/api'
import { openAuthModal } from '@/store/slices/uiSlice'
import VideoGrid from '@/components/video/VideoGrid'
import { formatCount } from '@/utils/format'
import VerifiedBadge from '@/components/brand/VerifiedBadge'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

const TABS = ['Videos', 'Playlists', 'About']

export default function ChannelPage() {
  const { username } = useParams()
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('Videos')

  const { data: channel, isLoading: channelLoading } = useQuery(
    ['channel', username],
    () => userService.getProfile(username).then((r) => r.data)
  )

  const { data: videos = [], isLoading: videosLoading } = useQuery(
    ['channel-videos', username],
    () => videoService.channelVideos(username).then((r) => r.data.results || r.data),
    { enabled: activeTab === 'Videos' }
  )

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery(
    ['channel-playlists', username],
    () => videoService.channelPlaylists(username).then((r) => r.data.results || r.data),
    { enabled: activeTab === 'Playlists' }
  )

  const subscribeMutation = useMutation(
    () => channel?.is_subscribed
      ? subscriptionService.unsubscribe(username)
      : subscriptionService.subscribe(username),
    {
      onSuccess: () => {
        toast.success(channel?.is_subscribed ? 'Unsubscribed' : 'Subscribed!')
        qc.invalidateQueries(['channel', username])
        qc.invalidateQueries('feed')
      },
    }
  )

  if (channelLoading) return <ChannelSkeleton />

  return (
    <div className="pb-8">
      {/* Banner */}
      <div className="h-40 overflow-hidden bg-gradient-to-r from-vt-surface-soft via-vt-chip to-vt-surface sm:h-56">
        {channel?.banner && (
          <img src={channel.banner} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Channel header */}
      <div className="mx-auto max-w-6xl px-4">
        <div className="premium-surface mb-6 -mt-12 flex flex-col gap-4 p-5 sm:-mt-14 sm:flex-row sm:items-end">
          <img
            src={channel?.avatar_url}
            alt={channel?.display_name}
            className="h-24 w-24 rounded-full border-4 border-vt-bg object-cover shadow-[0_18px_48px_rgb(var(--vt-shadow)/0.16)] sm:h-32 sm:w-32"
          />
          <div className="flex-1 pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {channel?.display_name}
                  {channel?.verified && <VerifiedBadge className="h-4 w-4" />}
                </h1>
                <p className="text-vt-muted text-sm mt-0.5">
                  @{channel?.username} · {formatCount(channel?.subscribers_count)} subscribers · {videos.length} videos
                </p>
              </div>
              <button
                onClick={() => {
                  if (!isAuthenticated) { dispatch(openAuthModal('login')); return }
                  subscribeMutation.mutate()
                }}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  channel?.is_subscribed
                    ? 'bg-vt-chip text-vt-muted hover:bg-vt-chip-hover'
                    : 'bg-vt-accent text-white hover:bg-vt-accent-hover'
                }`}
              >
                {channel?.is_subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex border-b border-vt-border/80">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-vt-text text-vt-text'
                  : 'border-transparent text-vt-muted hover:text-vt-text'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Videos' && (
          <VideoGrid videos={videos} loading={videosLoading} emptyMessage="No public videos" />
        )}
        {activeTab === 'About' && (
          <div className="premium-surface max-w-lg space-y-4 p-5">
            {channel?.bio && (
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-vt-muted text-sm whitespace-pre-wrap">{channel.bio}</p>
              </div>
            )}
            <div>
              <h3 className="font-medium mb-2">Stats</h3>
              <p className="text-vt-muted text-sm">{formatCount(channel?.total_views)} total views</p>
            </div>
            {channel?.website && (
              <div>
                <h3 className="font-medium mb-2">Links</h3>
                <a href={channel.website} target="_blank" rel="noreferrer" className="text-vt-accent text-sm hover:underline">
                  {channel.website}
                </a>
              </div>
            )}
          </div>
        )}
        {activeTab === 'Playlists' && (
          <PlaylistGrid playlists={playlists} loading={playlistsLoading} />
        )}
      </div>
    </div>
  )
}

function PlaylistGrid({ playlists, loading }) {
  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-video skeleton rounded-xl" />
            <div className="h-4 skeleton rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!playlists.length) {
    return (
      <div className="text-center py-16 text-vt-muted">
        <p>No public playlists yet</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {playlists.map((playlist) => {
        const firstVideo = playlist.videos?.[0]
        return (
          <Link
            key={playlist.id}
            to={`/playlist/${playlist.id}`}
            className="group rounded-lg p-1.5 transition-colors hover:bg-vt-surface/50"
          >
            <div className="relative aspect-video overflow-hidden rounded-lg bg-vt-surface shadow-[0_18px_50px_rgb(var(--vt-shadow)/0.12)] ring-1 ring-vt-border/80">
              {playlist.thumbnail ? (
                <img src={playlist.thumbnail} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-vt-muted">Playlist</div>
              )}
              <div className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-black/70 text-sm font-medium text-white">
                {formatCount(playlist.video_count)} videos
              </div>
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-vt-accent">{playlist.title}</h3>
            {playlist.description && (
              <p className="mt-1 line-clamp-2 text-xs text-vt-muted">{playlist.description}</p>
            )}
          </Link>
        )
      })}
    </div>
  )
}

function ChannelSkeleton() {
  return (
    <div>
      <div className="h-48 skeleton" />
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-4 -mt-12 mb-6">
          <div className="w-32 h-32 skeleton rounded-full border-4 border-vt-bg" />
          <div className="flex-1 pb-2 pt-14 space-y-2">
            <div className="h-6 skeleton rounded w-48" />
            <div className="h-4 skeleton rounded w-64" />
          </div>
        </div>
      </div>
    </div>
  )
}
