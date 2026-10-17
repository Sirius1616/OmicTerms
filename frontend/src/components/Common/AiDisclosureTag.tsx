import { cn } from "@/lib/utils"

/**
 * Marks AI-generated content. Exported now; consumed once grounded AI features
 * ship (Stories 41+). Never imply AI output is authoritative.
 */
export function AiDisclosureTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-learning/40 bg-learning/10 px-2 py-0.5 text-[11px] font-medium text-learning",
        className,
      )}
    >
      AI-generated — verify against sources
    </span>
  )
}
