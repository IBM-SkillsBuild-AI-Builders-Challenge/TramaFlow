// ─── Workspace Modes ─────────────────────────────────────────────────────────
// A "workspace mode" controls:
//   • which System Prompt is sent to IBM Granite
//   • all user-facing labels in the toolbar, chat panel, and nodes
//   • the accent color palette used throughout the UI
//
// Adding a new mode in the future only requires a new WorkspaceConfig entry.

export type WorkspaceMode = "story" | "ticket";

export interface WorkspaceConfig {
  mode: WorkspaceMode;

  // ── Identity ──────────────────────────────────────────────────────────────
  /** Short display name shown in header and mode picker */
  name: string;
  /** One-line description shown in the mode picker card */
  description: string;
  /** Lucide icon name (resolved by the picker component) */
  icon: "BookOpenCheck" | "TicketCheck";

  // ── Accent palette (Tailwind class fragments) ────────────────────────────
  /** e.g. "indigo" → used to derive bg-{accent}-600, text-{accent}-*, etc. */
  accent: "indigo" | "sky";
  /** e.g. "violet" → secondary accent for choice/branch nodes */
  secondary: "violet" | "teal";

  // ── Toolbar labels ────────────────────────────────────────────────────────
  toolbar: {
    primaryNodeLabel: string;   // "Scene"  | "Ticket"
    branchNodeLabel: string;    // "Choice" | "Blocker"
    noteNodeLabel: string;      // "Note"   | "Note"
    headerTitle: string;        // "Story Editor"  | "Ticket Flow"
    headerSub: string;          // "Branching Narrative Builder" | "Dev Ticket Manager"
  };

  // ── Chat panel labels ─────────────────────────────────────────────────────
  chat: {
    agentName: string;          // "Story AI"  | "Ticket AI"
    agentSub: string;           // "Powered by LangChain · watsonx"
    emptyTitle: string;         // "Your Story AI is ready" | "Your Ticket AI is ready"
    emptyBody: string;
    placeholder: string;
    suggestions: string[];
  };

  // ── Primary node (storyNode) labels ──────────────────────────────────────
  primaryNode: {
    headerLabel: string;        // "Scene" | "Ticket"
    titlePlaceholder: string;   // "Scene title" | "Ticket title"
    bodyPlaceholder: string;    // "Write your scene…" | "Describe the task…"
    tagLabel: string;           // "tag" | "label"
    defaultTitle: string;
    defaultBody: string;
  };

  // ── Branch node (choiceNode) labels ──────────────────────────────────────
  branchNode: {
    headerLabel: string;        // "Choice" | "Blocker"
    promptPlaceholder: string;  // "What do you do?" | "Blocking issue?"
    optionLabel: string;        // "Add choice" | "Add path"
    defaultPrompt: string;
    defaultOptions: string[];
  };
}

// ─── Story (Creative) Mode ────────────────────────────────────────────────────

export const STORY_CONFIG: WorkspaceConfig = {
  mode: "story",
  name: "Story Graph",
  description: "AI-powered branching narrative builder for writers & game designers.",
  icon: "BookOpenCheck",
  accent: "indigo",
  secondary: "violet",
  toolbar: {
    primaryNodeLabel: "Scene",
    branchNodeLabel: "Choice",
    noteNodeLabel: "Note",
    headerTitle: "Story Editor",
    headerSub: "Branching Narrative Builder · AI-powered",
  },
  chat: {
    agentName: "Story AI",
    agentSub: "Powered by LangChain · watsonx",
    emptyTitle: "Your Story AI is ready",
    emptyBody: "Ask me to write scenes, suggest plot twists, or say \"create a story about a knight\" to generate nodes on the canvas.",
    placeholder: "Ask the AI to write or modify story nodes…",
    suggestions: [
      "Create a 3-scene adventure story",
      "Add a choice node after the current ending",
      "Suggest a twist for my story",
    ],
  },
  primaryNode: {
    headerLabel: "Scene",
    titlePlaceholder: "Scene title",
    bodyPlaceholder: "Write your scene here…",
    tagLabel: "tag",
    defaultTitle: "New Scene",
    defaultBody: "Write your scene here…",
  },
  branchNode: {
    headerLabel: "Choice",
    promptPlaceholder: "What do you do?",
    optionLabel: "Add choice",
    defaultPrompt: "What do you do?",
    defaultOptions: ["Go left", "Go right"],
  },
};

// ─── Ticket (Corporate) Mode ──────────────────────────────────────────────────

export const TICKET_CONFIG: WorkspaceConfig = {
  mode: "ticket",
  name: "Ticket Flow",
  description: "AI-powered ticket manager with visual dependency threads for devs & teams.",
  icon: "TicketCheck",
  accent: "sky",
  secondary: "teal",
  toolbar: {
    primaryNodeLabel: "Ticket",
    branchNodeLabel: "Blocker",
    noteNodeLabel: "Note",
    headerTitle: "Ticket Flow",
    headerSub: "Dev Ticket Manager · AI-powered",
  },
  chat: {
    agentName: "Ticket AI",
    agentSub: "Powered by LangChain · watsonx",
    emptyTitle: "Your Ticket AI is ready",
    emptyBody: "Ask me to create tickets, map dependencies, or say \"create a sprint board for a login feature\" to generate a ticket graph.",
    placeholder: "Ask the AI to create or update tickets…",
    suggestions: [
      "Create a sprint board for a user authentication feature",
      "Add a blocker between the API and frontend tickets",
      "Mark the database migration ticket as high priority",
    ],
  },
  primaryNode: {
    headerLabel: "Ticket",
    titlePlaceholder: "Ticket title",
    bodyPlaceholder: "Describe the task or issue…",
    tagLabel: "label",
    defaultTitle: "New Ticket",
    defaultBody: "Describe the task or issue…",
  },
  branchNode: {
    headerLabel: "Blocker",
    promptPlaceholder: "What is blocking progress?",
    optionLabel: "Add path",
    defaultPrompt: "What is blocking progress?",
    defaultOptions: ["Resolve dependency", "Find workaround"],
  },
};

export const WORKSPACE_CONFIGS: Record<WorkspaceMode, WorkspaceConfig> = {
  story: STORY_CONFIG,
  ticket: TICKET_CONFIG,
};
