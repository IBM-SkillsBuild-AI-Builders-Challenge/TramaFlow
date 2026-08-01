import type { Node, Edge } from "reactflow";

// ─── Node Data Shapes ─────────────────────────────────────────────────────────

export interface StoryNodeData {
  type: "story";
  title: string;
  content: string;
  imageUrl?: string;
  tags?: string[];
}

export interface ChoiceNodeData {
  type: "choice";
  /** The question or prompt shown to the player */
  prompt: string;
  /** List of choices — each becomes an outgoing edge */
  choices: ChoiceOption[];
  /** Feature #3 — collapsed state hides the long choice list body */
  collapsed?: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

/**
 * Feature #4 — NoteNode
 * Pure visual post-it. No handles. Ignored by the script exporter.
 */
export interface NoteNodeData {
  type: "note";
  content: string;
}

/** Union of all node data shapes */
export type AnyNodeData = StoryNodeData | ChoiceNodeData | NoteNodeData;

// ─── React Flow typed aliases ─────────────────────────────────────────────────

export type StoryFlowNode = Node<AnyNodeData>;

/**
 * Feature #5 — Edges carry an optional visible label (the decision text).
 * React Flow renders labelBgStyle / labelStyle natively when `label` is set.
 */
export type StoryFlowEdge = Edge<{ label?: string }>;

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  nodeAction?: NodeAction;
}

// ─── AI → Canvas actions ──────────────────────────────────────────────────────

export type NodeActionType =
  | "ADD_NODES"
  | "REPLACE_GRAPH"
  | "CLEAR_GRAPH"
  /**
   * Fix #4 — granular patch actions.
   * PATCH_NODES: merges `data` fields onto matching nodes (matched by id).
   *   Use to update tags, title, content without replacing the whole graph.
   * PATCH_EDGES: updates `label` on matching edges (matched by id).
   *   Use to rename route labels without re-creating edges.
   */
  | "PATCH_NODES"
  | "PATCH_EDGES";

/** Minimal shape for a node patch — only id + data fields to merge */
export interface NodePatch {
  id: string;
  data: Partial<AnyNodeData>;
}

/** Minimal shape for an edge patch — only id + label */
export interface EdgePatch {
  id: string;
  label: string;
}

export interface NodeAction {
  type: NodeActionType;
  /** Used by ADD_NODES / REPLACE_GRAPH */
  nodes?: StoryFlowNode[];
  /** Used by ADD_NODES / REPLACE_GRAPH */
  edges?: StoryFlowEdge[];
  /** Used by PATCH_NODES */
  nodePatches?: NodePatch[];
  /** Used by PATCH_EDGES */
  edgePatches?: EdgePatch[];
  /**
   * IDs of nodes the AI was asked to delete.
   * Applied before the smart-merge so removed nodes never re-appear.
   */
  deletedNodeIds?: string[];
}

// ─── Story parser ─────────────────────────────────────────────────────────────

export interface ParsedStory {
  title: string;
  nodes: StoryFlowNode[];
  edges: StoryFlowEdge[];
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface ChatRequestPayload {
  messages: Pick<ChatMessage, "role" | "content">[];
  graphContext?: {
    nodes: StoryFlowNode[];
    edges: StoryFlowEdge[];
  };
}

export interface ChatResponsePayload {
  message: ChatMessage;
  nodeAction?: NodeAction;
}
