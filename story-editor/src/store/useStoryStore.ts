import { create } from "zustand";
import { applyNodeChanges, applyEdgeChanges, addEdge } from "reactflow";
import type { NodeChange, EdgeChange, Connection } from "reactflow";
import { v4 as uuidv4 } from "uuid";
import type {
  StoryFlowNode,
  StoryFlowEdge,
  ChatMessage,
  NodeAction,
  AnyNodeData,
  StoryNodeData,
} from "@/types/story";
import type { WorkspaceMode } from "@/types/workspace";

// ─── Smart Merge helpers ──────────────────────────────────────────────────────

/**
 * Merges an AI-generated node list into the current canvas nodes with these rules:
 *
 *  • EXISTING id → keep the user's `data` untouched; only merge incoming `tags`
 *    into the existing tag set (union, no duplicates).
 *  • NEW id      → add the node as-is.
 *
 * This prevents the AI from silently overwriting the user's edited content while
 * still allowing it to extend the graph with new nodes and tag annotations.
 */
function mergeNodes(
  current: StoryFlowNode[],
  incoming: StoryFlowNode[]
): StoryFlowNode[] {
  const existingIds = new Set(current.map((n) => n.id));

  // Nodes the AI sent that already live on the canvas → extract tags only
  const tagPatches = new Map<string, string[]>();
  for (const n of incoming) {
    if (existingIds.has(n.id)) {
      const incomingTags: string[] =
        (n.data as StoryNodeData).tags ?? [];
      tagPatches.set(n.id, incomingTags);
    }
  }

  // Apply tag patches to existing nodes (union merge, no duplicates)
  const patched = current.map((n) => {
    const newTags = tagPatches.get(n.id);
    if (!newTags?.length) return n;
    const existingTags: string[] = (n.data as StoryNodeData).tags ?? [];
    const merged = Array.from(new Set([...existingTags, ...newTags]));
    return {
      ...n,
      data: { ...n.data, tags: merged } as AnyNodeData,
    } as StoryFlowNode;
  });

  // Append only genuinely new nodes
  const brandNew = incoming.filter((n) => !existingIds.has(n.id));
  return [...patched, ...brandNew];
}

/**
 * Merges incoming edges into the current edge list.
 * Edges whose `id` already exists are skipped to avoid duplicates.
 * Edges that reference node IDs not present in the final merged node set
 * are also dropped — a dangling edge would break React Flow's renderer.
 */
function mergeEdges(
  current: StoryFlowEdge[],
  incoming: StoryFlowEdge[],
  allNodeIds: Set<string>
): StoryFlowEdge[] {
  const existingEdgeIds = new Set(current.map((e) => e.id));

  const fresh = incoming.filter((e) => {
    if (existingEdgeIds.has(e.id)) return false;           // already present
    if (!allNodeIds.has(e.source)) return false;           // dangling source
    if (!allNodeIds.has(e.target)) return false;           // dangling target
    return true;
  });

  return [...current, ...fresh];
}

// ─── Node collision resolution ────────────────────────────────────────────────

const NODE_SIZES: Record<string, { w: number; h: number }> = {
  storyNode:  { w: 310, h: 220 },
  choiceNode: { w: 310, h: 200 },
  noteNode:   { w: 240, h: 130 },
};
const COLLISION_PAD = 28; // minimum gap (px) enforced between node edges

/**
 * Pushes overlapping nodes apart using AABB collision resolution.
 * Runs up to 6 passes so cascading overlaps are also resolved.
 * The first node in the array is always the anchor and is never moved.
 */
