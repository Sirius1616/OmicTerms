import dagre from "@dagrejs/dagre"
import type { Edge, Node } from "@xyflow/react"

export type LayoutDirection = "LR" | "TB"

const NODE_WIDTH = 240
const NODE_HEIGHT = 78
/**
 * Above this many nodes, dagre's simulation dominates the render budget
 * (measured ~2s for a 521-node snapshot), so a deterministic O(n) layered
 * layout is used instead: nodes are ranked by BFS-like topological depth
 * along edge direction and stacked within each layer, matching the approved
 * left-to-right column design.
 */
const DAGRE_MAX_NODES = 200

/**
 * O(n) layered layout for very large snapshots. Ranks follow edge direction
 * (source before target), matching the containment flow; ties keep arrival
 * order so the layout is stable across renders.
 */
function computeLayeredLayout(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map<string, Node>()
  for (const node of nodes) byId.set(node.id, node)
  const indegree = new Map<string, number>()
  const children = new Map<string, string[]>()
  for (const node of nodes) indegree.set(node.id, 0)
  for (const edge of edges) {
    if (edge.source === edge.target || !byId.has(edge.target)) continue
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    children.set(edge.source, [
      ...(children.get(edge.source) ?? []),
      edge.target,
    ])
  }

  const rank = new Map<string, number>()
  let frontier: string[] = []
  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) {
      rank.set(node.id, 0)
      frontier.push(node.id)
    }
  }
  let level = 0
  while (frontier.length > 0) {
    const next: string[] = []
    for (const sourceId of frontier) {
      for (const targetId of children.get(sourceId) ?? []) {
        rank.set(targetId, Math.max(rank.get(targetId) ?? 0, level + 1))
        const remaining = (indegree.get(targetId) ?? 0) - 1
        indegree.set(targetId, remaining)
        if (remaining === 0) next.push(targetId)
      }
    }
    frontier = next
    level += 1
  }
  // Unreached nodes (isolated) default to rank 0 — consistent, never guessed.
  for (const node of nodes) {
    if (!rank.has(node.id)) rank.set(node.id, 0)
  }

  const slotPerRank = new Map<number, number>()
  const layered = nodes.map((node) => {
    const r = rank.get(node.id) ?? 0
    const slot = slotPerRank.get(r) ?? 0
    slotPerRank.set(r, slot + 1)
    return {
      ...node,
      position:
        direction === "LR"
          ? { x: r * (NODE_WIDTH + 200), y: slot * (NODE_HEIGHT + 50) }
          : { x: slot * (NODE_WIDTH + 50), y: r * (NODE_HEIGHT + 200) },
      style: {
        ...(node.style || {}),
      },
    }
  })

  return { nodes: layered, edges }
}

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR",
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length > DAGRE_MAX_NODES) {
    return computeLayeredLayout(nodes, edges, direction)
  }
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
