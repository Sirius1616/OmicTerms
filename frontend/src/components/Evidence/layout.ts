import dagre from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"

export type LayoutDirection = "LR" | "TB"

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR",
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 200,
    marginx: 90,
    marginy: 70,
    align: "UL",
  })

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.width || 240, height: node.height || 78 })
  })
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 240) / 2,
        y: nodeWithPosition.y - (node.height || 78) / 2,
      },
      style: {
        ...(node.style || {}),
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
