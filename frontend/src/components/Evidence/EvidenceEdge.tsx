import { type EdgeProps, getBezierPath } from "@xyflow/react"
import { memo } from "react"
import { cn } from "@/lib/utils"

const EDGE_COLORS: Record<string, string> = {
  membership: "var(--evidence-edge-membership)",
  provenance: "var(--evidence-edge-provenance)",
  support: "var(--evidence-edge-support)",
  citation: "var(--evidence-edge-citation)",
}

function EvidenceEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const kind = (data?.kind as string) || "membership"
  /** User-created relations (supports/contradicts) render dashed per Story 29. */
  const manual = (data?.manual as boolean) === true
  const label = (data?.label as string) || ""
  const stroke = EDGE_COLORS[kind] || EDGE_COLORS.membership

  return (
    <>
      <path
        id={id}
        className={cn(
          "fill-none transition-opacity",
          selected ? "opacity-100" : "opacity-70",
        )}
        d={edgePath}
        stroke={stroke}
        strokeWidth={selected ? 2.2 : 1.6}
        strokeDasharray={manual ? "6 5" : undefined}
        markerEnd={markerEnd}
      />
      {label && selected ? (
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dy={-6}
          className="text-[10px] fill-muted-foreground"
        >
          {label}
        </text>
      ) : null}
    </>
  )
}

export const EvidenceEdge = memo(EvidenceEdgeComponent)
