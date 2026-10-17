import { cn } from "@/lib/utils"

/**
 * Static scientific visual for the welcome banner — a coverage-trace ribbon.
 * Colour comes from design tokens; no animation, no fake data readouts.
 */
export function DataRibbon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none h-full w-full", className)}
    >
      <path
        d="M0 92 L24 92 L24 44 L48 44 L48 74 L72 74 L72 26 L96 26 L96 62
           L120 62 L120 34 L144 34 L144 84 L168 84 L168 20 L192 20 L192 56
           L216 56 L216 30 L240 30 L240 78 L264 78 L264 46 L288 46 L288 68
           L312 68 L312 92 L320 92"
        fill="none"
        style={{ stroke: "var(--accent-cyan)" }}
        strokeWidth="2"
        opacity="0.28"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0 104 C 40 84, 80 124, 120 104 S 200 84, 240 104 S 300 124, 320 104"
        fill="none"
        style={{ stroke: "var(--learning)" }}
        strokeWidth="1.5"
        opacity="0.24"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="0"
        y1="112"
        x2="320"
        y2="112"
        style={{ stroke: "var(--accent-cyan)" }}
        strokeWidth="1"
        opacity="0.18"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
