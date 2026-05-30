import { Component } from 'react'

/**
 * Generic React Error Boundary.
 *
 * Props:
 *   fallback  – (error, resetFn) => ReactNode   Custom fallback renderer.
 *   FallbackComponent – Component({ error, resetErrorBoundary }) Default to PageErrorFallback.
 *   onError   – (error, info) => void            Optional callback (e.g. logging).
 *   onReset   – () => void                       Called just before the boundary resets.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.resetBoundary = this.resetBoundary.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info)
    }
    // Non-production: also log to console for easy debugging
    if (process.env.NODE_ENV !== 'production') {
      console.group('%c[ErrorBoundary] Caught an unhandled error', 'color:#f87171;font-weight:bold')
      console.error(error)
      console.info('Component stack:', info?.componentStack)
      console.groupEnd()
    }
  }

  resetBoundary() {
    if (this.props.onReset) this.props.onReset()
    this.setState({ hasError: false, error: null })
  }

  render() {
    const { hasError, error } = this.state
    const { children, fallback, FallbackComponent } = this.props

    if (!hasError) return children

    // Custom render-prop fallback
    if (typeof fallback === 'function') {
      return fallback(error, this.resetBoundary)
    }

    // Component-based fallback
    const Fallback = FallbackComponent
    if (Fallback) {
      return <Fallback error={error} resetErrorBoundary={this.resetBoundary} />
    }

    // Bare-minimum safety net (should be overridden via props)
    return (
      <div style={{ padding: 32, color: 'red' }}>
        <strong>Something went wrong.</strong>
        <pre style={{ marginTop: 8, fontSize: 12 }}>{error?.message}</pre>
        <button onClick={this.resetBoundary} style={{ marginTop: 12, cursor: 'pointer' }}>
          Try again
        </button>
      </div>
    )
  }
}
