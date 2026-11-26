import { cn } from "@/lib/utils"

export function AlponaMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("size-9", className)}
    >
      <path
        d="M24 3 45 24 24 45 3 24Z"
        stroke="currentColor"
        strokeWidth="1.1"
        opacity="0.5"
      />
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
