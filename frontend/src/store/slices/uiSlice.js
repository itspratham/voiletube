import { createSlice } from '@reduxjs/toolkit'

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    sidebarOpen: true,
    sidebarCollapsed: false,
    searchQuery: '',
    activeCategory: 'all',
    uploadModalOpen: false,
    authModalOpen: false,
    authModalMode: 'login', // 'login' | 'register'
  },
  reducers: {
    toggleSidebar: (state) => { state.sidebarOpen = !state.sidebarOpen },
    setSidebarCollapsed: (state, action) => { state.sidebarCollapsed = action.payload },
    setSearchQuery: (state, action) => { state.searchQuery = action.payload },
    setActiveCategory: (state, action) => {
      state.activeCategory = String(action.payload || 'all').toLowerCase()
    },
    openUploadModal: (state) => { state.uploadModalOpen = true },
    closeUploadModal: (state) => { state.uploadModalOpen = false },
    openAuthModal: (state, action) => {
      state.authModalOpen = true
      state.authModalMode = action.payload || 'login'
    },
    closeAuthModal: (state) => { state.authModalOpen = false },
  },
})

export const {
  toggleSidebar, setSidebarCollapsed, setSearchQuery,
  setActiveCategory, openUploadModal, closeUploadModal,
  openAuthModal, closeAuthModal,
} = uiSlice.actions
export default uiSlice.reducer
