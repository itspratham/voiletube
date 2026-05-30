import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { openAuthModal, openUploadModal } from '@/store/slices/uiSlice'
import { videoService } from '@/services/api'
import { formatCount, formatTimeAgo } from '@/utils/format'
import { Upload, Trash2, Eye, ThumbsUp, MessageSquare, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'
import BrandMark from '@/components/brand/BrandMark'

export default function StudioPage() {
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState('videos')

  const { data: videos = [], isLoading } = useQuery(
    ['studio-videos', user?.username],
    () => videoService.channelVideos(user?.username).then((r) => r.data.results || r.data),
    { enabled: !!user?.username }
  )

  const deleteMutation = useMutation(
    (id) => videoService.delete(id),
    {
      onSuccess: () => {
        toast.success('Video deleted')
        qc.invalidateQueries(['studio-videos'])
      },
      onError: () => toast.error('Delete failed'),
    }
  )

  if (!isAuthenticated) {
    return (
      <div className="page-empty px-4">
        <BarChart2 size={40} />
        <h2 className="text-xl font-semibold">Sign in to access Creator Studio</h2>
        <button onClick={() => dispatch(openAuthModal('login'))} className="btn-primary px-6 py-2.5">
          Sign in
        </button>
      </div>
    )
  }

  // Stats summary
  const totalViews = videos.reduce((a, v) => a + (v.views_count || 0), 0)
  const totalLikes = videos.reduce((a, v) => a + (v.likes_count || 0), 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="premium-surface mb-8 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="lux-eyebrow mb-2">Channel command</p>
          <h1 className="lux-section-title">Creator Studio</h1>
          <p className="text-vt-muted text-sm mt-0.5">Manage your channel and content</p>
        </div>
        <button
          onClick={() => dispatch(openUploadModal())}
          className="btn-primary flex items-center gap-2 px-5 py-2.5"
        >
          <Upload size={16} /> Upload video
        </button>
      </div>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total videos', value: videos.length, icon: BarChart2 },
          { label: 'Total views', value: formatCount(totalViews), icon: Eye },
          { label: 'Total likes', value: formatCount(totalLikes), icon: ThumbsUp },
          { label: 'Subscribers', value: formatCount(user?.subscribers_count), icon: MessageSquare },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="premium-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-vt-muted text-xs">{label}</span>
              <Icon size={16} className="text-vt-muted" />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-vt-border/80">
        {['videos', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 capitalize transition-colors ${
              activeTab === tab
                ? 'border-vt-text text-vt-text'
                : 'border-transparent text-vt-muted hover:text-vt-text'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Videos tab */}
      {activeTab === 'videos' && (
        <div>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 skeleton rounded-xl" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-20 text-vt-muted">
              <Upload size={40} className="mx-auto mb-3" />
              <p className="mb-4">No videos uploaded yet</p>
              <button onClick={() => dispatch(openUploadModal())} className="btn-primary">
                Upload your first video
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-vt-border/80 bg-vt-surface/60 shadow-[0_18px_54px_rgb(var(--vt-shadow)/0.08)]">
              {/* Table header */}
              <div className="hidden grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 bg-vt-surface/80 px-4 py-3 text-xs font-medium uppercase tracking-wide text-vt-muted sm:grid">
                <span>Video</span>
                <span>Visibility</span>
                <span>Views</span>
                <span>Likes</span>
                <span>Actions</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-vt-border">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="grid grid-cols-1 items-center gap-4 px-4 py-4 transition-colors hover:bg-vt-chip/50 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                  >
                    {/* Video info */}
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-vt-chip flex-shrink-0">
                        {video.thumbnail_url ? (
                          <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-vt-muted">
                            <BrandMark className="h-9 w-9 opacity-60" />
                          </div>
                        )}
                        {video.status === 'processing' && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-[10px] text-white">Processing</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm line-clamp-2">{video.title}</p>
                        <p className="text-xs text-vt-muted mt-0.5">{formatTimeAgo(video.created_at)}</p>
                      </div>
                    </div>

                    {/* Visibility */}
                    <div>
                      <StatusBadge status={video.status} />
                    </div>

                    {/* Views */}
                    <div className="text-sm">{formatCount(video.views_count)}</div>

                    {/* Likes */}
                    <div className="text-sm">{formatCount(video.likes_count)}</div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/watch/${video.id}`)}
                        className="btn-ghost p-2 rounded-full"
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Delete this video permanently?')) {
                            deleteMutation.mutate(video.id)
                          }
                        }}
                        className="btn-ghost p-2 rounded-full text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="premium-surface p-6">
            <h3 className="font-medium mb-4">Top videos by views</h3>
            {[...videos]
              .sort((a, b) => b.views_count - a.views_count)
              .slice(0, 5)
              .map((v, i) => (
                <div key={v.id} className="flex items-center gap-3 mb-3 last:mb-0">
                  <span className="text-vt-muted text-sm w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{v.title}</p>
                    <div className="h-1 bg-vt-chip rounded mt-1">
                      <div
                        className="h-full bg-vt-accent rounded"
                        style={{
                          width: `${videos[0]?.views_count ? (v.views_count / videos[0].views_count) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-vt-muted flex-shrink-0">{formatCount(v.views_count)}</span>
                </div>
              ))}
          </div>

          <div className="premium-surface p-6">
            <h3 className="font-medium mb-4">Top videos by likes</h3>
            {[...videos]
              .sort((a, b) => b.likes_count - a.likes_count)
              .slice(0, 5)
              .map((v, i) => (
                <div key={v.id} className="flex items-center gap-3 mb-3 last:mb-0">
                  <span className="text-vt-muted text-sm w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{v.title}</p>
                    <div className="h-1 bg-vt-chip rounded mt-1">
                      <div
                        className="h-full bg-vt-accent/70 rounded"
                        style={{
                          width: `${videos[0]?.likes_count ? (v.likes_count / videos[0].likes_count) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-vt-muted flex-shrink-0">{formatCount(v.likes_count)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    published: 'bg-green-500/15 text-green-400',
    processing: 'bg-yellow-500/15 text-yellow-400',
    private: 'bg-vt-chip text-vt-muted',
    unlisted: 'bg-vt-accent/15 text-vt-accent',
    failed: 'bg-red-500/15 text-red-400',
  }
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${styles[status] || styles.private}`}>
      {status}
    </span>
  )
}
