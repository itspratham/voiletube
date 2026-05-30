import VideoCard from './VideoCard'
import { Film } from 'lucide-react'

export function VideoGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="aspect-video skeleton mb-3 rounded-lg" />
          <div className="flex gap-3">
            <div className="w-9 h-9 skeleton rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton rounded w-full" />
              <div className="h-3 skeleton rounded w-2/3" />
              <div className="h-3 skeleton rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function VideoGrid({ videos = [], loading = false, emptyMessage = 'No videos found' }) {
  if (loading) return <VideoGridSkeleton />

  if (!videos.length) {
    return (
      <div className="page-empty">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-vt-border bg-vt-surface/70 shadow-[0_16px_48px_rgb(var(--vt-shadow)/0.08)]">
          <Film size={28} />
        </div>
        <p className="text-base">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
