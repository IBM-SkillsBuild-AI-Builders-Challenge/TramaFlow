"use client";

import { useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  useStore,
} from "reactflow";
import "reactflow/dist/style.css";

import { v4 as uuidv4 } from "uuid";
import { Plus, GitBranch, ShieldAlert, StickyNote, Upload, Trash2, Clipboard } from "lucide-react";
import { useTheme } from "next-themes";

import { useStoryStore } from "@/store/useStoryStore";
import { WORKSPACE_CONFIGS } from "@/types/workspace";
import StoryNode from "@/components/nodes/StoryNode";
import ChoiceNode from "@/components/nodes/ChoiceNode";
import NoteNode from "@/components/nodes/NoteNode";
import EditableEdge from "@/components/edges/EditableEdge";
import { parseStoryFile } from "@/lib/storyParser";
import type { StoryNodeData, ChoiceNodeData, NoteNodeData } from "@/types/story";

// Registered once outside component — avoids React Flow warning
const nodeTypes = {
  storyNode: StoryNode,
  choiceNode: ChoiceNode,
  noteNode: NoteNode,
};

// Fix #2 — register EditableEdge as the default edge type
const edgeTypes = {
  default: EditableEdge,
  editableEdge: EditableEdge,
};

interface FlowCanvasProps {
  /** Forwarded ref so ExportMenu can call html-to-image on this element */
  canvasRef: React.RefObject<HTMLDivElement>;
}

/**
 * Renders an invisible click-catcher over the canvas when paste mode is active.
 * Converts click coordinates from screen space to React Flow canvas space
 * using the viewport transform from RF's internal store.
 */
function PasteOverlay() {
  const isPasteMode     = useStoryStore((s) => s.isPasteMode);
  const pasteAtPosition = useStoryStore((s) => s.pasteAtPosition);
  // [translateX, translateY, zoom] from React Flow's internal viewport
  const transform       = useStore((s) => s.transform);

  if (!isPasteMode) return null;

  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 10, cursor: "crosshair" }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const [tx, ty, zoom] = transform;
        pasteAtPosition(
          (e.clientX - rect.left - tx) / zoom,
          (e.clientY - rect.top  - ty) / zoom
        );
      }}
    />
  );
}

