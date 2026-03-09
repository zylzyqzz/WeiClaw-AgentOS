import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

describe("cli json output and exit codes", () => {
  it("returns machine-readable json for list/inspect/validate commands", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-cli-json-"));
    try {
      const listRoles = runCli(root, ["list-roles", "--json"]);
      expect(listRoles.status).toBe(0);
      const listObj = JSON.parse(listRoles.stdout);
      expect(listObj.ok).toBe(true);
      expect(listObj.command).toBe("list-roles");
      expect(typeof listObj.version).toBe("string");
      expect(listObj.metadata).toBeTypeOf("object");
      expect(listObj.result).toBeInstanceOf(Array);

      const listPresets = runCli(root, ["list-presets", "--json"]);
      expect(listPresets.status).toBe(0);
      const presetObj = JSON.parse(listPresets.stdout);
      expect(presetObj.ok).toBe(true);
      expect(presetObj.command).toBe("list-presets");
      expect(presetObj.result).toBeInstanceOf(Array);

      const inspectPreset = runCli(root, ["inspect-preset", "--id", "default-demo", "--json"]);
      expect(inspectPreset.status).toBe(0);
      const inspectObj = JSON.parse(inspectPreset.stdout);
      expect(inspectObj.ok).toBe(true);
      expect(inspectObj.command).toBe("inspect-preset");
      expect(inspectObj.result.id).toBe("default-demo");

      const run = runCli(root, ["run", "--goal", "plan and build alpha", "--json"]);
      expect(run.status).toBe(0);
      const runObj = JSON.parse(run.stdout);
      expect(runObj.ok).toBe(true);
      expect(runObj.command).toBe("run");
      expect(typeof runObj.routeSummary).toBe("string");
      expect(runObj.selectedRoles).toBeInstanceOf(Array);
      expect(runObj.selectionReasons).toBeInstanceOf(Array);
      expect(runObj.result.routeSummary).toBe(runObj.routeSummary);

      const demo = runCli(root, ["demo", "--json"]);
      expect(demo.status).toBe(0);
      const demoObj = JSON.parse(demo.stdout);
      expect(demoObj.ok).toBe(true);
      expect(demoObj.command).toBe("demo");
      expect(demoObj.routeSummary).toContain("route");

      const memory = runCli(root, ["inspect-memory", "--session", "demo-main", "--json"]);
      expect(memory.status).toBe(0);
      const memoryObj = JSON.parse(memory.stdout);
      expect(memoryObj.ok).toBe(true);
      expect(memoryObj.command).toBe("inspect-memory");
      expect(memoryObj.result.records).toBeInstanceOf(Array);
      expect(memoryObj.result.summary.total).toBeTypeOf("number");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns structured error json and non-zero exit code", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "agentos-cli-err-"));
    try {
      const bad = runCli(root, ["inspect-preset", "--id", "missing", "--json"]);
      expect(bad.status).toBe(3);
      const errObj = JSON.parse(bad.stderr);
      expect(errObj.ok).toBe(false);
      expect(errObj.command).toBe("inspect-preset");
      expect(typeof errObj.version).toBe("string");
      expect(errObj.metadata.exitCode).toBe(3);
      expect(errObj.error.code).toBe("NOT_FOUND");

      const invalidPresetPath = path.join(root, "invalid-preset.json");
      await writeFile(
        invalidPresetPath,
        JSON.stringify({
          id: "bad",
          name: "bad",
          description: "bad",
          roles: [],
          order: [],
          defaultPolicy: {
            enabled: true,
            maxTurns: 0,
            allowedTools: [],
            deniedTools: [],
            constraints: [],
          },
          taskTypes: ["review"],
          tags: [],
          enabled: true,
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
      const validate = runCli(root, ["validate-preset", "--file", invalidPresetPath, "--json"]);
      expect(validate.status).toBe(2);
      const validateErr = JSON.parse(validate.stderr);
      expect(validateErr.ok).toBe(false);
      expect(validateErr.command).toBe("validate-preset");
      expect(validateErr.error.code).toBe("VALIDATION_FAILED");

      const unknown = runCli(root, ["no-such-command", "--json"]);
      expect(unknown.status).toBe(1);
      const unknownErr = JSON.parse(unknown.stderr);
      expect(unknownErr.error.code).toBe("UNKNOWN_COMMAND");
      expect(String(unknownErr.error.message)).toContain("Use:");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
