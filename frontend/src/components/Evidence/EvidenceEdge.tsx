import { type EdgeProps, getBezierPath } from "@xyflow/react"
import { memo } from "react"
import { cn } from "@/lib/utils"

const EDGE_COLORS: Record<string, string> = {
  membership: "rgba(148, 167, 196, 0.8)",
  provenance: "rgba(66, 217, 245, 0.9)",
  support: "rgba(167, 139, 250, 0.9)",
  citation: "rgba(245, 185, 66, 0.9)",
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
