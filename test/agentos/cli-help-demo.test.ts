import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

function runCli(cwd: string, args: string[]) {
  const repoRoot = path.resolve(".");
  const script = path.join(repoRoot, "src/cli/agentos.ts");
  const tsxLoader = path.join(repoRoot, "node_modules/tsx/dist/loader.mjs");
  return spawnSync("node", ["--import", tsxLoader, script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });
}

describe("agentos cli help and demo", () => {
  it("prints quick-start oriented help", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-help-"));
    try {
      const help = runCli(root, ["help"]);
      expect(help.status).toBe(0);
      expect(help.stdout).toContain("Quick Start:");
      expect(help.stdout).toContain("demo");
      expect(help.stdout).toContain("list-agents (compat alias)");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("runs demo in human mode with route fields", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-demo-human-"));
    try {
      const demo = runCli(root, ["demo"]);
      expect(demo.status).toBe(0);
      expect(demo.stdout).toContain("routeSummary:");
      expect(demo.stdout).toContain("selectedRoles:");
      expect(demo.stdout).toContain("selectionReasons:");
      expect(demo.stdout).toContain("conclusion:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps list-agents alias working", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-alias-"));
    try {
      const list = runCli(root, ["list-agents", "--json"]);
      expect(list.status).toBe(0);
      const obj = JSON.parse(list.stdout);
      expect(obj.ok).toBe(true);
      expect(obj.command).toBe("list-roles");
      expect(obj.result).toBeInstanceOf(Array);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
