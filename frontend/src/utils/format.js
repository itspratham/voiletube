import { format as timeago } from 'timeago.js'
import numeral from 'numeral'

export const formatTimeAgo = (date) => {
  if (!date) return ''
  try { return timeago(new Date(date)) } catch { return '' }
}

export const formatCount = (n) => {
  if (n == null) return '0'
  if (n >= 1_000_000) return numeral(n).format('0.0a')
  if (n >= 1_000) return numeral(n).format('0.0a')
  return String(n)
}

export const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${m}:${String(s).padStart(2,'0')}`
}

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}
