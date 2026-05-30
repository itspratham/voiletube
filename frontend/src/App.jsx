import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCurrentUser } from '@/store/slices/authSlice'

import Layout from '@/components/layout/Layout'
import { useTheme } from '@/components/theme/ThemeProvider'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import PageErrorFallback from '@/components/ui/PageErrorFallback'

const HomePage = lazy(() => import('@/pages/HomePage'))
const WatchPage = lazy(() => import('@/pages/WatchPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const ChannelPage = lazy(() => import('@/pages/ChannelPage'))
const TrendingPage = lazy(() => import('@/pages/TrendingPage'))
const SubscriptionsPage = lazy(() => import('@/pages/SubscriptionsPage'))
const HistoryPage = lazy(() => import('@/pages/HistoryPage'))
const WatchLaterPage = lazy(() => import('@/pages/WatchLaterPage'))
const LikedVideosPage = lazy(() => import('@/pages/LikedVideosPage'))
const StudioPage = lazy(() => import('@/pages/StudioPage'))
const PlaylistPage = lazy(() => import('@/pages/PlaylistPage'))
const AuthModal = lazy(() => import('@/components/auth/AuthModal'))
const UploadModal = lazy(() => import('@/components/video/UploadModal'))

export default function App() {
  const dispatch = useDispatch()
  const { resolvedTheme } = useTheme()
  const { initialized } = useSelector((s) => s.auth)
  const { authModalOpen, uploadModalOpen } = useSelector((s) => s.ui)

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      dispatch(fetchCurrentUser())
    } else {
      dispatch({ type: 'auth/fetchMe/rejected', payload: null })
    }
  }, [dispatch])

  if (!initialized) {
    return (
      <div
        data-theme={resolvedTheme}
        className="app-theme-root flex items-center justify-center min-h-screen bg-vt-bg text-vt-text"
      >
        <div className="w-10 h-10 border-2 border-vt-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div
        data-theme={resolvedTheme}
        className="app-theme-root min-h-screen bg-vt-bg text-vt-text"
      >
        <AppRoutes />
        <Suspense fallback={null}>
          {authModalOpen && <AuthModal />}
          {uploadModalOpen && <UploadModal />}
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

/**
 * Helper: wraps a page element in an isolated ErrorBoundary so that a crash
 * in one route is fully contained and other routes remain functional.
 */
function PageRoute({ element }) {
  return (
    <ErrorBoundary FallbackComponent={PageErrorFallback}>
      <Suspense fallback={<PageLoading />}>
        {element}
      </Suspense>
    </ErrorBoundary>
  )
}

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-vt-accent border-t-transparent" />
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  const key = location.pathname + location.search

  return (
    // Top-level boundary: catches Layout-level failures
    <ErrorBoundary FallbackComponent={PageErrorFallback}>
      <Layout>
        <Routes location={location}>
          <Route path="/"              element={<PageRoute element={<HomePage          key={key} />} />} />
          <Route path="/watch/:id"     element={<PageRoute element={<WatchPage         key={key} />} />} />
          <Route path="/search"        element={<PageRoute element={<SearchPage        key={key} />} />} />
          <Route path="/channel/:username" element={<PageRoute element={<ChannelPage  key={key} />} />} />
          <Route path="/trending"      element={<PageRoute element={<TrendingPage      key={key} />} />} />
          <Route path="/subscriptions" element={<PageRoute element={<SubscriptionsPage key={key} />} />} />
          <Route path="/history"       element={<PageRoute element={<HistoryPage       key={key} />} />} />
          <Route path="/watch-later"   element={<PageRoute element={<WatchLaterPage    key={key} />} />} />
          <Route path="/liked"         element={<PageRoute element={<LikedVideosPage   key={key} />} />} />
          <Route path="/studio"        element={<PageRoute element={<StudioPage         key={key} />} />} />
          <Route path="/playlist/:id"  element={<PageRoute element={<PlaylistPage       key={key} />} />} />
        </Routes>
      </Layout>
    </ErrorBoundary>
  )
}
