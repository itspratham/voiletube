export default function VerifiedBadge({ className = 'h-3.5 w-3.5 align-[-2px]' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-vt-accent text-white shadow-sm shadow-black/10 ${className}`}
      title="Verified creator"
      aria-label="Verified creator"
    >
      <svg viewBox="0 0 16 16" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="m4 8 2.4 2.4L12 5.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
