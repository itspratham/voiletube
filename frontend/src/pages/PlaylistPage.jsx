import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { useSelector } from 'react-redux'
import { Play, Share2, Edit2, Check, X, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { videoService } from '@/services/api'
import { formatTimeAgo } from '@/utils/format'
import toast from 'react-hot-toast'

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, isAuthenticated } = useSelector((s) => s.auth)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const { data: playlist, isLoading } = useQuery(
    ['playlist', id],
    () => videoService.getPlaylist(id).then((r) => r.data),
    {
      onSuccess: (data) => {
        setEditTitle(data.title)
        setEditDesc(data.description)
      },
    }
  )

  const isOwner = isAuthenticated && user?.username === playlist?.owner?.username

  const updateMutation = useMutation(
    (data) => videoService.updatePlaylist(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['playlist', id])
        setIsEditing(false)
        toast.success('Playlist updated')
      },
      onError: () => toast.error('Failed to update playlist'),
    }
  )

  const reorderMutation = useMutation(
    ({ videoId, position }) => videoService.reorderPlaylistVideo(id, videoId, position),
    {
      onSuccess: () => queryClient.invalidateQueries(['playlist', id]),
    }
  )

  const removeMutation = useMutation(
    (videoId) => videoService.removeFromPlaylist(id, videoId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['playlist', id])
        toast.success('Removed from playlist')
      },
    }
  )

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  const handleSaveEdit = () => {
    updateMutation.mutate({ title: editTitle, description: editDesc })
  }

  const handleMove = (index, direction) => {
    if (!playlist) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= playlist.videos.length) return
    
    // We update the position of the current video to the new index.
    // The backend will handle the swap.
    const videoId = playlist.videos[index].id
    reorderMutation.mutate({ videoId, position: newIndex })
  }

  if (isLoading) {
    return <div className="p-8 text-center text-vt-muted">Loading playlist...</div>
  }

  if (!playlist) {
    return <div className="p-8 text-center text-vt-muted">Playlist not found.</div>
  }

  return (
    <div className="lux-page max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Left Column - Details */}
      <div className="md:w-80 flex-shrink-0">
        <div className="sticky top-[100px] rounded-xl bg-vt-surface/60 p-6 backdrop-blur shadow-[0_24px_70px_rgb(var(--vt-shadow)/0.08)] border border-vt-border/80">
          <div className="aspect-video w-full rounded-lg overflow-hidden bg-black mb-4">
            {playlist.thumbnail ? (
              <img src={playlist.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-vt-chip">
                <span className="text-vt-muted">No videos</span>
              </div>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-3 mb-4">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-vt-bg border border-vt-border rounded px-3 py-2 text-sm focus:border-vt-accent outline-none"
                placeholder="Playlist Title"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full bg-vt-bg border border-vt-border rounded px-3 py-2 text-sm focus:border-vt-accent outline-none min-h-[80px]"
                placeholder="Description"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="btn-primary flex-1 py-1.5" disabled={updateMutation.isLoading}>
                  <Check size={16} className="mr-1" /> Save
                </button>
                <button onClick={() => setIsEditing(false)} className="btn-secondary py-1.5 px-3">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <h1 className="text-2xl font-bold mb-2">{playlist.title}</h1>
              <div className="text-sm text-vt-muted mb-4">
                <p>{playlist.owner.display_name}</p>
                <p>{playlist.video_count} videos • Updated {formatTimeAgo(playlist.created_at)}</p>
              </div>
              {playlist.description && (
                <p className="text-sm mb-4 text-vt-text">{playlist.description}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (playlist.videos.length > 0) {
                  navigate(`/watch/${playlist.videos[0].id}?list=${playlist.id}`)
                } else {
                  toast.error('Playlist is empty')
                }
              }}
              className="btn-primary flex-1"
            >
              <Play size={18} fill="currentColor" /> Play all
            </button>
            <button onClick={handleShare} className="btn-secondary p-2 rounded-full" title="Share">
              <Share2 size={18} />
            </button>
            {isOwner && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="btn-secondary p-2 rounded-full" title="Edit">
                <Edit2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Videos */}
      <div className="flex-1">
        {playlist.videos.length === 0 ? (
          <div className="py-12 text-center text-vt-muted">
            <p>No videos in this playlist yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {playlist.videos.map((video, index) => (
              <div key={video.id} className="group flex items-center gap-4 rounded-lg p-2 hover:bg-vt-surface/50 transition-colors">
                <div className="w-8 text-center text-sm font-medium text-vt-muted tabular-nums">
                  {index + 1}
                </div>
                
                <Link to={`/watch/${video.id}?list=${playlist.id}`} className="flex flex-1 items-center gap-4 min-w-0">
                  <div className="relative aspect-video w-40 flex-shrink-0 rounded bg-vt-chip overflow-hidden">
                    {video.thumbnail_url && (
                      <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    )}
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[10px] text-white">
                      {video.duration_formatted}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="line-clamp-2 text-sm font-medium">{video.title}</h3>
                    <p className="text-xs text-vt-muted mt-1">{video.uploader.display_name}</p>
                  </div>
                </Link>

                {isOwner && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex flex-col gap-1 mr-2">
                      <button 
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0 || reorderMutation.isLoading}
                        className="p-1 hover:bg-vt-chip rounded disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button 
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === playlist.videos.length - 1 || reorderMutation.isLoading}
                        className="p-1 hover:bg-vt-chip rounded disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeMutation.mutate(video.id)}
                      className="p-2 text-vt-muted hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Remove from playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