function resolveOverlaps(nodes: StoryFlowNode[]): StoryFlowNode[] {
  if (nodes.length < 2) return nodes;

  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  for (let pass = 0; pass < 6; pass++) {
    let hadOverlap = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const a = result[i];
        const b = result[j];
        const sA = NODE_SIZES[a.type ?? "storyNode"] ?? NODE_SIZES.storyNode;
        const sB = NODE_SIZES[b.type ?? "storyNode"] ?? NODE_SIZES.storyNode;

        const ax1 = a.position.x, ax2 = a.position.x + sA.w + COLLISION_PAD;
        const ay1 = a.position.y, ay2 = a.position.y + sA.h + COLLISION_PAD;
        const bx1 = b.position.x, bx2 = b.position.x + sB.w + COLLISION_PAD;
        const by1 = b.position.y, by2 = b.position.y + sB.h + COLLISION_PAD;

        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);

        if (overlapX > 0 && overlapY > 0) {
          hadOverlap = true;
          // Push b — prefer the axis with the smaller overlap (minimum displacement)
          if (overlapX <= overlapY) {
            result[j] = {
              ...result[j],
              position: {
                ...result[j].position,
                x: result[j].position.x + (a.position.x < b.position.x ? overlapX : -overlapX),
              },
            };
          } else {
            result[j] = {
              ...result[j],
              position: {
                ...result[j].position,
                y: result[j].position.y + (a.position.y < b.position.y ? overlapY : -overlapY),
              },
            };
          }
        }
      }
    }
    if (!hadOverlap) break;
  }

  return result;
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface StoryState {
  // Workspace
  workspaceMode: WorkspaceMode | null;
  setWorkspaceMode: (mode: WorkspaceMode) => void;

  // Canvas
  nodes: StoryFlowNode[];
  edges: StoryFlowEdge[];

  // Chat
  messages: ChatMessage[];
  isAiThinking: boolean;

  // Canvas mutations
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  /**
   * Feature #5 — onConnect now accepts an optional label so that
   * a choice's text can be stamped onto the created edge.
   */
  onConnect: (connection: Connection, label?: string) => void;
  addNode: (node: StoryFlowNode) => void;
  updateNodeData: (id: string, data: Partial<AnyNodeData>) => void;
  removeNode: (id: string) => void;
  /** Fix #2 — rename an edge's label directly */
  updateEdgeLabel: (id: string, label: string) => void;
  applyNodeAction: (action: NodeAction) => void;
  clearGraph: () => void;

  // Clipboard
  clipboard: { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] } | null;
  isPasteMode: boolean;
  copySelected: () => void;
  pasteAtPosition: (x: number, y: number) => void;
  cancelPaste: () => void;

  // Chat mutations
  addMessage: (message: ChatMessage) => void;
  setAiThinking: (thinking: boolean) => void;
  clearMessages: () => void;
}

// ─── Initial demo nodes ───────────────────────────────────────────────────────

const STORY_INITIAL_NODES: StoryFlowNode[] = [
  {
    id: "node-start",
    type: "storyNode",
    position: { x: 250, y: 50 },
    data: {
      type: "story",
      title: "The Beginning",
      content:
        "You wake up in a dark forest. The wind howls through the trees. A faint light flickers in the distance.",
      tags: ["intro"],
    } as StoryNodeData,
  },
];

const TICKET_INITIAL_NODES: StoryFlowNode[] = [
  {
    id: "node-ticket-start",
    type: "storyNode",
    position: { x: 250, y: 50 },
    data: {
      type: "story",
      title: "TICKET-001 · User Authentication",
      content:
        "Implement JWT-based login and registration endpoints. Acceptance criteria: POST /auth/login returns a signed token; rate limiting applied; unit tests passing.",
      tags: ["backend", "sprint-1"],
    } as StoryNodeData,
  },
];

/** Returns the correct demo node set for the selected workspace mode */
function getInitialNodes(mode: WorkspaceMode): StoryFlowNode[] {
  return mode === "ticket" ? TICKET_INITIAL_NODES : STORY_INITIAL_NODES;
}

