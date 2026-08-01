"use client";

import { memo, useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  EdgeProps,
  useReactFlow,
} from "reactflow";
import { useStoryStore } from "@/store/useStoryStore";

/**
 * Fix #2 — EditableEdge
 *
 * Behaviour:
 *  - Renders a standard animated bezier edge by default.
 *  - Clicking anywhere on the edge line (or on the label pill) opens an
 *    inline input centred on the edge midpoint.
 *  - Saving (Enter / blur) calls `updateEdgeLabel` in Zustand.
 *  - Clearing the input removes the label entirely.
 *  - Escape cancels without persisting.
 */
function EditableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const updateEdgeLabel = useStoryStore((s) => s.updateEdgeLabel);
  const { getZoom } = useReactFlow();

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState((label as string) ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when the edge label is changed externally (e.g. by AI)
  useEffect(() => {
    if (!isEditing) setDraft((label as string) ?? "");
  }, [label, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const save = () => {
    updateEdgeLabel(id, draft.trim() || "");
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft((label as string) ?? "");
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") cancel();
  };

  // The hit area on the SVG path is thin — we add an invisible wider stroke
  // that acts as the click target.
  const handleEdgeClick = () => {
    setDraft((label as string) ?? "");
    setIsEditing(true);
  };

  const hasLabel = label && String(label).trim().length > 0;

  // Scale the HTML overlay inversely with zoom so it stays the same visual size
  const zoom = getZoom();

  return (
    <>
      {/* ── SVG layer ────────────────────────────────────────────────────── */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />

      {/* Wider invisible hit area so clicking near the line is easy */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="cursor-pointer"
        onClick={handleEdgeClick}
      />

      {/* ── HTML overlay (EdgeLabelRenderer teleports to a stable div) ───── */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px) scale(${1 / zoom})`,
            transformOrigin: "center",
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {isEditing ? (
            /* ── Input overlay ──────────────────────────────────────────── */
            <div className="flex items-center gap-1 shadow-lg">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={save}
                placeholder="Route name…"
                className="
                  w-32 rounded-full border px-2.5 py-1 text-[11px] font-medium
                  outline-none shadow-md
                  border-indigo-400 dark:border-indigo-500
                  bg-white dark:bg-slate-800
                  text-slate-700 dark:text-slate-200
                  placeholder-slate-400 dark:placeholder-slate-500
                  focus:ring-1 focus:ring-indigo-400
                "
              />
            </div>
          ) : (
            /* ── Label pill (or invisible click target) ─────────────────── */
            <div
              onClick={handleEdgeClick}
              className="cursor-pointer select-none"
              title="Click to rename this route"
            >
              {hasLabel ? (
                <span
                  className={`
                    inline-flex items-center rounded-full px-2 py-0.5
                    text-[11px] font-semibold leading-none
                    bg-white dark:bg-slate-800
                    text-slate-700 dark:text-slate-200
                    border shadow-sm
                    transition-colors
                    ${selected
                      ? "border-indigo-400 dark:border-indigo-500"
                      : "border-slate-300 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-600"
                    }
                  `}
                >
                  {String(label)}
                </span>
              ) : (
                /* No label — show a tiny dashed circle as click hint */
                <span
                  className="
                    flex h-4 w-4 items-center justify-center rounded-full
                    border border-dashed opacity-0 hover:opacity-60 transition-opacity
                    border-slate-400 dark:border-slate-500
                  "
                  title="Click to add a route name"
                >
                  <span className="text-[8px] text-slate-400">+</span>
                </span>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(EditableEdge);
