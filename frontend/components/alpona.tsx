import { cn } from "@/lib/utils"

/** Brand seal: a diamond, a dotted diamond, and pin-dots — the grammar of an alpona. */
export function AlponaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={cn("size-9", className)}>
      <path d="M24 3 45 24 24 45 3 24Z" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
      <path
        d="M24 10.5 37.5 24 24 37.5 10.5 24Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2.4 3.2"
      />
      <circle cx="24" cy="24" r="4.1" fill="currentColor" />
      <circle cx="24" cy="3" r="1.5" fill="currentColor" opacity="0.75" />
      <circle cx="45" cy="24" r="1.5" fill="currentColor" opacity="0.75" />
      <circle cx="24" cy="45" r="1.5" fill="currentColor" opacity="0.75" />
      <circle cx="3" cy="24" r="1.5" fill="currentColor" opacity="0.75" />
    </svg>
  )
}

/**
 * Concentric alpona ring: petal ticks, a dotted band and a broken inner ring.
 * `listening` spins the petal band so the frame breathes with the call.
 */
export function AlponaRing({
  className,
  listening = false,
}: {
  className?: string
  listening?: boolean
}) {
  const petals = Array.from({ length: 24 }, (_, i) => i)
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden className={cn("size-full", className)}>
      <circle cx="100" cy="100" r="94" stroke="currentColor" strokeWidth="0.8" opacity="0.28" />
      <g className={listening ? "alpona-spin" : undefined}>
        {petals.map((i) => (
          <rect
            key={i}
            x="99.1"
            y="2"
            width="1.8"
            height="10"
            rx="0.9"
            fill="currentColor"
            opacity={i % 3 === 0 ? 0.85 : 0.3}
            transform={`rotate(${i * 15} 100 100)`}
          />
        ))}
      </g>
      <circle
        cx="100"
        cy="100"
        r="83"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeDasharray="1.4 6.4"
        strokeLinecap="round"
        opacity="0.65"
      />
      <circle
        cx="100"
        cy="100"
        r="68"
        stroke="currentColor"
        strokeWidth="0.7"
        strokeDasharray="16 11"
        opacity="0.4"
      />
    </svg>
  )
}

/** A short alpona rule: stitch line, diamond, stitch line. Use in place of a plain separator. */
export function AlponaRule({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center gap-2.5", className)}>
      <span className="stitch h-px flex-1 opacity-50" />
      <svg viewBox="0 0 12 12" className="size-2 text-primary/60" fill="currentColor">
        <path d="M6 0 8.4 3.6 12 6 8.4 8.4 6 12 3.6 8.4 0 6 3.6 3.6Z" />
      </svg>
      <span className="stitch h-px flex-1 opacity-50" />
    </div>
  )
}
