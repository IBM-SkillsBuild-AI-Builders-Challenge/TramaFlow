"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { BookOpenCheck, TicketCheck, ChevronDown } from "lucide-react";

import ChatPanel from "@/components/chat/ChatPanel";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ExportMenu from "@/components/export/ExportMenu";
import WorkspaceSelector from "@/components/workspace/WorkspaceSelector";
import { useStoryStore } from "@/store/useStoryStore";
import { WORKSPACE_CONFIGS } from "@/types/workspace";

// React Flow must be rendered client-side only (no SSR)
const FlowCanvas = dynamic(() => import("@/components/canvas/FlowCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-indigo-500" />
        <span className="text-sm">Loading canvas…</span>
      </div>
    </div>
  ),
});

// ─── Mode badge icon ──────────────────────────────────────────────────────────

function ModeIcon({ mode }: { mode: "story" | "ticket" }) {
  if (mode === "ticket") return <TicketCheck size={16} className="text-white" />;
  return <BookOpenCheck size={16} className="text-white" />;
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function Home() {
  const canvasRef = useRef<HTMLDivElement>(null);

  const workspaceMode    = useStoryStore((s) => s.workspaceMode);
  const setWorkspaceMode = useStoryStore((s) => s.setWorkspaceMode);

  // ── Show workspace picker until a mode is chosen ─────────────────────────
  if (!workspaceMode) {
    return <WorkspaceSelector />;
  }

  const cfg      = WORKSPACE_CONFIGS[workspaceMode];
  const isTicket = workspaceMode === "ticket";

  const iconBg  = isTicket ? "bg-sky-600"    : "bg-indigo-600";
  const version = "v0.3.0";

  return (
    <div className="flex h-full flex-col">
      {/* ── Top Bar ───────────────────────────────────────────────────────── */}
      <header className="
        flex items-center gap-3 px-5 py-2.5 z-10 shadow-sm
        border-b border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-800
      ">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          <ModeIcon mode={workspaceMode} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none">
            {cfg.toolbar.headerTitle}
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {cfg.toolbar.headerSub}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:block text-[11px] text-slate-400">
            Drag nodes to reposition · Connect handles to link {isTicket ? "tickets" : "scenes"}
          </span>

          {/* Workspace switcher */}
          <button
            onClick={() => setWorkspaceMode(workspaceMode === "story" ? "ticket" : "story")}
            className="
              hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium
              border border-slate-200 dark:border-slate-600
              text-slate-600 dark:text-slate-300
              hover:bg-slate-50 dark:hover:bg-slate-700
              transition-colors
            "
            title="Switch workspace mode"
          >
            <ChevronDown size={11} />
            Switch to {workspaceMode === "story" ? "Ticket Flow" : "Story Graph"}
          </button>

          {/* Export dropdown */}
          <ExportMenu canvasRef={canvasRef} />

          {/* Dark / light toggle */}
          <ThemeToggle />

          <span className="rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {version}
          </span>
        </div>
      </header>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left: AI Chat */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-700 lg:w-96">
          <ChatPanel />
        </aside>

        {/* Right: React Flow Canvas */}
        <section className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <FlowCanvas canvasRef={canvasRef} />
        </section>
      </main>
    </div>
  );
}
