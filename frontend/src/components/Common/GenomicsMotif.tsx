import { cn } from "@/lib/utils"

/** Coverage-trace waveform — the depth-of-coverage visual from sequencing. */
export function CoverageTrace({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0",
        className,
      )}
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

/** Bright cyan beam sweeping across an overflown panel — a sequencer read. */
export function ScanBeam({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className,
      )}
    >
      <div className="gm-scan absolute top-0 h-full w-24 -skew-x-12 bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
    </div>
  )
}

const BASES = [
  { letter: "A", color: "text-adenine", delay: "0ms" },
  { letter: "T", color: "text-thymine", delay: "500ms" },
  { letter: "C", color: "text-cytosine", delay: "1000ms" },
  { letter: "G", color: "text-guanine", delay: "1500ms" },
] as const

/** The A/T/C/G base-pair quartet in the industry color code, gently breathing. */
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
        {BASES.map(({ letter, color, delay }) => (
          <span
            key={letter}
            className={cn(
              "readout size-4 shrink-0 rounded-full border border-border/50 text-center text-[9px] font-bold leading-[14px] gm-breathe",
              color,
            )}
            style={{ animationDelay: delay }}
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

/** Karyotype-style chromosome bars shimmering in a staggered waking beat. */
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
              className="w-1.5 rounded-t-sm border border-border/40 bg-gradient-to-b from-primary/70 via-primary/30 to-transparent gm-chromo"
              style={{
                height: `${height * 100}%`,
                animationDelay: `${index * 140}ms`,
              }}
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

/** Monospace lab readout strip — genomic locus + QC metrics, with a live caret. */
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
      <span className="gm-caret select-none text-cyan-300">▍</span>
    </div>
  )
}

/** Strand accent divider — a thin helix whose strands drift past each other. */
export function HelixDivider({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 16"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("h-4 w-full opacity-30", className)}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          d="M0 8 C 50 2, 100 14, 150 8 S 250 2, 300 8 S 400 14, 450 8 S 550 2, 600 8"
          className="gm-helixl"
        />
        <path
          d="M0 8 C 50 14, 100 2, 150 8 S 250 14, 300 8 S 400 2, 450 8 S 550 14, 600 8"
          className="gm-helixr"
        />
      </g>
    </svg>
  )
}

/** Endlessly scrolling tower of base-pair letters — a flowcell read. */
export function BaseRain({ className }: { className?: string }) {
  const sequence = (
    <>
      <span className="text-adenine">A</span>
      <span className="text-thymine">T</span>
      <span className="text-guanine">G</span>
      <span className="text-cytosine">C</span>
    </>
  )
  const cell = (
    <span className="readout flex w-1/2 shrink-0 items-center justify-between px-4 text-[10px] font-bold tracking-[0.35em] opacity-60">
      {Array.from({ length: 26 }).map((_, index) => (
        <span key={index} className="shrink-0">
          {sequence}
        </span>
      ))}
    </span>
  )
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative select-none overflow-hidden",
        className,
      )}
    >
      <div className="gm-baserain flex w-[200%]">
        {cell}
        {cell}
      </div>
    </div>
  )
}

function HelixCell() {
  return (
    <svg
      viewBox="0 0 180 220"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-full w-1/2 shrink-0"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.7">
        <path d="M0 110 C 30 55, 60 55, 90 110 C 120 165, 150 165, 180 110" />
        <path d="M0 110 C 30 165, 60 165, 90 110 C 120 55, 150 55, 180 110" />
        {[15, 45, 75, 105, 135, 165].map((x) => (
          <line key={x} x1={x} y1="82" x2={x} y2="138" strokeWidth="1" />
        ))}
      </g>
      {[
        { x: 15, c: "fill-adenine" },
        { x: 45, c: "fill-thymine" },
        { x: 75, c: "fill-guanine" },
        { x: 105, c: "fill-cytosine" },
        { x: 135, c: "fill-adenine" },
        { x: 165, c: "fill-thymine" },
      ].map(({ x, c }) => (
        <circle
          key={x}
          cx={x}
          cy="110"
          r="5"
          className={cn("gm-breathe", c)}
          style={{ animationDelay: `${(x / 165) * 2000}ms` }}
        />
      ))}
    </svg>
  )
}

/** A double helix that visually spins — two cells looped, strand-winding. */
export function HelixSpinner({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none text-primary/80", className)}
    >
      <div className="relative h-full w-full overflow-hidden">
        <div className="gm-dna flex w-[200%]">
          <HelixCell />
          <HelixCell />
        </div>
      </div>
    </div>
  )
}

/** Blinking 'analyzing' indicator — a live run state for docs/samples. */
export function AnalyzingIndicator({
  className,
  label = "ANALYZING",
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      className={cn(
        "readout inline-flex items-center gap-2 rounded-full border border-cytosine/50 bg-cytosine/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-cytosine",
        className,
      )}
    >
      <span className="size-1.5 animate-[spin_1s_linear_infinite] rounded-full border-2 border-cytosine border-t-transparent" />
      {label}
    </span>
  )
}

const READ_COLORS = [
  "bg-adenine",
  "bg-thymine",
  "bg-cytosine",
  "bg-guanine",
] as const

function readWidth(index: number) {
  return 22 + ((index * 37) % 49)
}

function readGap(index: number) {
  return 7 + ((index * 13) % 11)
}

/** One half of the streaming read batch (identical halves loop seamlessly). */
function ReadBatch() {
  return (
    <div className="flex w-1/2 shrink-0 items-center px-1">
      {Array.from({ length: 48 }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "inline-block h-[3px] shrink-0 rounded-full opacity-70",
            READ_COLORS[index % READ_COLORS.length],
          )}
          style={{ width: readWidth(index), marginRight: readGap(index) }}
        />
      ))}
    </div>
  )
}

/** A flowcell lane — sequencing reads streaming continuously through it. */
export function FlowLane({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none relative overflow-hidden rounded-lg border border-border/50 bg-background/60",
        className,
      )}
    >
      <span className="readout absolute left-2 top-1/2 z-10 -translate-y-1/2 bg-background/80 px-1.5 py-0.5 text-[8px] uppercase tracking-widest text-muted-foreground">
        flowcell · lane 1
      </span>
      <div className="gm-flow-track flex h-full w-[200%] items-center">
        <ReadBatch />
        <ReadBatch />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-28 w-px bg-border/40" />
      <div className="pointer-events-none absolute inset-y-0 right-3 w-px bg-border/40" />
    </div>
  )
}
