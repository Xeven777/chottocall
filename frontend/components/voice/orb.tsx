"use client"

import Image from "next/image"
import { memo, useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import Strands from "@/components/Strands"

import type { Speaker, Status } from "./use-voice-call"

export type OrbMode =
  "idle" | "connecting" | "listening" | "hearing" | "replying" | "muted"

export function orbMode(
  status: Status,
  speaker: Speaker,
  muted: boolean
): OrbMode {
  if (status === "connecting") return "connecting"
  if (status !== "live") return "idle"
  if (speaker === "bot") return "replying"
  if (muted) return "muted"
  return speaker === "user" ? "hearing" : "listening"
}

/* The five logo petals, as thin strokes — the outline face of the orb. */
const PETALS = [
  "M85.1305 176.538C88.0421 175.012 91.5934 174.154 94.7959 173.409C113.531 168.664 131.621 165.818 151.052 166.202C170.995 166.654 192.895 171.583 210.873 180.631C214.648 182.544 222.975 185.253 223.273 190.344C223.511 194.197 223.523 198.069 223.75 201.925C225.335 236.463 237.502 270.288 254.282 300.035C265.306 319.448 281.54 336.898 299.813 349.238C315.239 359.132 332.042 366.137 350.429 367.2C357.787 367.649 353.313 373.1 349.738 376.197C307.581 412.107 243.48 428.529 188.715 424.419C161.818 422.24 134.898 416.764 110.254 405.367C83.4998 392.423 58.4371 372.843 40.1227 349.035C17.5309 319.727 -2.83039 278.499 0.324099 240.154C1.76251 223.067 27.8238 206.795 40.5376 198.314C54.5139 189.475 69.5197 181.958 85.1305 176.538Z",
  "M344.635 399.219C346.371 396.581 348.934 394.546 350.613 391.825C352.26 389.14 358.851 368.419 364.504 370.92C365.948 371.543 367.746 377.427 368.299 379.077C373.292 393.982 378.436 409.005 379.701 424.808C380.422 433.817 380.806 442.908 380.362 451.939C379.777 463.421 376.901 474.819 374.43 485.997C366.534 522.564 351.63 557.596 328.193 586.815C313.211 605.466 296.24 621.11 276.778 634.663C243.909 657.653 199.404 672.94 159.318 669.748C150.309 669.028 141.748 667.68 132.903 665.732C128.798 664.846 124.501 663.882 120.902 661.607C118.198 659.895 115.524 656.58 113.757 653.918C92.2699 621.787 87.1122 577.855 92.0446 540.383C94.7549 520.25 101.732 499.974 111.882 482.401C118.135 471.317 126 460.871 133.994 450.974C135.152 448.809 138.033 444.278 140.771 444.546C143.353 444.81 144.889 445.262 147.379 445.993C170.723 452.807 196.222 457.666 220.583 455.457C245.938 453.083 272.233 447.73 295.371 436.685C314.891 427.668 328.469 412.704 344.635 399.219Z",
  "M365.456 337.501C384.3 277.816 449.66 219.302 511.681 208.307C540.582 202.344 571.159 201.305 600.13 207.513C637.148 214.49 672.401 232.686 699.288 259.471C706.236 266.295 714.666 274.658 716.744 284.719C717.434 288.059 716.56 291.524 716.083 294.836C714.205 309.847 709.343 324.367 703.36 338.171C701.116 343.253 699.305 348.572 696.707 353.487C689.912 366.258 682.92 379.014 674.149 390.533C655.705 415.261 632.119 436.418 602.312 445.62C596.64 447.364 590.641 448.137 584.856 449.418C580.033 450.471 574.592 439.034 572.24 436C548.796 405.618 519.381 383.527 487.188 363.978C456.809 345.404 402.084 334.633 370.896 357.41C368.677 359.061 366.446 360.331 363.597 359.262C358.734 357.445 364.235 340.903 365.456 337.501Z",
  "M367.086 3.76005C370.737 1.44835 376.752 0.166673 380.961 0.00875115C386.694 -0.159091 392.152 2.11589 397.296 4.38267C419 13.9369 438.876 29.3601 455.088 46.6899C466.339 58.691 475.758 72.4228 483.7 86.849C488.431 95.2168 492.05 104.189 495.578 113.124C501.745 127.802 502.274 144.826 502.217 160.49C502.217 165.533 501.976 170.702 500.972 175.651C500.096 179.884 498.682 180.585 494.779 181.783C489.76 183.348 484.699 184.775 479.705 186.422C461.136 192.344 444 202.365 427.813 213.164C423.216 216.387 418.269 219.132 413.876 222.659C402.8 231.73 392.123 241.015 382.898 252.124C374.826 261.882 367.45 272.44 361.984 283.94C354.166 299.962 348.854 321.294 352.488 338.996C353.118 342.077 353.763 345.159 354.408 348.241C355.12 351.723 356.879 355.445 355.669 358.982C355.669 362.756 306.06 321.16 301.472 314.962C284.259 291.914 268.306 264.5 261.243 236.06C257.691 221.781 253.462 207.5 252.93 192.679C252.075 165.676 256.519 138.48 265.96 113.108C276.933 83.7861 295.933 56.431 318.774 35.2959C325.804 28.773 333.651 23.263 341.424 17.7224C349.03 12.2601 358.304 6.76971 367.086 3.76005Z",
  "M376.382 376.493C374.22 374.741 372.338 372.361 370.451 370.313C368.038 367.698 369.975 365.597 373.002 365.192C381.392 364.072 397.035 366.36 404.917 367.403C430.344 371.219 454.072 383.075 476.401 395.452C483.974 399.637 491.734 404.023 498.698 409.196C517.07 421.522 533.608 436.903 548.93 452.889C569.779 474.588 588.685 504.167 593.984 534.841C597.167 551.933 597.792 568.951 595.828 586.286C592.06 616.471 580.142 644.941 561.653 668.97C557.032 674.952 551.877 681.906 544.581 684.566C538.387 686.819 531.725 687.114 525.22 687.602C499.248 689.665 470.305 683.562 446.391 672.721C430.576 665.579 415.85 657.072 401.644 647.007C384.6 634.777 371.834 617.932 361.523 599.828C361.078 599.034 360.647 598.582 360.371 597.586C359.809 595.362 361.449 593.034 362.614 591.329C376.89 570.295 389.78 548.027 397.419 523.525C409.643 487.575 414.121 439.689 395.759 405.352C391.101 396.565 385.776 388.542 379.747 380.665C378.66 379.242 377.376 378.003 376.382 376.493Z",
]

const loop = { repeat: Infinity, ease: "easeInOut" as const }
const linear = { repeat: Infinity, ease: "linear" as const }

function FlowerOutline({
  className,
  spin,
}: {
  className?: string
  spin: "cw" | "ccw" | false
}) {
  const reduce = useReducedMotion()
  return (
    <motion.svg
      viewBox="-30 -30 777 748"
      fill="none"
      aria-hidden
      className={className}
      animate={
        !reduce && spin ? { rotate: spin === "cw" ? 360 : -360 } : undefined
      }
      transition={spin ? { duration: 26, ...linear } : undefined}
    >
      {PETALS.map((d) => (
        <path
          key={d.slice(0, 24)}
          d={d}
          stroke="currentColor"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      ))}
    </motion.svg>
  )
}

const Ripples = ({ fast }: { fast: boolean }) => (
  <>
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        aria-hidden
        className="absolute inset-8 rounded-full border border-alta/35"
        initial={{ scale: 1.5, opacity: 0 }}
        animate={{ scale: 0.95, opacity: [0, 0.7, 0] }}
        transition={{
          duration: fast ? 1.4 : 2.6,
          delay: i * (fast ? 0.45 : 0.85),
          ease: "easeOut",
          repeat: Infinity,
        }}
      />
    ))}
  </>
)

