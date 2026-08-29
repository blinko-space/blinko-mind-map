import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseExtensionManifest } from "@blinko-cloud/cli/sdk";
import { createMindMap, flattenNodeText, outlineToMindMap, parseAiOutline, parseMindMap, serializeMindMap } from "../ui/model";

const root = resolve(import.meta.dirname, "..");
const blinko = resolve(root, "node_modules/.bin/blinko");

function runCli(command: "validate" | "build") {
  return execFileSync(blinko, ["extension", command, "."], { cwd: root, encoding: "utf8" });
}

describe("Blinko Mind Map App", () => {
  it("declares a sidebar workspace with owned persistence, search, and optional AI", () => {
    const manifest = parseExtensionManifest(JSON.parse(readFileSync(resolve(root, "blinko.app.json"), "utf8")));
    expect(manifest).toMatchObject({
      appId: "cloud.blinko.mind-map",
      permissions: {
        required: ["data:own:read", "data:own:write", "search:index:lexical"],
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

  it("bundles Mind Elixir and the Blinko host bridge without remote executable resources", () => {
    runCli("build");
    const resourceIndex = JSON.parse(readFileSync(resolve(root, "dist/resource-index.json"), "utf8"));
    const resource = resourceIndex.resources.find((item: { id: string }) => item.id === "ui.mind-map.workspace");
    expect(resource).toMatchObject({ kind: "document", mimeType: "text/html" });
    const html = readFileSync(resolve(root, "dist", resource.path), "utf8");
    expect(html).toContain("Blinko Mind Map");
    expect(html).toContain("mind-map.document");
    expect(html).toContain("blinkoCustomUi");
    expect(readFileSync(resolve(root, "ui/main.tsx"), "utf8")).toContain("host.ai.generate");
    const shell = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>");
    expect(shell).not.toMatch(/<script\b[^>]*\bsrc\s*=/i);
    expect(shell).not.toMatch(/<link\b[^>]*\brel=["']?stylesheet/i);
  }, 30_000);
});
