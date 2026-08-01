import { v4 as uuidv4 } from "uuid";
import type {
  ParsedStory,
  StoryFlowNode,
  StoryFlowEdge,
  StoryNodeData,
  ChoiceNodeData,
} from "@/types/story";

// ─── Heuristic signals for a "choice" paragraph ──────────────────────────────

const CHOICE_INDICATORS = [
  /you can (either|choose|decide)/i,
  /do you (go|take|choose|decide)/i,
  /what do you do/i,
  /you (must|have to) choose/i,
  /options?:/i,
  /choices?:/i,
];

const PARAGRAPH_SPLIT_RE = /\n{2,}/;

function isChoiceParagraph(text: string): boolean {
  return CHOICE_INDICATORS.some((re) => re.test(text));
}

function extractListItems(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  for (const line of lines) {
    const match = line.match(/^(?:[-*•]|\d+[.)]\s*|[a-zA-Z][.)]\s*)(.+)/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

function computeLayout(count: number) {
  const gapX = 350;
  const gapY = 200;
  return Array.from({ length: count }, (_, i) => ({
    x: 80 + i * gapX,
    y: 80 + (i % 2 === 0 ? 0 : gapY),
  }));
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parsePlainTextStory(rawText: string): ParsedStory {
  const paragraphs = rawText
    .split(PARAGRAPH_SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  if (paragraphs.length === 0) {
    return { title: "Untitled Story", nodes: [], edges: [] };
  }

  const nodes: StoryFlowNode[] = [];
  const edges: StoryFlowEdge[] = [];

  const title = paragraphs[0].split(/[.!?\n]/)[0].trim() || "Untitled Story";
  const positions = computeLayout(paragraphs.length);

  let lastNodeId: string | null = null;

  paragraphs.forEach((paragraph, idx) => {
    const nodeId = uuidv4();
    const pos = positions[idx];

    if (isChoiceParagraph(paragraph)) {
      const listItems = extractListItems(paragraph);
      const choices =
        listItems.length > 0
          ? listItems.map((label) => ({ id: uuidv4(), label }))
          : [
              { id: uuidv4(), label: "Continue…" },
              { id: uuidv4(), label: "Turn back…" },
            ];

      nodes.push({
        id: nodeId,
        type: "choiceNode",
        position: pos,
        data: {
          type: "choice",
          prompt: paragraph.split("\n")[0].trim(),
          choices,
        } as ChoiceNodeData,
      });
    } else {
      const isFirst = nodes.length === 0;
      nodes.push({
        id: nodeId,
        type: "storyNode",
        position: pos,
        data: {
          type: "story",
          title: isFirst ? title : `Scene ${idx + 1}`,
          content: paragraph,
          tags: isFirst ? ["intro"] : [],
        } as StoryNodeData,
      });
    }

    if (lastNodeId) {
      edges.push({
        id: uuidv4(),
        source: lastNodeId,
        target: nodeId,
        animated: true,
      });
    }
    lastNodeId = nodeId;
  });

  return { title, nodes, edges };
}

export async function parseStoryFile(file: File): Promise<ParsedStory> {
  const text = await file.text();
  return parsePlainTextStory(text);
}
