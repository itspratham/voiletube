import { useQuery, useInfiniteQuery } from 'react-query'
import InfiniteScroll from 'react-infinite-scroll-component'
import { useDispatch, useSelector } from 'react-redux'
import { videoService } from '@/services/api'
import { setActiveCategory } from '@/store/slices/uiSlice'
import VideoGrid from '@/components/video/VideoGrid'
import { FALLBACK_CATEGORIES, withAllCategory } from '@/utils/categories'

export default function HomePage() {
  const dispatch = useDispatch()
  const { activeCategory } = useSelector((s) => s.ui)
  const { data: dbCategories = FALLBACK_CATEGORIES.slice(1) } = useQuery(
    'video-categories',
    () => videoService.categories().then((r) => r.data.results || r.data),
    { staleTime: 300000 }
  )
  const categories = withAllCategory(dbCategories)
  const activeCategorySlug = String(activeCategory || 'all').toLowerCase()
  const activeCategoryData = categories.find((cat) => (cat.slug || '').toLowerCase() === activeCategorySlug) || categories[0]

  const { data, isLoading, fetchNextPage, hasNextPage } = useInfiniteQuery(
    ['videos', activeCategoryData.slug],
    ({ pageParam = 1 }) => {
      const params = { page: pageParam }
      if (activeCategoryData?.slug && activeCategoryData.slug !== 'all') {
        params.category = activeCategoryData.slug
      }
      return videoService.getAll(params).then((r) => r.data)
    },
    {
      staleTime: 60000,
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
    <div className="px-4 pb-6 pt-0 sm:px-6 lg:px-8">
      <div className="lux-container">
        {/* Category chips */}
        <div className="sticky top-[72px] z-30 -mx-4 mb-7 flex gap-2 overflow-x-auto border-b border-vt-border/70 bg-vt-bg/80 px-4 py-3 backdrop-blur-2xl scrollbar-none sm:top-[72px]">
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => dispatch(setActiveCategory(cat.slug))}
              className={(cat.slug || '').toLowerCase() === (activeCategoryData?.slug || '').toLowerCase() ? 'chip-active' : 'chip'}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <InfiniteScroll
          dataLength={videos.length}
          next={fetchNextPage}
          hasMore={!!hasNextPage}
          loader={<div className="py-8 text-center text-sm text-vt-muted">Loading more...</div>}
          style={{ overflow: 'visible' }}
        >
          <VideoGrid videos={videos} loading={isLoading} emptyMessage="No videos yet. Upload the first feature." />
        </InfiniteScroll>
      </div>
    </div>
  )
}
