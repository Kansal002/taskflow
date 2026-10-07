export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" className="fill-accent-600" />
      <rect x="7" y="8" width="5" height="16" rx="2" fill="#fff" />
      <rect x="13.5" y="8" width="5" height="11" rx="2" fill="#fff" opacity=".85" />
      <rect x="20" y="8" width="5" height="7" rx="2" fill="#fff" opacity=".7" />
    </svg>
  );
}
