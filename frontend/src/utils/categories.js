import {
  Atom,
  Cpu,
  Gamepad2,
  GraduationCap,
  Music,
  Newspaper,
  Plane,
  Smile,
  Trophy,
  Utensils,
  Tag,
} from 'lucide-react'

export const FALLBACK_CATEGORIES = [
  { id: 'all', name: 'All', slug: 'all' },
  { id: 'music', name: 'Music', slug: 'music', icon: 'Music' },
  { id: 'gaming', name: 'Gaming', slug: 'gaming', icon: 'Gamepad2' },
  { id: 'news', name: 'News', slug: 'news', icon: 'Newspaper' },
  { id: 'sports', name: 'Sports', slug: 'sports', icon: 'Trophy' },
  { id: 'technology', name: 'Technology', slug: 'technology', icon: 'Cpu' },
  { id: 'education', name: 'Education', slug: 'education', icon: 'GraduationCap' },
  { id: 'comedy', name: 'Comedy', slug: 'comedy', icon: 'Smile' },
  { id: 'science', name: 'Science', slug: 'science', icon: 'Atom' },
  { id: 'travel', name: 'Travel', slug: 'travel', icon: 'Plane' },
  { id: 'food', name: 'Food', slug: 'food', icon: 'Utensils' },
]

const ICONS = {
  Atom,
  Cpu,
  Gamepad2,
  GraduationCap,
  Music,
  Newspaper,
  Plane,
  Smile,
  Trophy,
  Utensils,
}

export function withAllCategory(categories = []) {
  const seen = new Set(['all'])
  const dbCategories = categories.filter((category) => {
    const slug = String(category?.slug || category?.name || '').toLowerCase()
    if (!slug || slug === 'all' || seen.has(slug)) return false
    seen.add(slug)
    return true
  })
  return [FALLBACK_CATEGORIES[0], ...dbCategories]
}

export function getCategoryIcon(category) {
  return ICONS[category?.icon] || ICONS[category?.name?.replace(/\s/g, '')] || Tag
}
