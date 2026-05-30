import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
const MEDIA_FIELDS = new Set(['thumbnail_url', 'avatar_url', 'banner', 'video_file'])

const getApiOrigin = () => {
  if (typeof window === 'undefined') return ''
  return new URL(BASE_URL, window.location.origin).origin
}

const toAbsoluteMediaUrl = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/')) return value
  if (value.startsWith('//')) return value
  return `${getApiOrigin()}${value}`
}

const normalizeMediaUrls = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map(normalizeMediaUrls)
  }

  if (!payload || typeof payload !== 'object') {
    return payload
  }

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (MEDIA_FIELDS.has(key)) {
        return [key, toAbsoluteMediaUrl(value)]
      }
      return [key, normalizeMediaUrls(value)]
    })
  )
}

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => {
    res.data = normalizeMediaUrls(res.data)
    return res
  },
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh })
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Typed service helpers ────────────────────────────────────────────────────

export const videoService = {
  getAll: (params) => api.get('/videos/', { params }),
  getById: (id) => api.get(`/videos/${id}/`),
  upload: (data, onUploadProgress) => api.post('/videos/upload/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress,
  }),
  update: (id, data) => api.patch(`/videos/${id}/`, data),
  delete: (id) => api.delete(`/videos/${id}/`),
  like: (id, action) => api.post(`/videos/${id}/like/`, { action }),
  search: (params) => api.get('/videos/search/', { params }),
  trending: (params) => api.get('/videos/trending/', { params }),
  feed: (params) => api.get('/videos/feed/', { params }),
  history: () => api.get('/videos/history/'),
  liked: () => api.get('/videos/liked/'),
  watchLaterList: () => api.get('/videos/watch-later/'),
  addWatchLater: (id) => api.post(`/videos/watch-later/${id}/`),
  removeWatchLater: (id) => api.delete(`/videos/watch-later/${id}/`),
  categories: () => api.get('/videos/categories/'),
  channelVideos: (username) => api.get(`/videos/channel/${username}/`),
  myPlaylists: () => api.get('/videos/playlists/'),
  channelPlaylists: (username) => api.get(`/videos/channel/${username}/playlists/`),
  createPlaylist: (data) => api.post('/videos/playlists/', data),
  getPlaylist: (id) => api.get(`/videos/playlists/${id}/`),
  updatePlaylist: (id, data) => api.patch(`/videos/playlists/${id}/`, data),
  addToPlaylist: (playlistId, videoId) => api.post(`/videos/playlists/${playlistId}/videos/${videoId}/`),
  removeFromPlaylist: (playlistId, videoId) => api.delete(`/videos/playlists/${playlistId}/videos/${videoId}/`),
  reorderPlaylistVideo: (playlistId, videoId, position) => api.patch(`/videos/playlists/${playlistId}/videos/${videoId}/reorder/`, { position }),
}

export const commentService = {
  getByVideo: (videoId, params) => api.get(`/comments/video/${videoId}/`, { params }),
  getReplies: (commentId) => api.get(`/comments/${commentId}/replies/`),
  create: (videoId, data) => api.post(`/comments/video/${videoId}/`, data),
  createReply: (commentId, data) => api.post(`/comments/${commentId}/replies/`, data),
  update: (id, data) => api.patch(`/comments/${id}/`, data),
  delete: (id) => api.delete(`/comments/${id}/`),
  like: (id) => api.post(`/comments/${id}/like/`),
}

export const subscriptionService = {
  subscribe: (username) => api.post(`/subscriptions/${username}/`),
  unsubscribe: (username) => api.delete(`/subscriptions/${username}/`),
  getMySubscriptions: () => api.get('/subscriptions/'),
}

export const notificationService = {
  getAll: () => api.get('/notifications/'),
  getUnreadCount: () => api.get('/notifications/unread/'),
  markAllRead: () => api.post('/notifications/mark-read/'),
}

export const userService = {
  getProfile: (username) => api.get(`/auth/${username}/`),
  updateProfile: (data) => api.patch('/auth/me/', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  searchChannels: (q) => api.get('/auth/search/', { params: { q } }),
}
