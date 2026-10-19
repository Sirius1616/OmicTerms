import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

const PERIOD = 200
const AXIS = 100
const AMP = 62
const SAMPLES = 56
const RUNGS = [25, 75, 125, 175]
const BASES = [
  "var(--pa-adenine)",
  "var(--pa-thymine)",
  "var(--pa-guanine)",
  "var(--pa-cytosine)",
]

function strandPath(sign: number) {
  let d = ""
  for (let i = 0; i <= SAMPLES; i++) {
    const y = (PERIOD * i) / SAMPLES
    const x = AXIS + sign * AMP * Math.sin((2 * Math.PI * y) / PERIOD)
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `
  }
  return d.trim()
}

function HelixPeriod() {
  return (
    <svg
      viewBox={`0 0 ${AXIS * 2} ${PERIOD}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-1/2 w-full shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id="heroHelixFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-cyan)" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="var(--primary)" stopOpacity="1" />
          <stop offset="1" stopColor="var(--accent-cyan)" stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id="heroHelixBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent-cyan)" stopOpacity="0.08" />
          <stop offset="0.5" stopColor="var(--accent-cyan)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--accent-cyan)" stopOpacity="0.08" />
        </linearGradient>
        <filter id="heroHelixGlow" x="-80%" y="-30%" width="260%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id="heroHelixSoft" x="-80%" y="-30%" width="260%" height="160%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      <path
        d={strandPath(-1)}
        fill="none"
        stroke="url(#heroHelixBack)"
        strokeWidth="5"
        strokeLinecap="round"
        filter="url(#heroHelixSoft)"
      />

      {RUNGS.map((y, index) => {
        const x = AMP * Math.sin((2 * Math.PI * y) / PERIOD)
        const left = AXIS - x
        const right = AXIS + x
        return (
          <g key={y}>
            <line
              x1={left}
              y1={y}
              x2={right}
              y2={y}
              stroke="var(--accent-cyan)"
              strokeWidth="1.4"
              opacity="0.5"
            />
            <circle
              cx={left}
              cy={y}
              r="3.4"
              fill={BASES[index % BASES.length]}
              className="gm-breathe"
              style={{ animationDelay: `${index * 420}ms` }}
            />
            <circle
              cx={right}
              cy={y}
              r="3.4"
              fill={BASES[(index + 2) % BASES.length]}
              className="gm-breathe"
              style={{ animationDelay: `${index * 420 + 210}ms` }}
            />
          </g>
        )
      })}

      <path
        d={strandPath(1)}
        fill="none"
        stroke="url(#heroHelixFront)"
        strokeWidth="9"
        strokeLinecap="round"
        opacity="0.55"
        filter="url(#heroHelixGlow)"
      />
      <path
        d={strandPath(1)}
        fill="none"
        stroke="url(#heroHelixFront)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        d={strandPath(1)}
        fill="none"
        stroke="var(--foreground)"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  )
}

function DriftParticle({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "hero-particle absolute size-1 rounded-full bg-accent-cyan/70",
        className,
      )}
      style={style}
    />
  )
}

export function HeroHelix({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none", className)}>
      <div className="hero-helix-tilt h-full w-full">
        <div className="hero-helix-flow flex h-[200%] w-full flex-col">
          <HelixPeriod />
          <HelixPeriod />
        </div>
      </div>
      <DriftParticle
        className="left-[26%] top-[18%]"
        style={{ animationDelay: "0s" }}
      />
      <DriftParticle
        className="left-[68%] top-[42%]"
        style={{ animationDelay: "2.4s" }}
      />
      <DriftParticle
        className="left-[40%] top-[70%]"
        style={{ animationDelay: "4.1s" }}
      />
      <DriftParticle
        className="left-[74%] top-[80%]"
        style={{ animationDelay: "1.3s" }}
      />
    </div>
  )
}
