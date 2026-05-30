export default function BrandMark({ className = 'h-9 w-9' }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="vt-mark-bg" x1="10" x2="54" y1="8" y2="58">
          <stop offset="0%" stopColor="rgb(var(--brand-violet))" />
          <stop offset="58%" stopColor="rgb(var(--brand-pink))" />
          <stop offset="100%" stopColor="rgb(var(--brand-amber))" />
        </linearGradient>
        <linearGradient id="vt-mark-play" x1="24" x2="44" y1="20" y2="44">
          <stop offset="0%" stopColor="rgb(var(--brand-shell))" />
          <stop offset="100%" stopColor="#F8FAFC" />
        </linearGradient>
        <filter id="vt-mark-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="rgb(var(--vt-shadow))" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="16"
        fill="url(#vt-mark-bg)"
        filter="url(#vt-mark-shadow)"
      />
      <path
        d="M20 20h7.4l5.1 17.7L37.7 20H45L36.8 44h-8.6Z"
        fill="rgb(var(--brand-shell))"
        opacity="0.92"
      />
      <path
        d="M35.5 25.5 46 32 35.5 38.5Z"
        fill="url(#vt-mark-play)"
      />
      <rect
        x="8.75"
        y="8.75"
        width="46.5"
        height="46.5"
        rx="15.25"
        fill="none"
        stroke="rgb(var(--brand-shell))"
        strokeOpacity="0.24"
        strokeWidth="1.5"
      />
    </svg>
  )
}
