import { useNavigate } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Home, ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/* --------------------------------------------------------------------------
 * Animated noise-grid canvas background
 * -------------------------------------------------------------------------- */
function NoiseCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    let t = 0

    const draw = () => {
      const { width: w, height: h } = canvas
      ctx.clearRect(0, 0, w, h)

      // Subtle animated grid dots
      const spacing = 36
      t += 0.008
      for (let x = 0; x < w; x += spacing) {
        for (let y = 0; y < h; y += spacing) {
          const dist = Math.hypot(x - w / 2, y - h / 2)
          const wave = Math.sin(dist * 0.012 - t) * 0.5 + 0.5
          const opacity = wave * 0.18
          ctx.beginPath()
          ctx.arc(x, y, 1.5, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(248, 113, 113, ${opacity})`
          ctx.fill()
        }
      }
      animId = requestAnimationFrame(draw)
    }

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}

/* --------------------------------------------------------------------------
 * Countdown auto-reset (navigates home after 30 s if user does nothing)
 * -------------------------------------------------------------------------- */
function useCountdown(seconds, onExpire) {
  const [remaining, setRemaining] = useState(seconds)
  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining, onExpire])
  return remaining
}

/* --------------------------------------------------------------------------
 * PageErrorFallback – full-page crash screen
 * -------------------------------------------------------------------------- */
export default function PageErrorFallback({ error, resetErrorBoundary }) {
  const navigate = useNavigate()
  const [showDetails, setShowDetails] = useState(false)

  const goHome = () => {
    resetErrorBoundary()
    navigate('/')
  }

  const goBack = () => {
    resetErrorBoundary()
    navigate(-1)
  }

  const countdown = useCountdown(30, goHome)

  return (
    <div
      className="page-error-fallback relative flex min-h-[100dvh] w-full flex-col items-center justify-center overflow-hidden px-6"
      role="alert"
      aria-live="assertive"
    >
      {/* Ambient canvas */}
      <NoiseCanvas />

      {/* Radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 40%, rgba(248,113,113,0.12), transparent 70%)',
        }}
      />

      {/* Card */}
      <div
        className="page-error-card relative z-10 flex max-w-lg w-full flex-col items-center gap-6 rounded-2xl px-8 py-10 text-center"
        style={{
          background: 'rgb(var(--vt-surface) / 0.82)',
          border: '1px solid rgba(248,113,113,0.25)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(248,113,113,0.08) inset',
          backdropFilter: 'blur(28px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
          animation: 'pef-slide-in 0.45s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Icon */}
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(248,113,113,0.22) 0%, rgba(248,113,113,0.06) 100%)',
            border: '1px solid rgba(248,113,113,0.3)',
            animation: 'pef-pulse 2.4s ease-in-out infinite',
          }}
          aria-hidden="true"
        >
          <AlertTriangle className="h-7 w-7" style={{ color: '#f87171' }} strokeWidth={1.75} />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-vt-text">
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed text-vt-muted">
            An unexpected error occurred in this section. Your other tabs and navigation are still
            fully functional.
          </p>
        </div>

        {/* Error message pill */}
        {error?.message && (
          <div
            className="w-full rounded-xl px-4 py-3 text-left"
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.18)',
            }}
          >
            <p className="font-mono text-xs leading-relaxed" style={{ color: '#fca5a5' }}>
              {error.message}
            </p>
          </div>
        )}

        {/* Stack trace toggle */}
        {error?.stack && (
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="text-xs text-vt-muted underline underline-offset-2 hover:text-vt-text transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} stack trace
          </button>
        )}
        {showDetails && error?.stack && (
          <pre
            className="w-full overflow-x-auto rounded-lg p-3 text-left font-mono text-[10px] leading-relaxed text-vt-muted"
            style={{
              background: 'rgb(var(--vt-surface-soft) / 0.7)',
              border: '1px solid rgb(var(--vt-border) / 0.6)',
              maxHeight: '180px',
            }}
          >
            {error.stack}
          </pre>
        )}

        {/* Action buttons */}
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <button
            id="error-boundary-go-back"
            onClick={goBack}
            className="btn-secondary flex-1 gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Go back
          </button>
          <button
            id="error-boundary-retry"
            onClick={resetErrorBoundary}
            className="btn-secondary flex-1 gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
          <button
            id="error-boundary-go-home"
            onClick={goHome}
            className="btn-primary flex-1 gap-2"
          >
            <Home className="h-4 w-4" />
            Home
          </button>
        </div>

        {/* Auto-redirect countdown */}
        <p className="text-[11px] text-vt-muted">
          Redirecting to home in{' '}
          <span className="font-semibold tabular-nums" style={{ color: '#f87171' }}>
            {countdown}s
          </span>{' '}
          &nbsp;—&nbsp;
          <button
            onClick={goHome}
            className="underline underline-offset-2 hover:text-vt-text transition-colors"
          >
            go now
          </button>
        </p>
      </div>

      {/* Keyframe styles scoped via a style tag */}
      <style>{`
        @keyframes pef-slide-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes pef-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.0); }
          50%       { box-shadow: 0 0 0 10px rgba(248,113,113,0.14); }
        }
      `}</style>
    </div>
  )
}