export default function FlowCanvas({ canvasRef }: FlowCanvasProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const nodes           = useStoryStore((s) => s.nodes);
  const edges           = useStoryStore((s) => s.edges);
  const onNodesChange   = useStoryStore((s) => s.onNodesChange);
  const onEdgesChange   = useStoryStore((s) => s.onEdgesChange);
  const onConnect       = useStoryStore((s) => s.onConnect);
  const addNode         = useStoryStore((s) => s.addNode);
  const applyNodeAction = useStoryStore((s) => s.applyNodeAction);
  const clearGraph      = useStoryStore((s) => s.clearGraph);
  const copySelected    = useStoryStore((s) => s.copySelected);
  const pasteAtPosition = useStoryStore((s) => s.pasteAtPosition);
  const cancelPaste     = useStoryStore((s) => s.cancelPaste);
  const isPasteMode     = useStoryStore((s) => s.isPasteMode);
  const workspaceMode   = useStoryStore((s) => s.workspaceMode);

  const cfg      = WORKSPACE_CONFIGS[workspaceMode ?? "story"];
  const isTicket = workspaceMode === "ticket";

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelected();
      }
      if (e.key === "Escape") {
        cancelPaste();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copySelected, cancelPaste]);

  // ── Add primary node (Scene / Ticket) ───────────────────────────────────────
  const handleAddStoryNode = useCallback(() => {
    addNode({
      id: uuidv4(),
      type: "storyNode",
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        type: "story",
        title: cfg.primaryNode.defaultTitle,
        content: cfg.primaryNode.defaultBody,
        tags: [],
      } as StoryNodeData,
    });
  }, [addNode, cfg]);

  // ── Add branch node (Choice / Blocker) ─────────────────────────────────────
  const handleAddChoiceNode = useCallback(() => {
    addNode({
      id: uuidv4(),
      type: "choiceNode",
      position: { x: 100 + Math.random() * 400, y: 150 + Math.random() * 300 },
      data: {
        type: "choice",
        prompt: cfg.branchNode.defaultPrompt,
        choices: cfg.branchNode.defaultOptions.map((label, i) => ({
          id: `opt-${i}`,
          label,
        })),
        collapsed: false,
      } as ChoiceNodeData,
    });
  }, [addNode, cfg]);

  // ── Feature #4 — Add note node ──────────────────────────────────────────────
  const handleAddNoteNode = useCallback(() => {
    addNode({
      id: uuidv4(),
      type: "noteNode",
      position: { x: 150 + Math.random() * 400, y: 80 + Math.random() * 300 },
      data: {
        type: "note",
        content: "Add your note here…",
      } as NoteNodeData,
    });
  }, [addNode]);

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = await parseStoryFile(file);
        applyNodeAction({ type: "REPLACE_GRAPH", nodes: parsed.nodes, edges: parsed.edges });
      } catch (err) {
        console.error("Failed to parse story file:", err);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [applyNodeAction]
  );

  // pasteAtPosition is referenced in PasteOverlay — suppress unused warning
  void pasteAtPosition;

  return (
    <div ref={canvasRef} className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={(connection) => onConnect(connection)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          animated: true,
          type: "default",
          style: {
            stroke: isTicket
              ? (isDark ? "#2dd4bf" : "#0d9488")
              : (isDark ? "#818cf8" : "#6366f1"),
            strokeWidth: 2,
          },
        }}
        proOptions={{ hideAttribution: false }}
      >
        <PasteOverlay />

        {isPasteMode && (
          <Panel position="top-center">
            <div className="
              flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg
              bg-violet-600 text-white text-xs font-medium
              border border-violet-500
            ">
              <Clipboard size={13} />
              Click anywhere on the canvas to paste · Esc to cancel
            </div>
          </Panel>
        )}

        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={isDark ? "#334155" : "#e2e8f0"}
        />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === "choiceNode") return isTicket ? "#0d9488" : "#7c3aed";
            if (n.type === "noteNode") return isDark ? "#d97706" : "#f59e0b";
            return isTicket ? "#0284c7" : (isDark ? "#4338ca" : "#4f46e5");
          }}
          maskColor={isDark ? "rgba(15,23,42,0.6)" : "rgba(248,250,252,0.6)"}
          className="!bottom-4 !right-4 !border !border-slate-200 dark:!border-slate-700 !rounded-lg"
        />

        {/* ── Canvas toolbar ────────────────────────────────────────────── */}
        <Panel position="top-left">
          <div className="
            flex items-center gap-2 rounded-xl px-3 py-2 shadow-sm
            border border-slate-200 dark:border-slate-600
            bg-white dark:bg-slate-800
          ">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
              Add:
            </span>

            {/* Primary node: Scene (story) / Ticket (ticket) */}
            <button
              onClick={handleAddStoryNode}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors ${isTicket ? "bg-sky-600 hover:bg-sky-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
            >
              <Plus size={12} />
              {cfg.toolbar.primaryNodeLabel}
            </button>

            {/* Branch node: Choice (story) / Blocker (ticket) */}
            <button
              onClick={handleAddChoiceNode}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white transition-colors ${isTicket ? "bg-teal-600 hover:bg-teal-700" : "bg-violet-600 hover:bg-violet-700"}`}
            >
              {isTicket ? <ShieldAlert size={12} /> : <GitBranch size={12} />}
              {cfg.toolbar.branchNodeLabel}
            </button>

            {/* Note node (same in both modes) */}
            <button
              onClick={handleAddNoteNode}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors"
            >
              <StickyNote size={12} />
              {cfg.toolbar.noteNodeLabel}
            </button>

            {/* Copy button — select nodes first, then click canvas to paste */}
            <button
              onClick={copySelected}
              title="Copy selected nodes (Ctrl+C) — then click canvas to paste"
              className="
                flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium
                border border-slate-200 dark:border-slate-600
                text-slate-600 dark:text-slate-300
                hover:bg-slate-50 dark:hover:bg-slate-700
                transition-colors
              "
            >
              <Clipboard size={12} />
              Copy
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-600 mx-1" />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="
                flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium
                border border-slate-200 dark:border-slate-600
                text-slate-600 dark:text-slate-300
                hover:bg-slate-50 dark:hover:bg-slate-700
                transition-colors
              "
              title="Upload .txt story file"
            >
              <Upload size={12} />
              Import .txt
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={handleFileChange}
            />

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-600 mx-1" />

            <button
              onClick={clearGraph}
              className="
                flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium
                border border-red-200 dark:border-red-800
                text-red-500 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20
                transition-colors
              "
              title="Clear canvas"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