// Keep a single reference for the default (pre-selection) canvas
const initialNodes = STORY_INITIAL_NODES;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStoryStore = create<StoryState>((set, get) => ({
  // Workspace — null means the user hasn't chosen a mode yet (shows picker)
  workspaceMode: null,
  setWorkspaceMode: (mode) =>
    set({ workspaceMode: mode, nodes: getInitialNodes(mode), edges: [], messages: [] }),

  nodes: initialNodes,
  edges: [],
  messages: [],
  isAiThinking: false,

  // Clipboard initial state
  clipboard: null,
  isPasteMode: false,

  // ── Canvas ──────────────────────────────────────────────────────────────────

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as unknown as StoryFlowNode[],
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges) as unknown as StoryFlowEdge[],
    })),

  // Feature #5: stamp an optional label on new edges
  onConnect: (connection, label) =>
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id: uuidv4(),
          animated: true,
          // Only set label when provided — React Flow renders it natively
          ...(label ? { label } : {}),
        },
        state.edges
      ) as unknown as StoryFlowEdge[],
    })),

  addNode: (node) =>
    set((state) => ({ nodes: resolveOverlaps([...state.nodes, node]) })),

  updateNodeData: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? ({ ...n, data: { ...n.data, ...data } as AnyNodeData } as StoryFlowNode)
          : n
      ),
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  // Fix #2 — update a single edge's label in place
  updateEdgeLabel: (id, label) =>
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === id ? { ...e, label: label || undefined } : e
      ),
    })),

  applyNodeAction: (action) => {
    const { nodes, edges } = get();
    switch (action.type) {
      case "ADD_NODES": {
        // 1. Remove any nodes the AI was asked to delete, plus their edges.
        const deletedIds = new Set(action.deletedNodeIds ?? []);
        const survivingNodes = deletedIds.size
          ? nodes.filter((n) => !deletedIds.has(n.id))
          : nodes;
        const survivingEdges = deletedIds.size
          ? edges.filter(
              (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)
            )
          : edges;

        // 2. Smart-merge new nodes into the survivors, then resolve overlaps.
        const mergedNodes = resolveOverlaps(mergeNodes(survivingNodes, action.nodes ?? []));
        const allNodeIds = new Set(mergedNodes.map((n) => n.id));

        // 3. Smart-merge new edges (dangling-edge guard included).
        const mergedEdges = mergeEdges(
          survivingEdges,
          action.edges ?? [],
          allNodeIds
        );
        set({ nodes: mergedNodes, edges: mergedEdges });
        break;
      }
      case "REPLACE_GRAPH":
        set({ nodes: action.nodes ?? [], edges: action.edges ?? [] });
        break;
      case "CLEAR_GRAPH":
        set({ nodes: [], edges: [] });
        break;
      // Fix #4 — PATCH_NODES: merge data fields onto existing nodes by id
      case "PATCH_NODES":
        if (action.nodePatches?.length) {
          set((state) => ({
            nodes: state.nodes.map((n) => {
              const patch = action.nodePatches!.find((p) => p.id === n.id);
              if (!patch) return n;
              return {
                ...n,
                data: { ...n.data, ...patch.data } as AnyNodeData,
              } as StoryFlowNode;
            }),
          }));
        }
        break;
      // Fix #4 — PATCH_EDGES: update label on existing edges by id
      case "PATCH_EDGES":
        if (action.edgePatches?.length) {
          set((state) => ({
            edges: state.edges.map((e) => {
              const patch = action.edgePatches!.find((p) => p.id === e.id);
              if (!patch) return e;
              return { ...e, label: patch.label || undefined };
            }),
          }));
        }
        break;
    }
  },

  clearGraph: () => set({ nodes: [], edges: [] }),

  // ── Clipboard ───────────────────────────────────────────────────────────────

  copySelected: () =>
    set((state) => {
      const selectedNodes = state.nodes.filter((n) => n.selected);
      if (selectedNodes.length === 0) return state;
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const selectedEdges = state.edges.filter(
        (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
      );
      return {
        clipboard: { nodes: selectedNodes, edges: selectedEdges },
        isPasteMode: true,
      };
    }),

  pasteAtPosition: (x, y) =>
    set((state) => {
      if (!state.clipboard || state.clipboard.nodes.length === 0) return state;
      const { nodes: clipNodes, edges: clipEdges } = state.clipboard;

      // Center of the clipboard group
      const cx = clipNodes.reduce((s, n) => s + n.position.x, 0) / clipNodes.length;
      const cy = clipNodes.reduce((s, n) => s + n.position.y, 0) / clipNodes.length;

      // Assign new unique IDs
      const idMap = new Map<string, string>();
      clipNodes.forEach((n) => idMap.set(n.id, uuidv4()));

      const newNodes: StoryFlowNode[] = clipNodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        position: { x: x + (n.position.x - cx), y: y + (n.position.y - cy) },
        selected: true,
      }));

      // Remap edge endpoints to new IDs
      const newEdges: StoryFlowEdge[] = clipEdges.map((e) => ({
        ...e,
        id: uuidv4(),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
      }));

      // Deselect old nodes, add pasted nodes, resolve any overlaps
      const deselected = state.nodes.map((n) => ({ ...n, selected: false }));
      return {
        nodes: resolveOverlaps([...deselected, ...newNodes]),
        edges: [...state.edges, ...newEdges],
        isPasteMode: false,
      };
    }),

  cancelPaste: () => set({ isPasteMode: false }),

  // ── Chat ────────────────────────────────────────────────────────────────────

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  setAiThinking: (thinking) => set({ isAiThinking: thinking }),

  clearMessages: () => set({ messages: [] }),
}));
