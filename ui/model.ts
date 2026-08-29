import type { MindElixirData, NodeObj } from "mind-elixir";

export const MAP_TYPE_KEY = "mind-map.document";
export const MAX_DOCUMENT_LENGTH = 800_000;
export const MAX_NODE_TEXT_LENGTH = 200_000;
export const DEFAULT_MAIN_BRANCH_DIRECTION = 1 as const;

export type MainBranchDirection = 0 | 1;

export type MindMapDocument = {
  title: string;
  nodeText: string;
  document: string;
  createdAt: string;
  updatedAt: string;
};

export type AiOutlineNode = { topic: string; children?: AiOutlineNode[] };

function plainTopic(value: string, maxLength: number): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function id(): string {
  return `node_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createMindMap(topic: string): MindElixirData {
  return { nodeData: { id: id(), topic: topic.trim().slice(0, 160) || "Untitled" }, direction: 2 };
}

function cleanNode(input: unknown, depth = 0, budget = { count: 0 }): NodeObj {
  if (!input || typeof input !== "object" || depth > 12 || budget.count >= 1_000) {
    throw new Error("INVALID_MAP_DOCUMENT");
  }
  budget.count += 1;
  const source = input as Record<string, unknown>;
  const topic = typeof source.topic === "string" ? plainTopic(source.topic, 2_000) : "";
  if (!topic) throw new Error("INVALID_MAP_DOCUMENT");
  const children = Array.isArray(source.children)
    ? source.children.slice(0, 250).map((child) => cleanNode(child, depth + 1, budget))
    : undefined;
  return {
    id: typeof source.id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(source.id) ? source.id : id(),
    topic,
    ...(children?.length ? { children } : {}),
    ...(typeof source.expanded === "boolean" ? { expanded: source.expanded } : {}),
    ...(source.direction === 0 || source.direction === 1 ? { direction: source.direction } : {}),
    ...(typeof source.branchColor === "string" && /^#[0-9a-f]{6}$/i.test(source.branchColor)
      ? { branchColor: source.branchColor } : {}),
    ...(typeof source.note === "string" ? { note: source.note.slice(0, 8_000) } : {}),
  };
}

export function cleanMindMap(input: unknown): MindElixirData {
  if (!input || typeof input !== "object") throw new Error("INVALID_MAP_DOCUMENT");
  const source = input as Record<string, unknown>;
  return {
    nodeData: cleanNode(source.nodeData),
    direction: source.direction === 0 || source.direction === 1 || source.direction === 2 || source.direction === 3
      ? source.direction : 2,
    ...(typeof source.compact === "boolean" ? { compact: source.compact } : {}),
  };
}

export function parseMindMap(document: string): MindElixirData {
  if (!document || document.length > MAX_DOCUMENT_LENGTH) throw new Error("INVALID_MAP_DOCUMENT");
  return cleanMindMap(JSON.parse(document));
}

export function serializeMindMap(data: MindElixirData): string {
  const serialized = JSON.stringify(cleanMindMap(data));
  if (serialized.length > MAX_DOCUMENT_LENGTH) throw new Error("MAP_TOO_LARGE");
  return serialized;
}

export function mainBranchDirectionForDrop(pointerX: number, rootCenterX: number): MainBranchDirection {
  return pointerX < rootCenterX ? 0 : 1;
}

export function setMainBranchDirection(
  data: MindElixirData,
  nodeId: string,
  direction: MainBranchDirection,
): boolean {
  const branch = data.nodeData.children?.find((child) => child.id === nodeId);
  if (!branch || branch.direction === direction) return false;
  branch.direction = direction;
  return true;
}

export function flattenNodeText(data: MindElixirData): string {
  const lines: string[] = [];
  let length = 0;
  const visit = (node: NodeObj) => {
    if (length >= MAX_NODE_TEXT_LENGTH) return;
    const topic = node.topic.trim();
    lines.push(topic);
    length += topic.length + 1;
    node.children?.forEach(visit);
  };
  visit(data.nodeData);
  return lines.join("\n").slice(0, MAX_NODE_TEXT_LENGTH);
}

function outlineNode(input: unknown, depth: number, budget: { count: number }): AiOutlineNode {
  if (!input || typeof input !== "object" || depth > 6 || budget.count >= 100) throw new Error("INVALID_AI_OUTLINE");
  budget.count += 1;
  const source = input as Record<string, unknown>;
  const topic = typeof source.topic === "string" ? plainTopic(source.topic, 160) : "";
  if (!topic) throw new Error("INVALID_AI_OUTLINE");
  const children = Array.isArray(source.children)
    ? source.children.slice(0, 12).map((child) => outlineNode(child, depth + 1, budget))
    : undefined;
  return { topic, ...(children?.length ? { children } : {}) };
}

export function parseAiOutline(text: string): AiOutlineNode {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return outlineNode(JSON.parse(cleaned), 0, { count: 0 });
}

export function outlineToMindMap(outline: AiOutlineNode): MindElixirData {
  const convert = (node: AiOutlineNode): NodeObj => ({
    id: id(), topic: node.topic,
    ...(node.children?.length ? { children: node.children.map(convert) } : {}),
  });
  return { nodeData: convert(outline), direction: 2 };
}
