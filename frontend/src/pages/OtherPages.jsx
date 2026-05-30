import { useQuery, useInfiniteQuery } from 'react-query'
import InfiniteScroll from 'react-infinite-scroll-component'
import { useSelector, useDispatch } from 'react-redux'
import { Clock, Flame, Heart, PlaySquare, Tv } from 'lucide-react'
import { videoService } from '@/services/api'
import VideoGrid from '@/components/video/VideoGrid'
import { openAuthModal } from '@/store/slices/uiSlice'

export function TrendingPage() {
  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery(
    'trending',
    ({ pageParam = 1 }) => videoService.trending({ page: pageParam }).then((r) => r.data),
    {
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

  return (
    <PageShell eyebrow="Live pulse" title="Trending" icon={Flame}>
      <InfiniteScroll
        dataLength={videos.length}
        next={fetchNextPage}
        hasMore={!!hasNextPage}
        loader={<div className="py-8 text-center text-sm text-vt-muted">Loading more...</div>}
        style={{ overflow: 'visible' }}
      >
        <VideoGrid videos={videos} loading={isLoading} emptyMessage="No trending videos" />
      </InfiniteScroll>
    </PageShell>
  )
}

export function SubscriptionsPage() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery(
    'feed',
    ({ pageParam = 1 }) => videoService.feed({ page: pageParam }).then((r) => r.data),
    { 
      enabled: isAuthenticated,
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

  if (!isAuthenticated) {
    return (
      <div className="page-empty px-4">
        <Tv size={40} />
        <h2 className="text-xl font-semibold">Don't miss new videos from your favorite channels</h2>
        <p className="text-vt-muted">Sign in to see updates from channels you subscribe to.</p>
        <button onClick={() => dispatch(openAuthModal('login'))} className="btn-primary px-6 py-2.5">
          Sign in
        </button>
      </div>
    )
  }

  const videos = data?.pages.flatMap((page) => page.results || page) || []

  return (
    <PageShell eyebrow="Your network" title="Subscriptions" icon={Tv}>
      <InfiniteScroll
        dataLength={videos.length}
        next={fetchNextPage}
        hasMore={!!hasNextPage}
        loader={<div className="py-8 text-center text-sm text-vt-muted">Loading more...</div>}
        style={{ overflow: 'visible' }}
      >
        <VideoGrid videos={videos} loading={isLoading} emptyMessage="Subscribe to channels to see their latest videos" />
      </InfiniteScroll>
    </PageShell>
  )
}

export function HistoryPage() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const { data = [], isLoading } = useQuery(
    'history',
    () => videoService.history().then((r) => r.data),
    { enabled: isAuthenticated }
  )

  if (!isAuthenticated) {
    return (
      <div className="page-empty px-4">
        <Clock size={40} />
        <h2 className="text-xl font-semibold">Keep track of what you watch</h2>
        <button onClick={() => dispatch(openAuthModal('login'))} className="btn-primary px-6 py-2.5">Sign in</button>
      </div>
    )
  }

  return (
    <PageShell eyebrow="Personal archive" title="Watch history" icon={Clock}>
      <VideoGrid videos={data} loading={isLoading} emptyMessage="Your watch history is empty" />
    </PageShell>
  )
}

export function WatchLaterPage() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const { data = [], isLoading } = useQuery(
    'watch-later',
    () => videoService.watchLaterList().then((r) => r.data.results || r.data),
    { enabled: isAuthenticated }
  )

  if (!isAuthenticated) {
    return (
      <div className="page-empty px-4">
        <PlaySquare size={40} />
        <h2 className="text-xl font-semibold">Save videos to watch later</h2>
        <button onClick={() => dispatch(openAuthModal('login'))} className="btn-primary px-6 py-2.5">Sign in</button>
      </div>
    )
  }

  return (
    <PageShell eyebrow={`${data.length} videos saved`} title="Watch later" icon={PlaySquare}>
      <VideoGrid videos={data} loading={isLoading} emptyMessage="No videos saved to watch later" />
    </PageShell>
  )
}

export function LikedVideosPage() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const { data = [], isLoading } = useQuery(
    'liked-videos',
    () => videoService.liked().then((r) => r.data),
    { enabled: isAuthenticated }
  )

  if (!isAuthenticated) {
    return (
      <div className="page-empty px-4">
        <Heart size={40} />
        <h2 className="text-xl font-semibold">Save the videos you like</h2>
        <button onClick={() => dispatch(openAuthModal('login'))} className="btn-primary px-6 py-2.5">Sign in</button>
      </div>
    )
  }

  return (
    <PageShell eyebrow="Your taste" title="Liked videos" icon={Heart}>
      <VideoGrid videos={data} loading={isLoading} emptyMessage="Videos you like will show up here" />
    </PageShell>
  )
}

function PageShell({ eyebrow, title, icon: Icon, children }) {
  return (
    <div className="lux-page">
      <div className="lux-container">
        <div className="mb-7 flex items-end justify-between gap-4 rounded-lg border border-vt-border/80 bg-vt-surface/60 px-5 py-5 shadow-[0_24px_70px_rgb(var(--vt-shadow)/0.08)] backdrop-blur-2xl">
          <div>
            <p className="lux-eyebrow mb-2">{eyebrow}</p>
            <h1 className="lux-section-title">{title}</h1>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-full border border-vt-border/80 bg-vt-bg/50 text-vt-gold shadow-inner sm:flex">
            <Icon size={22} />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
