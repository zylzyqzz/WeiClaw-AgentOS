import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { createAgentOsRuntime } from "../../src/agentos/runtime/create-runtime.js";

function nowIso(): string {
  return new Date().toISOString();
}

describe("repository source of truth and migration", () => {
  it("migrates legacy .weiclaw-agentos.json into storage-backed source of truth", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-migration-"));
    const legacyPreset = {
      id: "legacy-demo",
      name: "Legacy Demo",
      description: "legacy preset",
      roles: ["commander"],
      order: ["commander"],
      defaultPolicy: {
        enabled: true,
        maxTurns: 3,
        allowedTools: [],
        deniedTools: [],
        constraints: [],
      },
      taskTypes: ["general"],
      tags: ["legacy"],
      enabled: true,
      version: "1.0.0",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await writeFile(
      join(root, ".weiclaw-agentos.json"),
      JSON.stringify(
        {
          defaultPreset: "legacy-demo",
          presets: {
            "legacy-demo": legacyPreset,
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const runtime = await createAgentOsRuntime(root);
    try {
      expect(runtime.config.defaultPreset).toBe("legacy-demo");
      expect(runtime.config.presets["legacy-demo"]?.id).toBe("legacy-demo");
      expect((await runtime.repository.getPreset("legacy-demo"))?.id).toBe("legacy-demo");
      expect(await runtime.storage.getMeta("legacy_config_migrated")).toBe("1");
    } finally {
      await runtime.storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports consistency issues for missing role references", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-consistency-"));
    const runtime = await createAgentOsRuntime(root);
    try {
      const badPreset = {
        id: "broken-preset",
        name: "Broken",
        description: "broken",
        roles: ["ghost-role"],
        order: ["ghost-role"],
        defaultPolicy: {
          enabled: true,
          maxTurns: 2,
          allowedTools: [],
          deniedTools: [],
          constraints: [],
        },
        taskTypes: ["general"],
        tags: [],
        enabled: true,
        version: "1.0.0",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await runtime.repository.upsertPreset(badPreset);

      const reloaded = await runtime.repository.loadConfig(defaultOrchestratorConfig(root));
      const issues = await runtime.repository.checkConsistency(reloaded);
      expect(issues.some((x) => x.code === "PRESET_ROLE_NOT_FOUND")).toBe(true);
    } finally {
      await runtime.storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
