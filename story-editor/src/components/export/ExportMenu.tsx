"use client";

import { useRef, useState, useEffect } from "react";
import { toPng } from "html-to-image";
import { Download, Image as ImageIcon, FileText, ChevronDown } from "lucide-react";
import { useStoryStore } from "@/store/useStoryStore";
import type { StoryNodeData, ChoiceNodeData } from "@/types/story";

interface ExportMenuProps {
  /** Ref to the React Flow wrapper div — used for PNG capture */
  canvasRef: React.RefObject<HTMLDivElement>;
}

// ─── Script exporter ──────────────────────────────────────────────────────────
/**
 * Feature #1b — Export Script
 * Traverses the Zustand node list in insertion order and builds a
 * human-readable .txt screenplay. NoteNodes are explicitly ignored.
 */
function buildScript(
  nodes: ReturnType<typeof useStoryStore.getState>["nodes"],
  edges: ReturnType<typeof useStoryStore.getState>["edges"]
): string {
  const lines: string[] = [];
  lines.push("═══════════════════════════════════════");
  lines.push("           STORY SCRIPT EXPORT          ");
  lines.push("═══════════════════════════════════════");
  lines.push("");

  // Filter out note nodes — they are purely visual
  const storyNodes = nodes.filter((n) => n.data.type !== "note");

  storyNodes.forEach((node, idx) => {
    const data = node.data;

    if (data.type === "story") {
      const d = data as StoryNodeData;
      lines.push(`[SCENE ${idx + 1}] — ${d.title}`);
      lines.push("───────────────────────────────────────");
      lines.push(d.content);
      if (d.tags && d.tags.length > 0) {
        lines.push(`Tags: ${d.tags.join(", ")}`);
      }
      lines.push("");
    } else if (data.type === "choice") {
      const d = data as ChoiceNodeData;
      lines.push(`[DECISION] — ${d.prompt}`);
      lines.push("───────────────────────────────────────");
      d.choices.forEach((c, i) => {
        // Check if this choice has an outgoing edge with a label
        const edge = edges.find((e) => e.sourceHandle === `choice-${c.id}`);
        const label = edge?.label ? ` → "${edge.label}"` : "";
        lines.push(`  ${i + 1}. ${c.label}${label}`);
      });
      lines.push("");
    }
  });

  lines.push("═══════════════════════════════════════");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  return lines.join("\n");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExportMenu({ canvasRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"image" | "script" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const nodes = useStoryStore((s) => s.nodes);
  const edges = useStoryStore((s) => s.edges);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Feature #1a — Export Map as PNG ─────────────────────────────────────────
  const exportImage = async () => {
    if (!canvasRef.current) return;
    setExporting("image");
    setOpen(false);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        backgroundColor: document.documentElement.classList.contains("dark")
          ? "#0f172a"
          : "#f8fafc",
        // Give React Flow time to finish any pending renders
        filter: (node) => {
          // Exclude React Flow controls & minimap from the export
          if (node instanceof HTMLElement) {
            if (
              node.classList.contains("react-flow__controls") ||
              node.classList.contains("react-flow__minimap") ||
              node.classList.contains("react-flow__panel")
            ) {
              return false;
            }
          }
          return true;
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `story-map-${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error("Image export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  // ── Feature #1b — Export Script as .txt ─────────────────────────────────────
  const exportScript = () => {
    setExporting("script");
    setOpen(false);
    try {
      const text = buildScript(nodes, edges);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `story-script-${Date.now()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Script export failed:", err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={exporting !== null}
        className="
          flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium
          border border-slate-200 dark:border-slate-600
          bg-white dark:bg-slate-800
          text-slate-600 dark:text-slate-300
          hover:bg-slate-50 dark:hover:bg-slate-700
          disabled:opacity-50 transition-colors
        "
      >
        {exporting ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : (
          <Download size={12} />
        )}
        Export
        <ChevronDown size={11} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="
          absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border shadow-lg overflow-hidden
          bg-white dark:bg-slate-800
          border-slate-200 dark:border-slate-600
        ">
          <button
            onClick={exportImage}
            className="
              flex w-full items-center gap-2.5 px-3 py-2.5 text-sm
              text-slate-700 dark:text-slate-200
              hover:bg-indigo-50 dark:hover:bg-indigo-900/30
              transition-colors
            "
          >
            <ImageIcon size={14} className="text-indigo-500 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold">Export Map</p>
              <p className="text-[10px] text-slate-400">Saves canvas as .png</p>
            </div>
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-700" />

          <button
            onClick={exportScript}
            className="
              flex w-full items-center gap-2.5 px-3 py-2.5 text-sm
              text-slate-700 dark:text-slate-200
              hover:bg-violet-50 dark:hover:bg-violet-900/30
              transition-colors
            "
          >
            <FileText size={14} className="text-violet-500 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-semibold">Export Script</p>
              <p className="text-[10px] text-slate-400">
                Saves story as .txt (notes ignored)
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