const BARS = Array.from({ length: 32 }, (_, i) => i)

const Bars = () => (
  <>
    {BARS.map((i) => (
      <span
        key={i}
        aria-hidden
        className="absolute inset-0"
        style={{ transform: `rotate(${i * (360 / BARS.length)}deg)` }}
      >
        <motion.span
          className="absolute top-1 left-1/2 h-6 w-0.75 -translate-x-1/2 rounded-full bg-linear-to-b from-saffron to-alta"
          style={{ transformOrigin: "50% 124px" }}
          animate={{
            scaleY: [0.25, 1, 0.4, 0.85, 0.25],
            opacity: [0.5, 1, 0.6, 1, 0.5],
          }}
          transition={{
            duration: 1.1 + (i % 5) * 0.12,
            delay: (i % 8) * 0.07,
            ...loop,
          }}
        />
      </span>
    ))}
  </>
)

/* WebGL strand field — the orb's living depth layer. */
// const BRAND = ["#FFAE32", "#9E0B0F", "#750005", "#FFEEDD"]

const STRANDS: Record<
  OrbMode,
  {
    level: number
    speed: number
    count: number
    energy: number
    intensity: number
  }
> = {
  idle: { level: 0.12, speed: 0.55, count: 2, energy: 0.4, intensity: 0.85 },
  connecting: {
    level: 0.55,
    speed: 1.4,
    count: 3,
    energy: 0.9,
    intensity: 1.15,
  },
  listening: { level: 0.15, speed: 1.05, count: 2, energy: 0.75, intensity: 1 },
  hearing: { level: 0.3, speed: 1.25, count: 2, energy: 0.9, intensity: 1.1 },
  replying: { level: 0.3, speed: 1.3, count: 3, energy: 0.95, intensity: 1.15 },
  muted: { level: 0.06, speed: 0.4, count: 1, energy: 0.3, intensity: 0.6 },
}

