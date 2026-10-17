import { FlaskConical } from "lucide-react"

import { useDevFixtures } from "@/hooks/useDevFixtures"
import { cn } from "@/lib/utils"

/**
 * Amber chip shown globally while dev-fixture mode is on, so no fixture value
 * can be mistaken for real data.
 */
export function DevFixtureBadge({ className }: { className?: string }) {
  const { enabled } = useDevFixtures()

  if (!enabled) return null

  return (
    <div
      data-testid="dev-fixture-badge"
      className={cn(
        "fixed bottom-4 right-4 z-50 inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning shadow-lg backdrop-blur",
        className,
      )}
    >
      <FlaskConical className="size-3.5" />
      Dev fixtures — not real data
    </div>
  )
}
