import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Menu, Search, X, Upload, Bell, Mic } from 'lucide-react'
import { toggleSidebar, openAuthModal, openUploadModal } from '@/store/slices/uiSlice'
import { logoutUser } from '@/store/slices/authSlice'
import ModeToggle from '@/components/theme/ModeToggle'
import BrandMark from '@/components/brand/BrandMark'
import toast from 'react-hot-toast'
import { useQuery } from 'react-query'
import { notificationService } from '@/services/api'
import NotificationPanel from './NotificationPanel'

export default function Header() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useSelector((s) => s.auth)
  const [query, setQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const userMenuRef = useRef(null)
  const notificationsRef = useRef(null)
  const recognitionRef = useRef(null)

  const { data: notifications = [] } = useQuery(
    'notifications',
    () => notificationService.getAll().then((r) => r.data),
    { enabled: isAuthenticated }
  )

  const notificationsList = Array.isArray(notifications)
    ? notifications
    : (notifications?.results || [])

  const unreadCount = notificationsList.filter((n) => !n.is_read).length

  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null
        recognitionRef.current.onerror = null
        recognitionRef.current.onend = null
        recognitionRef.current.stop()
      }
    }
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
      setShowSearch(false)
    }
  }

  const submitSearch = (nextQuery) => {
    const trimmedQuery = nextQuery.trim()
    if (!trimmedQuery) return
    setQuery(trimmedQuery)
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`)
    setShowSearch(false)
  }

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      toast.error('Voice search is not supported in this browser.')
      return
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setShowSearch(true)
      toast.success('Listening...')
    }

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()

      if (transcript) {
        setQuery(transcript)
      }

      const finalResult = Array.from(event.results).find((result) => result.isFinal)
      if (finalResult?.[0]?.transcript) {
        submitSearch(finalResult[0].transcript)
      }
    }

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        toast.error(event.error === 'not-allowed'
          ? 'Microphone permission is blocked.'
          : 'Voice search failed. Please try again.')
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-[72px] items-center gap-3 border-b border-vt-border/70 bg-vt-bg/70 px-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-vt-bg/60">
      {/* Left */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="btn-ghost h-10 w-10 p-0 rounded-full"
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 font-semibold tracking-normal"
        >
          <BrandMark />
          <span className="text-[1.08rem] font-black text-vt-text">
            Voiletube
          </span>
        </button>
      </div>

      {/* Center - Search */}
      <div className={`flex-1 flex justify-center ${showSearch ? 'flex' : 'hidden md:flex'}`}>
        <form onSubmit={handleSearch} className="flex w-full max-w-3xl items-center">
          <div className="flex flex-1 overflow-hidden rounded-l-full border border-vt-border/80 bg-vt-surface/75 shadow-inner">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search premium, creator, and live content"
              className="flex-1 bg-transparent px-5 py-2.5 text-sm outline-none text-vt-text placeholder-vt-muted"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="px-3 text-vt-muted hover:text-vt-text">
                <X size={16} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="rounded-r-full border border-vt-border/80 border-l-0 bg-vt-accent px-5 py-2.5 text-white transition-colors hover:bg-vt-accent-hover"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`ml-2 btn-ghost h-10 w-10 p-0 rounded-full ${isListening ? 'bg-vt-accent text-white hover:bg-vt-accent-hover' : ''}`}
            aria-label={isListening ? 'Stop voice search' : 'Voice search'}
            title={isListening ? 'Stop voice search' : 'Voice search'}
          >
            <Mic size={18} />
          </button>
        </form>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mobile search toggle */}
        <button
          className="md:hidden btn-ghost h-10 w-10 p-0 rounded-full"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? <X size={20} /> : <Search size={20} />}
        </button>

        <ModeToggle />

        {isAuthenticated ? (
          <>
            <button
              onClick={() => dispatch(openUploadModal())}
              className="btn-secondary hidden h-10 items-center gap-2 px-3 text-sm md:inline-flex"
              title="Upload"
            >
              <Upload size={18} />
              <span className="hidden lg:inline">Create</span>
            </button>

            {/* Notifications */}
            <div className="relative" ref={notificationsRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="btn-ghost relative h-10 w-10 p-0 rounded-full"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-vt-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-vt-accent"></span>
                  </span>
                )}
              </button>
              {showNotifications && (
                <NotificationPanel onClose={() => setShowNotifications(false)} />
              )}
            </div>

            {/* Avatar / User menu */}
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="rounded-full ring-1 ring-vt-border transition hover:ring-vt-accent/60">
                <img
                  src={user?.avatar_url}
                  alt={user?.display_name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              </button>
              {showUserMenu && (
                <div className="glass-panel-strong absolute right-0 top-12 z-50 w-64 rounded-lg py-2 animate-fade-in">
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-vt-border">
                    <img src={user?.avatar_url} alt={user?.display_name} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-medium text-sm">{user?.display_name}</p>
                      <p className="text-xs text-vt-muted">{user?.email}</p>
                    </div>
                  </div>
                  <MenuItem onClick={() => { navigate(`/channel/${user?.username}`); setShowUserMenu(false) }}>
                    Your channel
                  </MenuItem>
                  <MenuItem onClick={() => { navigate('/studio'); setShowUserMenu(false) }}>
                    Creator Studio
                  </MenuItem>
                  <MenuItem onClick={() => { navigate('/history'); setShowUserMenu(false) }}>
                    History
                  </MenuItem>
                  <div className="border-t border-vt-border mt-1 pt-1">
                    <MenuItem onClick={() => { dispatch(logoutUser()); setShowUserMenu(false) }}>
                      Sign out
                    </MenuItem>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => dispatch(openAuthModal('login'))}
            className="btn-secondary px-4 py-2"
          >
            <span>Sign in</span>
          </button>
        )}
      </div>
    </header>
  )
}

function MenuItem({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-vt-chip/80"
    >
      {children}
    </button>
  )
}
