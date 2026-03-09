import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPresetBundleFile, writePresetBundleFile } from "../../src/agentos/config/store.js";
import { createAgentOsRuntime } from "../../src/agentos/runtime/create-runtime.js";

describe("preset lifecycle", () => {
  it("creates, updates, exports, imports, and deletes preset", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-preset-life-"));
    const preset = {
      id: "qa-only",
      name: "QA Only",
      description: "QA preset",
      roles: ["reviewer"],
      order: ["reviewer"],
      defaultPolicy: {
        enabled: true,
        maxTurns: 5,
        allowedTools: [],
        deniedTools: [],
        constraints: [],
      },
      taskTypes: ["review", "qa"],
      tags: ["qa"],
      enabled: true,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const runtime = await createAgentOsRuntime(root);
      await runtime.repository.upsertPreset(preset);
      const file = join(root, "qa-only.json");
      await writePresetBundleFile(file, preset);
      const imported = await readPresetBundleFile(file);
      expect(imported.id).toBe("qa-only");

      await runtime.repository.upsertPreset({
        ...imported,
        version: "1.0.1",
        updatedAt: new Date().toISOString(),
      });
      const updated = await runtime.repository.getPreset("qa-only");
      expect(updated?.version).toBe("1.0.1");

      await runtime.repository.deletePreset("qa-only", runtime.config.defaultPreset);
      expect(await runtime.repository.getPreset("qa-only")).toBeNull();

      await expect(
        runtime.repository.deletePreset(runtime.config.defaultPreset, runtime.config.defaultPreset),
      ).rejects.toThrow("defaultPreset");
      await runtime.storage.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
