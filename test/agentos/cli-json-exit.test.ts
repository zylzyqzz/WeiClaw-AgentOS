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

      const listPresets = runCli(root, ["list-presets", "--json"]);
      expect(listPresets.status).toBe(0);
      const presetObj = JSON.parse(listPresets.stdout);
      expect(presetObj.ok).toBe(true);

      const inspectPreset = runCli(root, ["inspect-preset", "--id", "default-demo", "--json"]);
      expect(inspectPreset.status).toBe(0);
      expect(JSON.parse(inspectPreset.stdout).ok).toBe(true);
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
      expect(validateErr.error.code).toBe("VALIDATION_FAILED");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
