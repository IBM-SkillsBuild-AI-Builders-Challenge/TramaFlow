import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import type { ChatRequestPayload } from "@/types/story";
import { STORY_SYSTEM_PROMPT, TICKET_SYSTEM_PROMPT } from "@/lib/systemPrompts";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const NodeSchema = z.object({
  id: z.string().describe("Unique node ID — used by edges as source/target"),
  type: z
    .enum(["storyNode", "choiceNode", "noteNode"])
    .describe("React Flow node type"),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z
      .string()
      .describe("Short display label (title for storyNode, prompt for choiceNode)"),
    text: z
      .string()
      .describe(
        "Full narrative content of the node (body text, dialogue, description)"
      ),
    tags: z
      .array(z.string())
      .describe(
        "Structural tags (intro | desarrollo | climax | conclusion) plus thematic tags. Never empty for storyNodes."
      ),
    choices: z
      .array(z.string())
      .optional()
      .describe(
        "Only for choiceNode: array of at least two option texts (e.g. ['Go left', 'Go right']). MUST have ≥2 items. Leave absent for storyNode / noteNode."
      ),
  }),
});

const EdgeSchema = z.object({
  id: z.string().describe("Unique edge ID"),
  source: z
    .string()
    .describe("Must match exactly the id of an existing node in the nodes array"),
  target: z
    .string()
    .describe("Must match exactly the id of an existing node in the nodes array"),
  sourceHandle: z
    .string()
    .nullable()
  /*  .describe(
      "choiceNode edges ONLY: MUST be 'choice-opt-0' (1st choice), 'choice-opt-1' (2nd), etc. " +
      "storyNode and noteNode edges: MUST be null."*/
    .optional()
    .default(null),
//    ),
  targetHandle: z
    .string()
    .nullable()
//    .describe("Handle id on the target node. ALWAYS null for every edge type, no exceptions."),
    .optional()
    .default(null),
  label: z
    .string()
//    .describe("Visible edge label shown on the canvas (the choice / route text)"),
    .optional()
    .default(""),
});

const StoryOutputSchema = z.object({
  nodeAction: z
    .literal("ADD_NODES")
    .describe("Always 'ADD_NODES' — instructs the canvas to merge new nodes"),
  nodes: z
    .array(NodeSchema)
    .describe("All new nodes to add to the React Flow canvas"),
  edges: z
    .array(EdgeSchema)
    .describe(
      "All new edges. CRITICAL: source and target values MUST match an id in the nodes array"
    ),
  deletedNodeIds: z
    .array(z.string())
    .optional()
    .describe(
      "IDs of nodes the user explicitly asked to delete. Copy the exact id string(s) here and do NOT re-emit those nodes in the nodes array."
    ),
  message: z
    .string()
    .describe(
      "Natural language reply shown in the chat panel explaining what was created or deleted"
    ),
});

// ─── Prompt selection (moved to /lib/systemPrompts.ts) ───────────────────────
// STORY_SYSTEM_PROMPT and TICKET_SYSTEM_PROMPT are imported above.
// The route selects the correct template based on the `mode` field in the
// request body.

// ─── IAM Token (cached — tokens last 1 hour) ──────────────────────────────────

let _iamCache: { token: string; expiresAt: number } | null = null;

