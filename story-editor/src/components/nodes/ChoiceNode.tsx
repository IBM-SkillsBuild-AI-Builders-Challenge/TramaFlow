"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import {
  GitBranch,
  ShieldAlert,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { ChoiceNodeData, ChoiceOption } from "@/types/story";
import { useStoryStore } from "@/store/useStoryStore";
import { WORKSPACE_CONFIGS } from "@/types/workspace";

/**
 * Feature #3 — ChoiceNode with Expand/Collapse.
 * When collapsed, only the prompt + choice count badge are shown;
 * the full choice list is hidden to save canvas space.
 */
function ChoiceNode({ id, data, selected }: NodeProps<ChoiceNodeData>) {
  const updateNodeData = useStoryStore((s) => s.updateNodeData);
  const removeNode     = useStoryStore((s) => s.removeNode);
  const workspaceMode  = useStoryStore((s) => s.workspaceMode);
  const branchCfg      = WORKSPACE_CONFIGS[workspaceMode ?? "story"].branchNode;
  const isTicket       = workspaceMode === "ticket";

  const collapsed = data.collapsed ?? false;

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState(data.prompt);
  const [editingChoiceId, setEditingChoiceId] = useState<string | null>(null);
  const [draftChoiceLabel, setDraftChoiceLabel] = useState("");

  const toggleCollapse = () => updateNodeData(id, { collapsed: !collapsed });

  const savePrompt = () => {
    updateNodeData(id, { prompt: draftPrompt });
    setEditingPrompt(false);
  };

  const addChoice = () => {
    const newChoice: ChoiceOption = { id: uuidv4(), label: "New choice…" };
    updateNodeData(id, { choices: [...data.choices, newChoice] });
  };

  const saveChoice = (choiceId: string) => {
    updateNodeData(id, {
      choices: data.choices.map((c) =>
        c.id === choiceId ? { ...c, label: draftChoiceLabel } : c
      ),
    });
    setEditingChoiceId(null);
  };

  const removeChoice = (choiceId: string) => {
    updateNodeData(id, {
      choices: data.choices.filter((c) => c.id !== choiceId),
    });
  };

  return (
    <div
      className={`
        w-72 rounded-xl border shadow-md transition-all
        bg-white dark:bg-slate-800
        border-slate-200 dark:border-slate-600
        ${selected
          ? isTicket
            ? "border-teal-500 ring-2 ring-teal-300 dark:ring-teal-700"
            : "border-violet-500 ring-2 ring-violet-300 dark:ring-violet-700"
          : ""}
      `}
    >
      {/* Incoming handle */}
      <Handle
        type="target"
        position={Position.Top}
        className={isTicket ? "!bg-teal-400 !border-teal-600 !w-3 !h-3" : "!bg-violet-400 !border-violet-600 !w-3 !h-3"}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 rounded-t-xl px-3 py-2 ${isTicket ? "bg-teal-600 dark:bg-teal-800" : "bg-violet-600 dark:bg-violet-800"}`}>
        {isTicket
          ? <ShieldAlert size={14} className="text-white shrink-0" />
          : <GitBranch size={14} className="text-white shrink-0" />
        }
        <span className="flex-1 text-sm font-semibold text-white">{branchCfg.headerLabel}</span>

        {/* Collapsed badge — shows option count when collapsed */}
        {collapsed && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${isTicket ? "bg-teal-400/50" : "bg-violet-400/50"}`}>
            {data.choices.length} {isTicket ? "paths" : "options"}
          </span>
        )}

        <button
          onClick={toggleCollapse}
          className={`${isTicket ? "text-teal-200" : "text-violet-200"} hover:text-white transition-colors`}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>

        <button
          onClick={() => removeNode(id)}
          className={`${isTicket ? "text-teal-200" : "text-violet-200"} hover:text-white transition-colors`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* ── Prompt ─────────────────────────────────────────────────────── */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-start gap-1">
          {editingPrompt ? (
            <>
              <textarea
                autoFocus
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                rows={2}
                className="
                  flex-1 resize-none rounded border p-1 text-xs outline-none
                  border-slate-200 dark:border-slate-600
                  bg-white dark:bg-slate-700
                  text-slate-700 dark:text-slate-200
                  focus:border-violet-400
                "
              />
              <div className="flex flex-col gap-1 mt-0.5">
                <button onClick={savePrompt} className="text-green-500 hover:text-green-700">
                  <Check size={13} />
                </button>
                <button
                  onClick={() => { setDraftPrompt(data.prompt); setEditingPrompt(false); }}
                  className="text-red-400 hover:text-red-600"
                >
                  <X size={13} />
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                {data.prompt}
              </p>
              <button
                onClick={() => { setDraftPrompt(data.prompt); setEditingPrompt(true); }}
                className="text-slate-400 hover:text-violet-600 mt-0.5"
              >
                <Pencil size={11} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Choice list — hidden when collapsed ────────────────────────── */}
      {!collapsed && (
        <>
          <div className="flex flex-col gap-1.5 px-3 pb-2 mt-1">
            {data.choices.map((choice, index) => (
              <div key={choice.id} className="relative">
                <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border ${isTicket ? "bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-700" : "bg-violet-50 dark:bg-violet-900/30 border-violet-100 dark:border-violet-700"}`}>
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${isTicket ? "bg-teal-500" : "bg-violet-500"}`}>
                    {index + 1}
                  </span>

                  {editingChoiceId === choice.id ? (
                    <>
                      <input
                        autoFocus
                        value={draftChoiceLabel}
                        onChange={(e) => setDraftChoiceLabel(e.target.value)}
                        className={`
                          flex-1 rounded border px-1 text-xs outline-none
                          bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200
                          ${isTicket ? "border-teal-300 dark:border-teal-600" : "border-violet-300 dark:border-violet-600"}
                        `}
                      />
                      <button onClick={() => saveChoice(choice.id)} className="text-green-500 hover:text-green-700">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setEditingChoiceId(null)} className="text-red-400 hover:text-red-600">
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                        {choice.label}
                      </span>
                      <button
                        onClick={() => { setDraftChoiceLabel(choice.label); setEditingChoiceId(choice.id); }}
                        className={`text-slate-400 ${isTicket ? "hover:text-teal-600" : "hover:text-violet-600"}`}
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => removeChoice(choice.id)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                </div>

                {/* Per-choice source handle */}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`choice-${choice.id}`}
                  style={{ top: "50%", right: -6 }}
                  className={isTicket ? "!bg-teal-400 !border-teal-600 !w-2.5 !h-2.5" : "!bg-violet-400 !border-violet-600 !w-2.5 !h-2.5"}
                />
              </div>
            ))}
          </div>

          {/* Add option */}
          <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2">
            <button
              onClick={addChoice}
              className={`flex w-full items-center justify-center gap-1 rounded-lg border border-dashed py-1 text-xs transition-colors ${isTicket ? "border-teal-300 dark:border-teal-600 text-teal-500 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20" : "border-violet-300 dark:border-violet-600 text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20"}`}
            >
              <Plus size={11} />
              {branchCfg.optionLabel}
            </button>
          </div>
        </>
      )}

      {/* When collapsed, still need handles to keep existing edges valid */}
      {collapsed && data.choices.map((choice) => (
        <Handle
          key={choice.id}
          type="source"
          position={Position.Right}
          id={`choice-${choice.id}`}
          style={{ top: "50%", right: -6, opacity: 0 }}
          className="!bg-violet-400 !border-violet-600 !w-2.5 !h-2.5"
        />
      ))}
    </div>
  );
}

export default memo(ChoiceNode);
