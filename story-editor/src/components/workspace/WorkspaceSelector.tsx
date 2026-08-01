"use client";

import { BookOpenCheck, TicketCheck, Sparkles, Building2 } from "lucide-react";
import { useStoryStore } from "@/store/useStoryStore";
import type { WorkspaceMode } from "@/types/workspace";
import { STORY_CONFIG, TICKET_CONFIG } from "@/types/workspace";

// ─── Animated starfield background ───────────────────────────────────────────

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: (i * 137.508 + 17) % 100,   // deterministic pseudo-random spread
  y: (i * 97.31  + 7)  % 100,
  r: i % 3 === 0 ? 1.5 : i % 5 === 0 ? 2 : 1,
  opacity: 0.3 + (i % 7) * 0.1,
  delay: (i % 9) * 0.4,
}));

const NETWORK_NODES = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  x: (i * 151.3 + 5)  % 100,
  y: (i * 113.7 + 11) % 100,
}));

// Connect nearby network nodes
const NETWORK_EDGES: { x1: number; y1: number; x2: number; y2: number }[] = [];
for (let i = 0; i < NETWORK_NODES.length; i++) {
  for (let j = i + 1; j < NETWORK_NODES.length; j++) {
    const dx = NETWORK_NODES[i].x - NETWORK_NODES[j].x;
    const dy = NETWORK_NODES[i].y - NETWORK_NODES[j].y;
    if (Math.sqrt(dx * dx + dy * dy) < 28) {
      NETWORK_EDGES.push({
        x1: NETWORK_NODES[i].x, y1: NETWORK_NODES[i].y,
        x2: NETWORK_NODES[j].x, y2: NETWORK_NODES[j].y,
      });
    }
  }
}

function StarfieldBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Deep navy gradient */}
      <div className="absolute inset-0 bg-[#0b1120]" />

      {/* Network SVG (stretched to fill) */}
      <svg
        className="absolute inset-0 h-full w-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {NETWORK_EDGES.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#60a5fa" strokeWidth="0.2"
          />
        ))}
        {NETWORK_NODES.map((n) => (
          <circle key={n.id} cx={n.x} cy={n.y} r="0.6" fill="#93c5fd" />
        ))}
      </svg>

      {/* Stars */}
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {STARS.map((s) => (
          <circle
            key={s.id}
            cx={s.x} cy={s.y} r={s.r * 0.35}
            fill="white"
            opacity={s.opacity}
            style={{
              animation: `twinkle ${1.8 + s.delay}s ease-in-out ${s.delay}s infinite alternate`,
            }}
          />
        ))}
      </svg>

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_50%,_rgba(0,0,0,0.55)_100%)]" />

      <style>{`
        @keyframes twinkle {
          from { opacity: 0.15; }
          to   { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

// ─── Mode Card ────────────────────────────────────────────────────────────────

interface ModeCardProps {
  mode: WorkspaceMode;
  onSelect: (mode: WorkspaceMode) => void;
}

function ModeCard({ mode, onSelect }: ModeCardProps) {
  const config = mode === "story" ? STORY_CONFIG : TICKET_CONFIG;

  const isStory = mode === "story";

  const iconBg = isStory
    ? "bg-indigo-600"
    : "bg-sky-600";

  const borderHover = isStory
    ? "hover:border-indigo-400/70"
    : "hover:border-sky-400/70";

  const badgeBg = isStory
    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
    : "bg-sky-500/20 text-sky-300 border border-sky-500/30";

  const btnBg = isStory
    ? "bg-indigo-600 hover:bg-indigo-500"
    : "bg-sky-600 hover:bg-sky-500";

  const tags = isStory
    ? ["Creative", "Storytelling", "Game Design", "Interactive Fiction"]
    : ["Corporate", "Dev Teams", "Sprint Planning", "Ticket Tracking"];

  const features = isStory
    ? [
        "Generate branching narratives from a single premise",
        "Scene nodes, choice points & post-it notes",
        "AI co-writer via IBM Granite",
        "Export story graph as image or script",
      ]
    : [
        "Visualise ticket dependencies as a flow graph",
        "Ticket nodes, blocker gates & risk notes",
        "AI ticket triager via IBM Granite",
        "Thread-based context per ticket",
      ];

  return (
    <div
      className={`
        group relative flex flex-col rounded-2xl border-2 p-6 cursor-pointer
        bg-white/5 backdrop-blur-md
        border-white/10
        ${borderHover}
        hover:bg-white/10
        shadow-xl
        transition-all duration-200
      `}
      onClick={() => onSelect(mode)}
    >
      {/* Category badge */}
      <span className={`self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badgeBg} mb-4`}>
        {isStory ? (
          <span className="flex items-center gap-1"><Sparkles size={10} />{tags[0]}</span>
        ) : (
          <span className="flex items-center gap-1"><Building2 size={10} />{tags[0]}</span>
        )}
      </span>

      {/* Icon + title */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          {isStory
            ? <BookOpenCheck size={22} className="text-white" />
            : <TicketCheck size={22} className="text-white" />
          }
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">
            {config.name}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {config.toolbar.headerSub}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-slate-300 leading-relaxed mb-4">
        {config.description}
      </p>

      {/* Feature list */}
      <ul className="flex flex-col gap-1.5 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-400">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
            {f}
          </li>
        ))}
      </ul>

      {/* Use tags */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {tags.slice(1).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* CTA */}
      <button
        className={`
          w-full rounded-xl py-2.5 text-sm font-semibold text-white
          ${btnBg}
          transition-colors
        `}
      >
        Open {config.name} →
      </button>
    </div>
  );
}

// ─── Workspace Selector ───────────────────────────────────────────────────────

export default function WorkspaceSelector() {
  const setWorkspaceMode = useStoryStore((s) => s.setWorkspaceMode);

  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-4 py-12 overflow-hidden">

      {/* Animated starfield */}
      <StarfieldBackground />

      {/* Content (above background) */}
      <div className="relative z-10 flex flex-col items-center w-full">

        {/* Header */}
        <div className="mb-10 text-center max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-1.5 text-xs font-medium text-slate-300 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            IBM AI Builders Challenge · July 2026
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-3">
            Welcome to <span className="text-indigo-400">TramaFlow</span>
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            A versatile AI-powered node engine. Choose your workspace — the same
            visual canvas and IBM Granite AI adapt to your use case.
          </p>
        </div>

        {/* Mode cards */}
        <div className="grid w-full max-w-2xl gap-5 sm:grid-cols-2">
          <ModeCard mode="story" onSelect={setWorkspaceMode} />
          <ModeCard mode="ticket" onSelect={setWorkspaceMode} />
        </div>

        {/* Footer note */}
        <p className="mt-8 text-[11px] text-slate-500 text-center">
          You can switch workspaces at any time from the top bar · Powered by IBM Granite via watsonx.ai
        </p>

      </div>
    </div>
  );
}