async function getIAMToken(apiKey: string): Promise<string> {
  if (_iamCache && Date.now() < _iamCache.expiresAt - 60_000) {
    return _iamCache.token;
  }
  const res = await fetch("https://iam.cloud.ibm.com/identity/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`IAM auth failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  _iamCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return _iamCache.token;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequestPayload & { mode?: string } = await req.json();
    const { messages, graphContext } = body;

    // ── Select system prompt based on workspace mode ─────────────────────────
    const systemTemplate =
      body.mode === "ticket" ? TICKET_SYSTEM_PROMPT : STORY_SYSTEM_PROMPT;

    // ── Validate env vars ────────────────────────────────────────────────────
    const apiKey    = process.env.WATSONX_API_KEY;
    const projectId = process.env.WATSONX_PROJECT_ID;

    if (!apiKey || !projectId) {
      return NextResponse.json(
        { error: "Missing WATSONX_API_KEY or WATSONX_PROJECT_ID in .env.local" },
        { status: 500 }
      );
    }

    // ── Build conversation history ───────────────────────────────────────────
    // Omit the last user turn — it is sent separately as the final message.
    const allHuman = messages.filter((m) => m.role === "user");
    const lastUserMessage = allHuman.at(-1)?.content ?? "";

    const historyMessages = messages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    // ── Build rich node context ──────────────────────────────────────────────
    const existingNodeContext =
      graphContext?.nodes
        .map((n) => {
          const data = n.data as unknown as Record<string, unknown>;
          const title =
            (data.title as string) ||
            (data.prompt as string) ||
            ((data.content as string)?.slice(0, 40)) ||
            "untitled";
          const kind = (data.type as string) || n.type || "storyNode";

          let extra = "";
          if (kind === "story") {
            const content = (data.content as string) ?? "";
            extra = `\n    content: "${content.slice(0, 100)}${content.length > 100 ? "…" : ""}"`;
            const tags = (data.tags as string[]) ?? [];
            if (tags.length) extra += `\n    tags: [${tags.join(", ")}]`;
          } else if (kind === "choice") {
            const choices = (data.choices as Array<{ label: string }>) ?? [];
            if (choices.length)
              extra += `\n    choices: [${choices.map((c) => `"${c.label}"`).join(", ")}]`;
          }
          return `  - ${n.id}: "${title}" [${kind}]${extra}`;
        })
        .join("\n") || "  (canvas is empty)";

    // ── Build message array for the watsonx API ──────────────────────────────
    const systemContent = systemTemplate
      .replace("{nodeCount}", String(graphContext?.nodes.length ?? 0))
      .replace("{edgeCount}", String(graphContext?.edges.length ?? 0))
      .replace("{existingNodeContext}", existingNodeContext);

    const apiMessages = [
      { role: "system", content: systemContent },
      ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: lastUserMessage },
    ];

    // ── Get IAM token and call watsonx directly ──────────────────────────────
    const iamToken   = await getIAMToken(apiKey);
    const serviceUrl = process.env.WATSONX_URL  ?? "https://us-south.ml.cloud.ibm.com";
    const modelId    = process.env.WATSONX_MODEL ?? "meta-llama/llama-3-3-70b-instruct";

    const watsonxRes = await Promise.race([
      fetch(`${serviceUrl}/ml/v1/text/chat?version=2023-05-29`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${iamToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          model_id:    modelId,
          project_id:  projectId,
          messages:    apiMessages,
          max_tokens:  2000,
          temperature: 0.2,
          top_p:       1,
        }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI request timed out after 45 seconds.")), 45_000)
      ),
    ]);

    if (!watsonxRes.ok) {
      const errBody = await watsonxRes.text();
      throw new Error(`watsonx error ${watsonxRes.status}: ${errBody}`);
    }

    const watsonxData = await watsonxRes.json();
    const rawText: string = watsonxData?.choices?.[0]?.message?.content ?? "";
    console.log("[chat] model raw:", rawText.slice(0, 600));

    // ── Parse JSON response ──────────────────────────────────────────────────
    // Strip markdown fences if the model wraps the JSON anyway
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    // Extract the first valid JSON object from the response
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd   = cleaned.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Model did not return valid JSON. Try again.");
    }
    const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);

    // Parse and validate with Zod
    let result: z.infer<typeof StoryOutputSchema>;
      try {
        result = StoryOutputSchema.parse(JSON.parse(jsonStr));
      } catch (zodErr) {
        const detail = zodErr instanceof z.ZodError
          ? zodErr.issues.map(e => `${e.path.join(".")}: ${e.message}`).join(" | ")
          : String(zodErr);
        console.error("[chat] Zod failed:", detail);
        console.error("[chat] JSON recibido:", jsonStr.slice(0, 400));
        throw new Error(`Schema: ${detail}`);
      }

    // ── Hard cap — prevents runaway generation ───────────────────────────────
    const MAX_NODES_PER_RESPONSE = 10;
    let { nodes: rawNodes, edges: rawEdges } = result;

    if (rawNodes.length > MAX_NODES_PER_RESPONSE) {
      console.warn(
        `[/api/chat] Capped: LLM generated ${rawNodes.length} nodes, trimming to ${MAX_NODES_PER_RESPONSE}`
      );
      rawNodes = rawNodes.slice(0, MAX_NODES_PER_RESPONSE);
      const keptIds = new Set(rawNodes.map((n) => n.id));
      rawEdges = rawEdges.filter(
        (e) => keptIds.has(e.source) && keptIds.has(e.target)
      );
    }

    // ── Map structured output → NodeAction ──────────────────────────────────
    const nodes = rawNodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: buildNodeData(n),
    }));

    const edges = rawEdges.map((e) => ({
      id: e.id || uuidv4(),
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      label: e.label || undefined,
      animated: true,
    }));

    const deletedNodeIds = result.deletedNodeIds ?? [];

    const nodeAction =
      nodes.length > 0 || deletedNodeIds.length > 0
        ? {
            type: "ADD_NODES" as const,
            nodes,
            edges,
            deletedNodeIds,
          }
        : undefined;

    return NextResponse.json({
      message: result.message,
      nodeAction,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[/api/chat] error:", raw);

    let userMessage = "AI unavailable. Check the server logs.";
    if (raw.includes("401") || raw.includes("Unauthorized")) {
      userMessage = "Invalid API key. Check WATSONX_API_KEY in .env.local.";
    } else if (raw.includes("404") || raw.includes("Not Found")) {
      userMessage = "Model or project not found. Check WATSONX_PROJECT_ID and WATSONX_MODEL.";
    } else if (raw.includes("timed out")) {
      userMessage = "Request timed out. watsonx may be slow — try again.";
    } else if (raw.includes("ECONNREFUSED") || raw.includes("ENOTFOUND")) {
      userMessage = "Cannot reach watsonx. Check WATSONX_URL and your internet connection.";
    } else if (raw.includes("IAM auth failed")) {
      userMessage = raw; // surface the exact IAM error
    } else if (raw.includes("watsonx error")) {
      userMessage = raw; // surface the exact watsonx HTTP error
    }

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RawNode = z.infer<typeof NodeSchema>;

/**
 * Translates the flat {label, text, tags} shape from the LLM into the
 * correct discriminated union shape that the React Flow node components expect.
 */
function buildNodeData(n: RawNode) {
  switch (n.type) {
    case "storyNode":
      return {
        type: "story" as const,
        title: n.data.label,
        content: n.data.text,
        tags: n.data.tags,
      };
    case "choiceNode":
      return {
        type: "choice" as const,
        prompt: n.data.label,
        choices: (n.data.choices ?? []).map((label, index) => ({
          id: `opt-${index}`,
          label,
        })),
        collapsed: false,
      };
    case "noteNode":
    default:
      return {
        type: "note" as const,
        content: n.data.text || n.data.label,
      };
  }
}
