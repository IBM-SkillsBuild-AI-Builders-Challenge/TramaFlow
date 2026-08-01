"use client";

import { memo, useState, useRef, KeyboardEvent } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { BookOpen, TicketCheck, Tag, Pencil, Check, X, Trash2, Plus } from "lucide-react";
import type { StoryNodeData } from "@/types/story";
import { useStoryStore } from "@/store/useStoryStore";
import { WORKSPACE_CONFIGS } from "@/types/workspace";

function StoryNode({ id, data, selected }: NodeProps<StoryNodeData>) {
  const updateNodeData = useStoryStore((s) => s.updateNodeData);
  const removeNode     = useStoryStore((s) => s.removeNode);
  const workspaceMode  = useStoryStore((s) => s.workspaceMode);
  const nodeCfg        = WORKSPACE_CONFIGS[workspaceMode ?? "story"].primaryNode;
  const isTicket       = workspaceMode === "ticket";

  // ── Title / content editing ──────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(data.title);
  const [draftContent, setDraftContent] = useState(data.content);

  const saveEdit = () => {
    updateNodeData(id, { title: draftTitle, content: draftContent });
    setEditing(false);
  };
  const cancelEdit = () => {
    setDraftTitle(data.title);
    setDraftContent(data.content);
    setEditing(false);
  };

  // ── Tag management (Fix #3) ──────────────────────────────────────────────────
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const currentTags = data.tags ?? [];

  const commitTag = () => {
    const trimmed = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !currentTags.includes(trimmed)) {
      updateNodeData(id, { tags: [...currentTags, trimmed] });
    }
    setNewTag("");
    setAddingTag(false);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitTag(); }
    if (e.key === "Escape") { setNewTag(""); setAddingTag(false); }
  };

  const removeTag = (tag: string) => {
    updateNodeData(id, { tags: currentTags.filter((t) => t !== tag) });
  };

  const openTagInput = () => {
    setAddingTag(true);
    // Focus happens after render via useEffect-style callback on the ref
    setTimeout(() => tagInputRef.current?.focus(), 0);
  };

  return (
    <div
      className={`
        w-72 rounded-xl border shadow-md transition-all
        bg-white dark:bg-slate-800
        border-slate-200 dark:border-slate-600
        ${selected ? "border-indigo-500 ring-2 ring-indigo-300 dark:ring-indigo-700" : ""}
      `}
    >
      {/* Incoming handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-indigo-400 !border-indigo-600 !w-3 !h-3"
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2 ${isTicket ? "bg-sky-600 dark:bg-sky-800" : "bg-indigo-600 dark:bg-indigo-800"}`}>
        {isTicket
          ? <TicketCheck size={14} className="text-white shrink-0" />
          : <BookOpen size={14} className="text-white shrink-0" />
        }

        {editing ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            className={`
              flex-1 rounded px-1.5 py-0.5 text-sm font-semibold outline-none
              text-white dark:text-gray-100
              border focus:border-white
              ${isTicket
                ? "bg-sky-700 dark:bg-sky-900 placeholder-sky-300 border-sky-400 dark:border-sky-600"
                : "bg-indigo-700 dark:bg-indigo-900 placeholder-indigo-300 border-indigo-400 dark:border-indigo-600"
              }
            `}
          />
        ) : (
          <span className="flex-1 truncate text-sm font-semibold text-white">
            {data.title}
          </span>
        )}

        {editing ? (
          <div className="flex gap-1">
            <button onClick={saveEdit} className="text-green-300 hover:text-green-100">
              <Check size={14} />
            </button>
            <button onClick={cancelEdit} className="text-red-300 hover:text-red-100">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDraftTitle(data.title); setDraftContent(data.content); setEditing(true); }}
            className="text-indigo-200 hover:text-white transition-colors"
          >
            <Pencil size={12} />
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="p-3">
        {editing ? (
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={4}
            className="
              w-full resize-none rounded border p-1 text-xs outline-none
              border-slate-200 dark:border-slate-600
              bg-white dark:bg-slate-700
              text-slate-700 dark:text-slate-200
              focus:border-indigo-400
            "
          />
        ) : (
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-5">
            {data.content}
          </p>
        )}
      </div>

      {/* ── Tags / Labels ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 px-3 pb-2">
        {currentTags.map((tag) => (
          <span
            key={tag}
            className={`
              group inline-flex items-center gap-1 rounded-full px-2 py-0.5
              text-[10px] font-medium
              ${isTicket
                ? "bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 border border-sky-100 dark:border-sky-800"
                : "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800"
              }
            `}
          >
            <Tag size={8} />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className={`
                ml-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity
                ${isTicket ? "text-sky-400 hover:text-red-500" : "text-indigo-400 hover:text-red-500"}
              `}
              title={`Remove ${nodeCfg.tagLabel} "${tag}"`}
            >
              <X size={8} />
            </button>
          </span>
        ))}

        {/* Add tag / label */}
        {addingTag ? (
          <div className="flex items-center gap-1">
            <input
              ref={tagInputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTag}
              placeholder={`new-${nodeCfg.tagLabel}`}
              className={`
                w-24 rounded-full border px-2 py-0.5 text-[10px] outline-none
                bg-white dark:bg-slate-700
                ${isTicket
                  ? "border-sky-300 dark:border-sky-600 text-sky-700 dark:text-sky-200 placeholder-sky-300 focus:border-sky-500"
                  : "border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-200 placeholder-indigo-300 focus:border-indigo-500"
                }
              `}
            />
          </div>
        ) : (
          <button
            onClick={openTagInput}
            className={`
              inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5
              text-[10px] font-medium border border-dashed transition-colors
              ${isTicket
                ? "border-sky-200 dark:border-sky-700 text-sky-400 dark:text-sky-500 hover:border-sky-400 hover:text-sky-600"
                : "border-indigo-200 dark:border-indigo-700 text-indigo-400 dark:text-indigo-500 hover:border-indigo-400 hover:text-indigo-600"
              }
            `}
            title={`Add a ${nodeCfg.tagLabel}`}
          >
            <Plus size={8} />
            {nodeCfg.tagLabel}
          </button>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700 px-3 py-1">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isTicket ? "text-sky-400 dark:text-sky-500" : "text-indigo-400 dark:text-indigo-500"}`}>
          {nodeCfg.headerLabel}
        </span>
        <button
          onClick={() => removeNode(id)}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={9} />
          Remove
        </button>
      </div>

      {/* Outgoing handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-indigo-400 !border-indigo-600 !w-3 !h-3"
      />
    </div>
  );
}

export default memo(StoryNode);
