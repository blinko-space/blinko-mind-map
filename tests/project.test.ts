import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@blinko-cloud/cli/sdk";
import {
  DEFAULT_MAIN_BRANCH_DIRECTION,
  createMindMap,
  flattenNodeText,
  mainBranchDirectionForDrop,
  outlineToMindMap,
  parseAiOutline,
  parseMindMap,
  serializeMindMap,
  setMainBranchDirection,
} from "../ui/model";

const root = resolve(import.meta.dirname, "..");
const blinko = resolve(root, "../../packages/cli/dist/blinko.mjs");

function runCli(command: "validate" | "build") {
  return execFileSync(process.execPath, [blinko, "extension", command, "."], { cwd: root, encoding: "utf8" });
}

describe("Blinko Mind Map App", () => {
  it("declares a sidebar workspace with owned persistence, search, and optional AI", () => {
    const manifest = parseExtensionManifest(JSON.parse(readFileSync(resolve(root, "blinko.app.json"), "utf8")));
    expect(manifest).toMatchObject({
      appId: "cloud.blinko.mind-map",
      permissions: {
        required: ["data:own:read", "data:own:write", "search:index:lexical", "state:own:read", "state:own:write"],
        optional: ["ai:generate"],
      },
      dataTypes: [expect.objectContaining({
        typeKey: "mind-map.document",
        search: { lexical: expect.arrayContaining(["title", "nodeText"]), semantic: [] },
      })],
      contributes: { items: [expect.objectContaining({ surface: "sidebar", viewId: "mind-map.workspace" })] },
    });
    expect(runCli("validate")).toContain("Valid cloud.blinko.mind-map");
  });

  it("keeps editable documents bounded and projects node text for Blinko search", () => {
    const map = createMindMap("Launch plan");
    map.nodeData.children = [
      { id: "research", topic: "Research", children: [{ id: "unsafe", topic: "<img src=x onerror=alert(1)> Customers" }] },
      { id: "ship", topic: "Ship" },
    ];
    const parsed = parseMindMap(serializeMindMap(map));
    expect(parsed.nodeData.children?.[0]?.children?.[0]?.topic).not.toContain("<");
    expect(flattenNodeText(parsed)).toBe("Launch plan\nResearch\nimg src=x onerror=alert(1) Customers\nShip");
  });

  it("accepts fenced AI JSON but rejects malformed or over-deep outlines", () => {
    const outline = parseAiOutline('```json\n{"topic":"Plan","children":[{"topic":"First"}]}\n```');
    expect(outlineToMindMap(outline).nodeData.children?.[0]?.topic).toBe("First");
    expect(() => parseAiOutline("not JSON")).toThrow("JSON");
    const tooDeep = { topic: "0" } as { topic: string; children?: unknown[] };
    let cursor = tooDeep;
    for (let index = 1; index < 9; index += 1) {
      const child = { topic: String(index) };
      cursor.children = [child]; cursor = child;
    }
    expect(() => parseAiOutline(JSON.stringify(tooDeep))).toThrow("INVALID_AI_OUTLINE");
  });

  it("defaults new main branches to the right and persists cross-center side changes", () => {
    expect(DEFAULT_MAIN_BRANCH_DIRECTION).toBe(1);
    expect(mainBranchDirectionForDrop(199, 200)).toBe(0);
    expect(mainBranchDirectionForDrop(200, 200)).toBe(1);
    const map = createMindMap("Direction test");
    map.nodeData.children = [
      { id: "main", topic: "Main branch", direction: 0, children: [{ id: "nested", topic: "Nested" }] },
    ];
    expect(setMainBranchDirection(map, "nested", 1)).toBe(false);
    expect(setMainBranchDirection(map, "main", 1)).toBe(true);
    expect(parseMindMap(serializeMindMap(map)).nodeData.children?.[0]?.direction).toBe(1);
  });

  it("bundles Mind Elixir and the Blinko host bridge without remote executable resources", () => {
    runCli("build");
    const resourceIndex = JSON.parse(readFileSync(resolve(root, "dist/resource-index.json"), "utf8"));
    const resource = resourceIndex.resources.find((item: { id: string }) => item.id === "ui.mind-map.workspace");
    expect(resource).toMatchObject({ kind: "document", mimeType: "text/html" });
    const html = readFileSync(resolve(root, "dist", resource.path), "utf8");
    expect(html).toContain("Blinko Mind Map");
    expect(html).toContain("mind-map.document");
    expect(html).toContain("blinkoCustomUi");
    expect(html).not.toContain("process.env.NODE_ENV");
    const main = readFileSync(resolve(root, "ui/main.tsx"), "utf8");
    const styles = readFileSync(resolve(root, "ui/styles.css"), "utf8");
    expect(main).toContain("host.ai.generate");
    expect(main).toContain("overflowHidden: false");
    expect(main).toContain("mouseSelectionButton: 2");
    expect(main).toContain("handleWheel:");
    expect(main).toContain("mind-map.guide-v1");
    expect(main).toContain("renameMapTitle");
    expect(main).toContain('addEventListener("contextmenu", contextMenu, true)');
    expect(main).toContain("copyNode");
    expect(main).toContain('addEventListener("pointermove", pointerMove, true)');
    expect(main).toContain("mainBranchDirectionForDrop");
    expect(main).toContain("DEFAULT_MAIN_BRANCH_DIRECTION");
    expect(main).toContain("newTopicName:");
    expect(styles).toContain("radial-gradient");
    expect(styles).toContain(".zoom-controls");
    expect(styles).toContain(".canvas-context-menu");
    expect(styles).toContain(".context-menu .menu-list");
    const shell = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>");
    expect(shell).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(shell).not.toMatch(/<link\b[^>]*\brel=["']?stylesheet/i);
  }, 30_000);
});
