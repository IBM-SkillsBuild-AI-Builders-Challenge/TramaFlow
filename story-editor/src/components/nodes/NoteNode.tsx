"use client";

import { memo, useState } from "react";
import { NodeProps } from "reactflow";
import { StickyNote, Pencil, Check, X, Trash2 } from "lucide-react";
import type { NoteNodeData } from "@/types/story";
import { useStoryStore } from "@/store/useStoryStore";

/**
 * Feature #4 — NoteNode
 *
 * Design rules:
 *  - Post-it visual style (amber/yellow tones)
 *  - NO handles — cannot be connected to other nodes
 *  - Ignored by the script exporter (filtered by `data.type === "note"`)
 *  - Dark-mode aware
 */
function NoteNode({ id, data, selected }: NodeProps<NoteNodeData>) {
  const updateNodeData = useStoryStore((s) => s.updateNodeData);
  const removeNode = useStoryStore((s) => s.removeNode);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.content);

  const saveEdit = () => {
    updateNodeData(id, { content: draft });
    setEditing(false);
  };

  const cancelEdit = () => {
    setDraft(data.content);
    setEditing(false);
  };

  return (
    <div
      className={`
        w-56 rounded-lg border-2 shadow-md transition-all
        bg-amber-50 dark:bg-amber-900/40
        border-amber-300 dark:border-amber-600
        ${selected ? "ring-2 ring-amber-400 dark:ring-amber-500" : ""}
      `}
      // Slight rotation gives it a natural post-it feel
      style={{ transform: "rotate(-1deg)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-md bg-amber-300 dark:bg-amber-700 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <StickyNote size={12} className="text-amber-800 dark:text-amber-200" />
          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
            Note
          </span>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button onClick={saveEdit} className="text-green-700 dark:text-green-400 hover:opacity-70">
                <Check size={12} />
              </button>
              <button onClick={cancelEdit} className="text-red-600 dark:text-red-400 hover:opacity-70">
                <X size={12} />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-amber-700 dark:text-amber-300 hover:opacity-70"
            >
              <Pencil size={11} />
            </button>
          )}
          <button
            onClick={() => removeNode(id)}
            className="text-amber-700 dark:text-amber-300 hover:text-red-600 dark:hover:text-red-400"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-2.5 min-h-[60px]">
        {editing ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            className="
              w-full resize-none rounded border p-1 text-xs outline-none
              border-amber-300 dark:border-amber-600
              bg-amber-50 dark:bg-amber-900/30
              text-amber-900 dark:text-amber-100
              focus:border-amber-500
            "
          />
        ) : (
          <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
            {data.content || (
              <span className="italic text-amber-500 dark:text-amber-400">
                Click ✏️ to add a note…
              </span>
            )}
          </p>
        )}
      </div>

      {/* 
        NO <Handle> components — this node cannot be wired to others.
        The exporter filters by data.type === "note" to skip this node.
      */}
    </div>
  );
}

export default memo(NoteNode);
