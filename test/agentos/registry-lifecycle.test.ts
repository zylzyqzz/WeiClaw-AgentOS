import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { AgentRegistry } from "../../src/agentos/registry/agent-registry.js";
import { readRoleBundleJson, writeRoleBundleJson } from "../../src/agentos/registry/role-io.js";
import { validateRoleBundle } from "../../src/agentos/registry/role-validation.js";
import { bootstrapRegistry } from "../../src/agentos/runtime/bootstrap.js";
import { SqliteAgentOsStorage } from "../../src/agentos/storage/sqlite-storage.js";

describe("role lifecycle", () => {
  it("supports update, export/import, validate, and delete with preset reference checks", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-life-"));
    const dbPath = join(root, "agentos.db");
    const filePath = join(root, "qa-role.json");
    const storage = new SqliteAgentOsStorage(dbPath);
    await storage.init();

    try {
      const registry = new AgentRegistry(storage);
      const cfg = defaultOrchestratorConfig(root);
      await bootstrapRegistry(registry, cfg);

      const ts = new Date().toISOString();
      await registry.registerTemplate({
        id: "qa-template",
        name: "QA",
        description: "Quality role",
        goals: ["find risks"],
        systemInstruction: "Validate quality and risks",
        inputContract: "task",
        outputContract: "risk report",
        capabilities: ["qa", "review"],
        policy: { enabled: true, maxTurns: 4, allowedTools: [], deniedTools: [], constraints: [] },
        memoryScope: {
          layers: ["short-term", "long-term"],
          scopes: ["session:*"],
          crossSessionRead: false,
        },
        enabled: true,
        version: "1.0.0",
        tags: ["qa"],
        createdAt: ts,
        updatedAt: ts,
      });
      await registry.createRuntimeAgent({
        id: "qa",
        templateId: "qa-template",
        name: "QA",
        description: "QA runtime",
        capabilities: ["qa", "review"],
        policy: { enabled: true, maxTurns: 4, allowedTools: [], deniedTools: [], constraints: [] },
        memoryScope: {
          layers: ["short-term", "long-term"],
          scopes: ["session:*"],
          crossSessionRead: false,
        },
        enabled: true,
        version: "1.0.0",
        tags: ["qa"],
        createdAt: ts,
        updatedAt: ts,
      });

      const updated = await registry.updateRuntimeAgent("qa", {
        version: "1.0.1",
        tags: ["qa", "updated"],
      });
      expect(updated.version).toBe("1.0.1");

      const bundle = await registry.exportRoleBundle("qa");
      expect(validateRoleBundle(bundle).valid).toBe(true);
      await writeRoleBundleJson(filePath, bundle);
      const readBundle = await readRoleBundleJson(filePath);
      expect(readBundle.runtime.id).toBe("qa");

      await registry.deleteRuntimeAgent("qa", cfg.presets);
      await registry.deleteTemplate("qa-template");
      expect(await registry.inspectRuntimeAgent("qa")).toBeNull();

      await registry.importRoleBundle(readBundle, false);
      expect((await registry.inspectRuntimeAgent("qa"))?.runtime.id).toBe("qa");

      await expect(registry.deleteRuntimeAgent("builder", cfg.presets)).rejects.toThrow(
        "referenced by presets",
      );

      await unlink(filePath);
    } finally {
      await storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
