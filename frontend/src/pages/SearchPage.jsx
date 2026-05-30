import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from 'react-query'
import InfiniteScroll from 'react-infinite-scroll-component'
import { videoService } from '@/services/api'
import VideoCard from '@/components/video/VideoCard'
import { VideoGridSkeleton } from '@/components/video/VideoGrid'
import { Search, SlidersHorizontal, User as UserIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'recent', label: 'Upload date' },
  { value: 'views', label: 'View count' },
  { value: 'likes', label: 'Rating' },
]

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const category = searchParams.get('category') || ''
  const [sort, setSort] = useState('relevance')
  const categoryLabel = category ? category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : ''

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery(
    ['search', q, category, sort],
    ({ pageParam = 1 }) => {
      if (q) return videoService.search({ q, sort, category, page: pageParam }).then((r) => r.data)
      return videoService.getAll({ category, ordering: sort === 'recent' ? '-created_at' : undefined, page: pageParam })
        .then((r) => {
          const results = r.data.results || r.data
          return { results, count: r.data.count || results.length, next: r.data.next }
        })
    },
    { 
      enabled: !!q || !!category,
      getNextPageParam: (lastPage) => {
        if (lastPage.next) {
          const url = new URL(lastPage.next)
          const page = url.searchParams.get('page')
          return page ? Number(page) : undefined
        }
        return undefined
      }
    }
  )

  const videos = data?.pages.flatMap((page) => page.results || page) || []
  const channels = data?.pages[0]?.channels || []
  const count = data?.pages[0]?.count

  return (
    <div className="lux-page">
      <div className="mx-auto w-full max-w-6xl">
      {(q || category) && (
        <div className="premium-surface mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <p className="text-sm text-vt-muted">
            {count != null ? `About ${count} results` : 'Results'}
            {q ? (
              <> for <span className="text-vt-text font-medium">"{q}"</span></>
            ) : (
              <> in <span className="text-vt-text font-medium">{categoryLabel}</span></>
            )}
          </p>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-vt-muted" />
            <span className="text-sm text-vt-muted">Sort by:</span>
            <div className="flex gap-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSort(opt.value)}
                  className={sort === opt.value ? 'chip-active text-xs' : 'chip text-xs'}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!q && !category ? (
        <div className="page-empty">
          <Search size={38} />
          <p>Search for videos, channels, and more</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-64 aspect-video skeleton rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-2">
                <div className="h-5 skeleton rounded w-3/4" />
                <div className="h-3 skeleton rounded w-1/3" />
                <div className="h-3 skeleton rounded w-1/4" />
                <div className="h-4 skeleton rounded w-full mt-3" />
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 && channels.length === 0 ? (
        <div className="page-empty">
          <Search size={38} />
          <p>{q ? `No results found for "${q}"` : `No videos found in ${categoryLabel}`}</p>
        </div>
      ) : (
        <InfiniteScroll
          dataLength={videos.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={<div className="py-8 text-center text-sm text-vt-muted">Loading more...</div>}
          style={{ overflow: 'visible' }}
        >
          <div className="space-y-4">
            {channels.length > 0 && (
              <div className="mb-6 space-y-4 border-b border-vt-border pb-6">
                {channels.map((channel) => (
                  <ChannelResultCard key={channel.id} channel={channel} />
                ))}
              </div>
            )}
            
            {videos.map((video) => (
              <SearchResultCard key={video.id} video={video} />
            ))}
          </div>
        </InfiniteScroll>
      )}
      </div>
    </div>
  )
}

function SearchResultCard({ video }) {
  return (
    <div className="flex gap-4 group">
      <VideoCard video={video} layout="list" />
    </div>
  )
}

function ChannelResultCard({ channel }) {
  return (
    <Link to={`/channel/${channel.username}`} className="flex items-center gap-6 group hover:bg-vt-surface/40 p-4 rounded-xl transition">
      <div className="h-32 w-32 flex-shrink-0 mx-auto md:mx-0">
        {channel.avatar_url ? (
          <img src={channel.avatar_url} alt={channel.display_name} className="h-full w-full rounded-full object-cover" />
        ) : (
          <div className="h-full w-full rounded-full bg-vt-surface border border-vt-border flex items-center justify-center">
            <UserIcon size={48} className="text-vt-muted" />
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-xl font-medium text-vt-text">{channel.display_name || channel.channel_name || channel.username}</h3>
        <p className="text-sm text-vt-muted mt-1 flex items-center gap-2">
          <span>@{channel.username}</span>
          <span>•</span>
          <span>{channel.subscribers_count} subscribers</span>
        </p>
        {channel.bio && (
          <p className="text-sm text-vt-muted mt-2 line-clamp-2 max-w-2xl">{channel.bio}</p>
        )}
      </div>
    </Link>
  )
}
