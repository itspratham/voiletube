import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { notificationService } from '@/services/api'
import { formatTimeAgo } from '@/utils/format'
import { Bell, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'

function resolveNotificationPath(notification) {
  if (!notification?.link) return null

  let rawPath = notification.link

  try {
    const url = new URL(notification.link, window.location.origin)
    rawPath = `${url.pathname}${url.search}${url.hash}`
  } catch {
    rawPath = notification.link
  }

  if (rawPath.startsWith('/watch/')
    || rawPath.startsWith('/channel/')
    || rawPath.startsWith('/search')
    || rawPath.startsWith('/subscriptions')
    || rawPath.startsWith('/history')
    || rawPath.startsWith('/watch-later')
    || rawPath.startsWith('/studio')
    || rawPath.startsWith('/trending')) {
    return rawPath
  }

  const videoMatch = rawPath.match(/\/videos\/([0-9a-f-]+)\/?$/i)
  if (videoMatch) {
    return `/watch/${videoMatch[1]}`
  }

  const channelMatch = rawPath.match(/\/(?:auth|users|channels)\/([^/?#]+)\/?$/i)
  if (channelMatch) {
    return `/channel/${channelMatch[1]}`
  }

  if (rawPath.startsWith('/api/')) {
    return rawPath.replace(/^\/api/, '')
  }

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`
}

export default function NotificationPanel({ onClose }) {
  const ref = useRef(null)
  const hasMarkedReadRef = useRef(false)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery(
    'notifications',
    () => notificationService.getAll().then((r) => r.data)
  )

  const markRead = useMutation(
    () => notificationService.markAllRead(),
    { onSuccess: () => qc.invalidateQueries('notifications') }
  )

  const notificationsList = Array.isArray(notifications)
    ? notifications
    : (notifications?.results || [])

  useEffect(() => {
    const hasUnreadNotifications = notificationsList.some((notification) => !notification.is_read)
    if (!hasUnreadNotifications || hasMarkedReadRef.current || markRead.isLoading) {
      return
    }

    hasMarkedReadRef.current = true
    markRead.mutate()
  }, [notificationsList, markRead])

  const handleNotificationClick = (notification) => {
    const targetPath = resolveNotificationPath(notification)

    if (!targetPath) {
      toast.error('This notification does not have a destination.')
      onClose()
    }
  }

  return (
    <div
      ref={ref}
      className="glass-panel-strong fixed right-3 top-[76px] z-50 w-[calc(100vw-1.5rem)] max-w-[360px] overflow-hidden rounded-lg animate-fade-in md:absolute md:right-0 md:top-12"
    >
      <div className="absolute -top-2 right-5 hidden h-4 w-4 rotate-45 border-l border-t border-vt-border bg-vt-surface-strong md:block" />

      <div className="relative flex items-center justify-between border-b border-vt-border/80 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold leading-none">Notifications</h3>
          <p className="mt-1 text-xs text-vt-muted">
            {notificationsList.length ? `${notificationsList.length} recent update${notificationsList.length === 1 ? '' : 's'}` : 'All caught up'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost h-8 w-8 rounded-full p-0 text-vt-muted hover:text-vt-text"
          aria-label="Close notifications"
        >
          <X size={15} />
        </button>
      </div>

      <div className="max-h-[360px] overflow-y-auto py-1">
        {notificationsList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-vt-muted">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-vt-chip">
              <Bell size={22} />
            </span>
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          notificationsList.slice(0, 8).map((n) => {
            const targetPath = resolveNotificationPath(n)
            const rowClassName = `group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-vt-chip/80 ${
                !n.is_read ? 'bg-vt-accent/7' : ''
              }`
            const rowContent = (
              <>
                {n.sender_avatar ? (
                  <img src={n.sender_avatar} className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-vt-border" alt="" />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-vt-chip text-vt-muted">
                    <Bell size={15} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-2 text-sm leading-snug">{n.message}</p>
                  <p className="text-xs text-vt-muted mt-0.5">{formatTimeAgo(n.created_at)}</p>
                </div>
                {targetPath ? (
                  <ChevronRight size={15} className="mt-2 flex-shrink-0 text-vt-muted opacity-0 transition-opacity group-hover:opacity-100" />
                ) : (
                  !n.is_read && <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-vt-accent" />
                )}
              </>
            )

            return targetPath ? (
              <Link key={n.id} to={targetPath} onClick={onClose} className={rowClassName}>
                {rowContent}
              </Link>
            ) : (
              <button key={n.id} type="button" onClick={() => handleNotificationClick(n)} className={rowClassName}>
                {rowContent}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