// const OrbStrands = memo(function OrbStrands({
//   level,
//   mode,
// }: {
//   level: number
//   mode: OrbMode
// }) {
//   const cfg = STRANDS[mode]
//   return (
//     <div className="absolute inset-0 overflow-hidden rounded-full">
//       <Strands
//         colors={BRAND}
//         count={cfg.count}
//         speed={cfg.speed}
//         energy={cfg.energy}
//         intensity={cfg.intensity}
//         level={level}
//         listening={mode !== "idle"}
//         glass
//         glassSize={1.02}
//         rim={1.25}
//         glow={1.15}
//         interactive={false}
//         clickPulse={false}
//         intro={false}
//         className="size-full"
//       />
//     </div>
//   )
// })

export const Orb = memo(function Orb({
  mode,
  label,
  disabled,
  onClick,
  levelsRef,
}: {
  mode: OrbMode
  label: string
  disabled: boolean
  onClick: () => void
  levelsRef?: React.RefObject<{ user: number; bot: number }>
}) {
  const reduce = useReducedMotion()
  const animated = !reduce

  /* Poll loudness (or synthesize a pulse while connecting) at ~9fps; Strands
     lerps activity internally, so coarse updates look continuous. */
  const [level, setLevel] = useState(STRANDS[mode].level)
  useEffect(() => {
    const id = window.setInterval(() => {
      const src = STRANDS[mode]
      let target: number
      if (mode === "connecting") {
        target = 0.45 + 0.2 * Math.sin(Date.now() / 320)
      } else if (mode === "replying") {
        target = Math.max(src.level, levelsRef?.current.bot ?? 0)
      } else if (mode === "listening" || mode === "hearing") {
        target = Math.max(src.level, levelsRef?.current.user ?? 0)
      } else {
        target = src.level
      }
      setLevel(Math.round(target * 12) / 12)
    }, 110)
    return () => window.clearInterval(id)
  }, [mode, levelsRef])

  /* idle: breathing glow · listening: inward ripples · replying: voice bars.
     idle shows the filled logo; live states cross-fade to the outline mark. */
  const halo =
    mode === "idle" || mode === "muted"
      ? { scale: [1, 1.05, 1], opacity: [0.55, 0.8, 0.55] }
      : { scale: 1.04, opacity: 1 }

  return (
    <div className="relative grid size-72 place-items-center sm:size-80">
      <motion.div
        aria-hidden
        className="absolute inset-4 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand-saffron)_42%,transparent),color-mix(in_oklch,var(--brand-alta)_12%,transparent)_55%,transparent_75%)]"
        animate={animated ? halo : { opacity: 0.7 }}
        transition={
          mode === "idle" || mode === "muted"
            ? { duration: 4, ...loop }
            : { duration: 0.4 }
        }
      />
      {animated && (mode === "listening" || mode === "hearing") && (
        <Ripples fast={mode === "hearing"} />
      )}
      {animated && mode === "replying" && <Bars />}

      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        whileTap={animated ? { scale: 0.96 } : undefined}
        animate={
          animated
            ? {
                scale:
                  mode === "replying"
                    ? [1, 1.035, 1]
                    : mode === "hearing"
                      ? 1.04
                      : 1,
                filter: mode === "muted" ? "saturate(0.3)" : "saturate(1)",
              }
            : undefined
        }
        transition={
          mode === "replying"
            ? { duration: 0.9, ...loop }
            : { type: "spring", duration: 0.35, bounce: 0.2 }
        }
        className="relative grid size-40 place-items-center overflow-hidden rounded-full border border-white/70 bg-[radial-gradient(circle_at_30%_25%,var(--brand-saffron),var(--brand-alta)_58%,var(--brand-crimson))] shadow-2xl outline-none focus-visible:ring-4 focus-visible:ring-saffron/40 disabled:cursor-default sm:size-44"
      >
        {/* <OrbStrands level={level} mode={mode} /> */}
        <AnimatePresence initial={false} mode="popLayout">
          {mode === "idle" ? (
            <motion.span
              key="filled"
              className="grid place-items-center"
              initial={animated ? { opacity: 0, scale: 0.92 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.12 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Image
                src="/logo.svg"
                alt=""
                width={112}
                height={112}
                priority
                unoptimized
                className="size-24 drop-shadow-lg sm:size-28"
              />
            </motion.span>
          ) : (
            <motion.span
              key="outline"
              className="grid place-items-center text-cream"
              initial={animated ? { opacity: 0, scale: 0.92 } : false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              {mode === "connecting" ? (
                /* pulsing halo + two tilted outlines slowly counter-rotating */
                <>
                  <motion.span
                    aria-hidden
                    className="absolute inset-6 rounded-full bg-cream/10"
                    animate={{ scale: [1, 1.25], opacity: [0.5, 0] }}
                    transition={{ duration: 1.3, ...linear }}
                  />
                  <FlowerOutline
                    spin={animated ? "cw" : false}
                    className="absolute size-26 rotate-22 opacity-90 sm:size-30"
                  />
                  <FlowerOutline
                    spin={animated ? "ccw" : false}
                    className="absolute size-26 -rotate-22 opacity-55 sm:size-30"
                  />
                </>
              ) : (
                <FlowerOutline
                  spin={false}
                  className={
                    mode === "muted"
                      ? "size-24 opacity-60 sm:size-28"
                      : "size-24 sm:size-28"
                  }
                />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
})
