import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * WidgetErrorFallback
 *
 * A compact inline error card for non-critical component crashes
 * (e.g. a sidebar widget, a comment list, a video card).
 * Won't crash the whole page — just shows a polished placeholder.
 *
 * Props:
 *   error              – The caught Error object
 *   resetErrorBoundary – Callback to unmount+remount the failed subtree
 *   label              – Short description of what failed (default: "This section")
 */
export default function WidgetErrorFallback({ error, resetErrorBoundary, label = 'This section' }) {
  return (
    <div
      className="widget-error-fallback flex flex-col items-center justify-center gap-3 rounded-xl px-5 py-6 text-center"
      role="alert"
      style={{
        background: 'rgba(248,113,113,0.06)',
        border: '1px solid rgba(248,113,113,0.18)',
        animation: 'wef-fade-in 0.3s ease both',
      }}
    >
      {/* Icon */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full"
        style={{ background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.22)' }}
        aria-hidden="true"
      >
        <AlertTriangle className="h-4 w-4" style={{ color: '#f87171' }} strokeWidth={2} />
      </div>

      {/* Text */}
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-vt-text">{label} couldn't load</p>
        {error?.message && (
          <p className="font-mono text-[11px] text-vt-muted line-clamp-2">{error.message}</p>
        )}
      </div>

      {/* Retry */}
      <button
        id="widget-error-boundary-retry"
        onClick={resetErrorBoundary}
        className="btn-secondary gap-1.5 py-1.5 text-xs"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </button>

      <style>{`
        @keyframes wef-fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1);    }
        }
      `}</style>
    </div>
  )
}
