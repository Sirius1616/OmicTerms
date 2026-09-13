import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Dna,
  FlaskConical,
  Pipette,
  ScatterChart,
} from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const SLIDES = [
  {
    icon: Activity,
    term: "Coverage depth",
    blurb:
      "How many times each base pair was read — higher coverage means more trust in every call.",
    color: "text-guanine",
    dot: "bg-guanine",
  },
  {
    icon: Dna,
    term: "Variant calling",
    blurb:
      "Finding single-letter differences between a genome and its reference sequence.",
    color: "text-adenine",
    dot: "bg-adenine",
  },
  {
    icon: BarChart3,
    term: "Differential expression",
    blurb:
      "Which genes turn on or off between two conditions, and how strongly.",
    color: "text-thymine",
    dot: "bg-thymine",
  },
  {
    icon: ScatterChart,
    term: "Principal components",
    blurb:
      "Squashing thousands of genes into a 2-D plot so hidden patterns become visible.",
    color: "text-cytosine",
    dot: "bg-cytosine",
  },
  {
    icon: Pipette,
    term: "Methylation",
    blurb:
      "Chemical tags that switch genes on or off without changing the DNA letters.",
    color: "text-guanine",
    dot: "bg-guanine",
  },
  {
    icon: FlaskConical,
    term: "ChIP-seq peaks",
    blurb:
      "Where proteins physically bind the genome, mapped base pair by base pair.",
    color: "text-primary",
    dot: "bg-primary",
  },
] as const

/** Auto-advancing filmstrip of genomics concepts — specimen slides. */
export function SpecimenDeck({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length)
    }, 4100)
    return () => window.clearInterval(timer)
  }, [paused])

  const go = (next: number) => setIndex((next + SLIDES.length) % SLIDES.length)

  return (
    <Card
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between border-b px-6 py-3">
        <h2 className="text-sm font-semibold">Genomics at a glance</h2>
        <span className="readout text-[9px] uppercase tracking-widest text-muted-foreground">
          omics 101
        </span>
      </div>
      <CardContent className="p-0">
        <div
          className="flex h-44 transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map(({ icon: Icon, term, blurb, color }, i) => (
            <div
              key={term}
              className="flex w-full shrink-0 items-center gap-5 px-6 py-5"
            >
              <div
                className={cn(
                  "shrink-0 rounded-xl border border-border/60 bg-muted/40 p-4",
                  color,
                )}
              >
                <Icon className="size-8" />
              </div>
              <div className="min-w-0">
                <p className="readout text-[9px] uppercase tracking-widest text-muted-foreground">
                  specimen {String(i + 1).padStart(2, "0")} / {SLIDES.length}
                </p>
                <h3 className="text-lg font-semibold">{term}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{blurb}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t px-6 py-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <div className="flex flex-1 items-center gap-2">
            {SLIDES.map(({ dot }, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 flex-1 rounded-full bg-muted transition-colors duration-300",
                  i === index ? dot : "hover:bg-muted-foreground/30",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="h-1 bg-muted">
          <div
            key={index}
            className={cn("gm-progress h-full", SLIDES[index].dot)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
