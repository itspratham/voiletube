import { NavLink, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useQuery } from 'react-query'
import {
  Home, PlaySquare, History, Clock, ThumbsUp,
  Flame, Tv
} from 'lucide-react'
import { openAuthModal } from '@/store/slices/uiSlice'
import { videoService } from '@/services/api'
import { FALLBACK_CATEGORIES, getCategoryIcon } from '@/utils/categories'

const mainLinks = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/trending', icon: Flame, label: 'Trending' },
  { to: '/subscriptions', icon: Tv, label: 'Subscriptions', auth: true },
]

const libraryLinks = [
  { to: '/history', icon: History, label: 'History', auth: true },
  { to: '/watch-later', icon: Clock, label: 'Watch later', auth: true },
  { to: '/liked', icon: ThumbsUp, label: 'Liked videos', auth: true },
]

export default function Sidebar() {
  const { sidebarOpen } = useSelector((s) => s.ui)
  const { isAuthenticated, user } = useSelector((s) => s.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { data: categories = FALLBACK_CATEGORIES.slice(1) } = useQuery(
    'video-categories',
    () => videoService.categories().then((r) => r.data.results || r.data),
    { staleTime: 300000 }
  )

  if (!sidebarOpen) {
    return (
      <aside className="fixed left-0 top-[72px] z-40 hidden h-[calc(100vh-72px)] w-[92px] flex-col overflow-y-auto border-r border-vt-border/70 bg-vt-bg/60 py-4 backdrop-blur-2xl md:flex">
        {mainLinks.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `mx-3 flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-xs transition-all ${
                isActive ? 'bg-vt-accent text-white shadow-lg shadow-vt-accent/20' : 'text-vt-muted hover:bg-vt-chip hover:text-vt-text'
              }`
            }
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </NavLink>
        ))}
      </aside>
    )
  }

  return (
    <aside className="fixed left-0 top-[72px] z-40 hidden h-[calc(100vh-72px)] w-[272px] flex-col overflow-y-auto border-r border-vt-border/70 bg-vt-bg/60 backdrop-blur-2xl md:flex">
      <nav className="px-4 py-5">
        <Section>
          {mainLinks.map(({ to, icon: Icon, label, auth }) => (
            <SidebarLink
              key={to}
              to={to}
              icon={Icon}
              label={label}
              locked={auth && !isAuthenticated}
              onLocked={() => dispatch(openAuthModal('login'))}
            />
          ))}
        </Section>

        <Divider />

        <Section title="You">
          {isAuthenticated ? (
            <>
              <SidebarLink to={`/channel/${user?.username}`} icon={PlaySquare} label="Your channel" />
              {libraryLinks.map(({ to, icon: Icon, label }) => (
                <SidebarLink key={to} to={to} icon={Icon} label={label} />
              ))}
            </>
          ) : (
            <div className="px-4 py-3">
              <p className="text-sm text-vt-muted mb-3">Sign in to like videos, comment, and subscribe.</p>
              <button
                onClick={() => dispatch(openAuthModal('login'))}
                className="btn-secondary px-4 py-2"
              >
                Sign in
              </button>
            </div>
          )}
        </Section>

        <Divider />

        <Section title="Explore">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category)
            return (
            <button
              key={category.slug}
              onClick={() => navigate(`/search?category=${category.slug}`)}
              className="flex w-full items-center gap-4 rounded-lg px-4 py-2.5 text-sm text-vt-muted transition-colors hover:bg-vt-chip hover:text-vt-text"
            >
              <Icon size={20} />
              {category.name}
            </button>
            )
          })}
        </Section>
      </nav>
    </aside>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-3">
        {title && <p className="lux-eyebrow px-4 py-2.5">{title}</p>}
      {children}
    </div>
  )
}

function Divider() {
  return <div className="lux-divider my-4" />
}

function SidebarLink({ to, icon: Icon, label, locked, onLocked }) {
  if (locked) {
    return (
      <button
        onClick={onLocked}
        className="flex w-full items-center gap-4 rounded-lg px-4 py-2.5 text-sm text-vt-muted transition-colors hover:bg-vt-chip hover:text-vt-text"
      >
        <Icon size={20} />
        {label}
      </button>
    )
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 rounded-lg px-4 py-2.5 text-sm transition-all ${
          isActive ? 'bg-vt-accent text-white shadow-lg shadow-vt-accent/20' : 'text-vt-muted hover:bg-vt-chip hover:text-vt-text'
        }`
      }
    >
      <Icon size={20} />
      {label}
    </NavLink>
  )
}
