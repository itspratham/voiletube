import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

const THEME_KEY = 'voiletube-theme'
const ThemeContext = createContext(null)
const FONT_STACK = 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'

const colorSchemes = {
  light: {
    palette: {
      mode: 'light',
      primary: { main: '#6d28d9', dark: '#581cbe', contrastText: '#ffffff' },
      background: { default: '#ffffff', paper: '#ffffff' },
      text: { primary: '#1e122f', secondary: '#63577a' },
      divider: '#e0d6f1',
    },
    vt: {
      '--vt-bg': '255 255 255',
      '--vt-surface': '255 255 255',
      '--vt-surface-strong': '253 251 255',
      '--vt-surface-soft': '249 245 255',
      '--vt-border': '224 214 241',
      '--vt-text': '30 18 47',
      '--vt-muted': '99 87 122',
      '--vt-accent': '109 40 217',
      '--vt-accent-hover': '88 28 190',
      '--vt-chip': '246 240 255',
      '--vt-chip-hover': '237 226 252',
      '--vt-gold': '203 164 82',
      '--vt-shadow': '17 23 34',
      '--vt-glow': '255 255 255',
      '--brand-cyan': '8 145 178',
      '--brand-violet': '109 40 217',
      '--brand-pink': '124 58 237',
      '--brand-amber': '88 28 135',
      '--brand-mint': '5 150 105',
      '--brand-shell': '255 255 255',
      '--brand-ring': '193 199 211',
    },
    appBackground:
      'radial-gradient(circle at 50% -20%, rgb(var(--vt-accent) / 0.10), transparent 34rem), linear-gradient(180deg, rgb(var(--vt-surface-soft) / 0.92), transparent 360px), linear-gradient(to bottom, rgb(var(--vt-bg)), rgb(var(--vt-bg)))',
    toastShadow: '0 18px 48px rgba(63, 31, 112, 0.14)',
  },
  dark: {
    palette: {
      mode: 'dark',
      primary: { main: '#a235ff', dark: '#6d28d9', contrastText: '#ffffff' },
      background: { default: '#000000', paper: '#0d0a14' },
      text: { primary: '#faf8ff', secondary: '#b1a6c7' },
      divider: '#312744',
    },
    vt: {
      '--vt-bg': '0 0 0',
      '--vt-surface': '13 10 20',
      '--vt-surface-strong': '18 13 28',
      '--vt-surface-soft': '8 5 14',
      '--vt-border': '49 39 68',
      '--vt-text': '250 248 255',
      '--vt-muted': '177 166 199',
      '--vt-accent': '162 53 255',
      '--vt-accent-hover': '190 106 255',
      '--vt-chip': '27 20 40',
      '--vt-chip-hover': '43 32 63',
      '--vt-gold': '224 184 95',
      '--vt-shadow': '0 0 0',
      '--vt-glow': '0 0 0',
      '--brand-cyan': '34 211 238',
      '--brand-violet': '139 92 246',
      '--brand-pink': '192 132 252',
      '--brand-amber': '124 58 237',
      '--brand-mint': '52 211 153',
      '--brand-shell': '12 13 16',
      '--brand-ring': '45 49 60',
    },
    appBackground:
      'radial-gradient(circle at 50% -22%, rgb(var(--vt-accent) / 0.16), transparent 34rem), linear-gradient(180deg, rgb(var(--vt-surface-soft) / 0.92), transparent 360px), linear-gradient(to bottom, rgb(var(--vt-bg)), rgb(var(--vt-bg)))',
    toastShadow: '0 18px 48px rgba(0, 0, 0, 0.45)',
  },
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'system'

  const storedTheme = window.localStorage.getItem(THEME_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
    return storedTheme
  }

  return 'system'
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [resolvedTheme, setResolvedTheme] = useState(() => (
    theme === 'system' ? getSystemTheme() : theme
  ))
  const themeTransitionTimer = useRef(null)

  const muiTheme = useMemo(() => createTheme({
    palette: colorSchemes[resolvedTheme].palette,
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: FONT_STACK,
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            minHeight: '100%',
            backgroundColor: colorSchemes[resolvedTheme].palette.background.default,
            color: colorSchemes[resolvedTheme].palette.text.primary,
            scrollbarGutter: 'stable',
          },
          body: {
            minHeight: '100%',
            backgroundColor: colorSchemes[resolvedTheme].palette.background.default,
            color: colorSchemes[resolvedTheme].palette.text.primary,
            fontFamily: FONT_STACK,
            scrollbarWidth: 'thin',
            scrollbarColor: `rgb(var(--vt-border)) rgb(var(--vt-bg))`,
          },
          '#root': {
            minHeight: '100%',
          },
          '::selection': {
            backgroundColor: 'rgb(var(--vt-accent) / 0.18)',
          },
          '::-webkit-scrollbar': {
            width: 8,
            height: 8,
            transition: 'none',
          },
          '::-webkit-scrollbar-track': {
            background: 'rgb(var(--vt-bg))',
            transition: 'none',
          },
          '::-webkit-scrollbar-thumb': {
            background: 'rgb(var(--vt-border))',
            border: '2px solid rgb(var(--vt-bg))',
            borderRadius: 999,
            transition: 'none',
          },
          '::-webkit-scrollbar-thumb:hover': {
            background: 'rgb(var(--vt-muted))',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: 'rgb(var(--vt-surface-strong))',
            border: '1px solid rgb(var(--vt-border))',
            color: 'rgb(var(--vt-text))',
            boxShadow: '0 18px 48px rgb(var(--vt-shadow) / 0.16)',
            fontSize: 12,
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            border: 0,
            borderRadius: 999,
            color: 'rgb(var(--vt-muted))',
            padding: '7px 10px',
            '&:hover': {
              backgroundColor: 'rgb(var(--vt-chip-hover) / 0.72)',
              color: 'rgb(var(--vt-text))',
            },
            '&.Mui-selected': {
              backgroundColor: 'rgb(var(--vt-accent))',
              color: '#ffffff',
              '&:hover': {
                backgroundColor: 'rgb(var(--vt-accent-hover))',
              },
            },
          },
        },
      },
      MuiToggleButtonGroup: {
        styleOverrides: {
          root: {
            gap: 2,
            border: '1px solid rgb(var(--vt-border) / 0.82)',
            borderRadius: 999,
            backgroundColor: 'rgb(var(--vt-surface) / 0.72)',
            boxShadow: 'inset 0 1px 0 rgb(var(--vt-glow) / 0.12)',
            padding: 3,
          },
        },
      },
    },
  }), [resolvedTheme])

  const setTheme = useMemo(() => (nextTheme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.classList.add('vt-theme-switching')
      window.clearTimeout(themeTransitionTimer.current)
      themeTransitionTimer.current = window.setTimeout(() => {
        root.classList.remove('vt-theme-switching')
      }, 340)
    }

    setThemeState(nextTheme)
  }, [])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme: () => setTheme((current) => {
      const currentResolvedTheme = current === 'system' ? getSystemTheme() : current
      return currentResolvedTheme === 'dark' ? 'light' : 'dark'
    }),
  }), [theme, resolvedTheme, setTheme])

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return

    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const nextResolvedTheme = theme === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : theme

      root.classList.remove('light', 'dark')
      root.classList.add(nextResolvedTheme)
      root.dataset.theme = nextResolvedTheme
      root.style.colorScheme = nextResolvedTheme
      root.style.setProperty('--vt-app-bg-image', colorSchemes[nextResolvedTheme].appBackground)
      Object.entries(colorSchemes[nextResolvedTheme].vt).forEach(([key, value]) => {
        root.style.setProperty(key, value)
      })
      document.body.dataset.theme = nextResolvedTheme
      setResolvedTheme(nextResolvedTheme)
    }

    applyTheme()
    window.localStorage.setItem(THEME_KEY, theme)

    if (theme !== 'system') return undefined

    mediaQuery.addEventListener('change', applyTheme)
    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [theme])

  useEffect(() => () => {
    if (typeof window !== 'undefined') {
      window.clearTimeout(themeTransitionTimer.current)
    }
  }, [])

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline enableColorScheme />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export function ThemedToaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Toaster
      position="bottom-left"
      toastOptions={{
        style: {
          background: 'rgb(var(--vt-surface))',
          color: 'rgb(var(--vt-text))',
          border: '1px solid rgb(var(--vt-border))',
          boxShadow: colorSchemes[resolvedTheme].toastShadow,
        },
      }}
    />
  )
}
