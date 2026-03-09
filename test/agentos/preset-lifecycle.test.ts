import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import {
  deletePreset,
  readPresetBundleFile,
  upsertPreset,
  writePresetBundleFile,
} from "../../src/agentos/config/store.js";

describe("preset lifecycle", () => {
  it("creates, updates, exports, imports, and deletes preset", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-preset-life-"));
    const config = defaultOrchestratorConfig(root);
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
      await upsertPreset(preset, root);
      const file = join(root, "qa-only.json");
      await writePresetBundleFile(file, preset);
      const imported = await readPresetBundleFile(file);
      expect(imported.id).toBe("qa-only");

      await upsertPreset(
        { ...imported, version: "1.0.1", updatedAt: new Date().toISOString() },
        root,
      );
      const raw = await readFile(join(root, ".weiclaw-agentos.json"), "utf8");
      expect(raw).toContain("qa-only");
      expect(raw).toContain("1.0.1");

      await deletePreset("qa-only", root);
      const afterDelete = await readFile(join(root, ".weiclaw-agentos.json"), "utf8");
      expect(afterDelete).not.toContain('"qa-only"');

      await expect(deletePreset(config.defaultPreset, root)).rejects.toThrow("defaultPreset");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
