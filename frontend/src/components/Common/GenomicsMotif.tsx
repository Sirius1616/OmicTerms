import { cn } from "@/lib/utils"

/** Coverge-trace waveform — the depth-of-coverage visual from sequencing. */
export function CoverageTrace({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("absolute inset-x-0 bottom-0", className)}
    >
      <defs>
        <linearGradient id="traceStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.55" stopColor="#22c55e" />
          <stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <path
        d="M0 90 L50 90 L50 40 L100 40 L100 70 L150 70 L150 20 L200 20 L200 60
           L250 60 L250 30 L300 30 L300 80 L350 80 L350 15 L400 15 L400 55
           L450 55 L450 25 L500 25 L500 75 L550 75 L550 40 L600 40 L600 90"
        fill="none"
        stroke="url(#traceStroke)"
        strokeWidth="3"
      />
      <path
        d="M0 100 L600 100"
        fill="none"
        stroke="url(#traceStroke)"
        strokeWidth="1"
        opacity="0.4"
      />
    </svg>
  )
}

const BASES = [
  { letter: "A", color: "text-adenine" },
  { letter: "T", color: "text-thymine" },
  { letter: "C", color: "text-cytosine" },
  { letter: "G", color: "text-guanine" },
] as const

/** The A/T/C/G base-pair quartet in the industry color code. */
export function BasePairCode({ className }: { className?: string }) {
  return (
    <div
      role="img"
      className={cn(
        "flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-2 py-1",
        className,
      )}
      aria-label="Adenine, thymine, cytosine, guanine base-pair colors"
    >
      <span className="readout text-[9px] uppercase tracking-widest text-muted-foreground">
        Seq
      </span>
      <div className="flex items-center gap-1">
        {BASES.map(({ letter, color }) => (
          <span
            key={letter}
            className={cn(
              "readout size-4 shrink-0 rounded-full border border-border/50 text-center text-[9px] font-bold leading-[14px]",
              color,
            )}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  )
}

const CHROMOSOMES = [
  0.62, 0.58, 0.52, 0.5, 0.48, 0.46, 0.44, 0.4, 0.36, 0.34, 0.32, 0.3,
] as const

/** Karyotype-style chromosome bars (pair of banded rods per autosome). */
export function ChromosomeBars({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex select-none items-end justify-center gap-1",
        className,
      )}
      aria-hidden="true"
    >
      {CHROMOSOMES.map((height, index) => (
        <div key={index} className="flex gap-px">
          {[0, 1].map((rod) => (
            <div
              key={rod}
              className="w-1.5 rounded-t-sm border border-border/40 bg-gradient-to-b from-primary/70 via-primary/30 to-transparent"
              style={{ height: `${height * 100}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const COORDINATES = [
  { label: "chr1:108,980,221", className: "text-adenine" },
  { label: "AF=0.484", className: "text-thymine" },
  { label: "DP=38", className: "text-guanine" },
  { label: "GQ=99", className: "text-cytosine" },
] as const

/** Monospace lab readout strip — genomic locus + QC metrics. */
export function LabReadout({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "readout flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      {COORDINATES.map(({ label, className: color }) => (
        <span key={label} className={color}>
          {label}
        </span>
      ))}
    </div>
  )
}

/** Strand accent divider — a thin helix-styled line. */
export function HelixDivider({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 16"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-4 w-full opacity-30", className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M0 8 C 50 2, 100 14, 150 8 S 250 2, 300 8 S 400 14, 450 8 S 550 2, 600 8" />
        <path d="M0 8 C 50 14, 100 2, 150 8 S 250 14, 300 8 S 400 2, 450 8 S 550 14, 600 8" />
      </g>
    </svg>
  )
}
