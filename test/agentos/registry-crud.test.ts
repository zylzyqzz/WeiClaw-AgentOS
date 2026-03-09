import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../../src/agentos/registry/agent-registry.js";
import { SqliteAgentOsStorage } from "../../src/agentos/storage/sqlite-storage.js";

describe("AgentRegistry basic CRUD", () => {
  it("creates, enables, disables, and inspects runtime role", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-registry-"));
    const storage = new SqliteAgentOsStorage(join(root, "db.sqlite"));
    await storage.init();

    try {
      const registry = new AgentRegistry(storage);
      const ts = new Date().toISOString();
      await registry.registerTemplate({
        id: "qa-template",
        name: "QA",
        description: "Quality assurance role",
        goals: ["prevent regressions"],
        systemInstruction: "Review output quality and risks",
        inputContract: "task",
        outputContract: "qa result",
        capabilities: ["qa", "review"],
        policy: {
          enabled: true,
          maxTurns: 4,
          allowedTools: [],
          deniedTools: [],
          constraints: [],
        },
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
        policy: {
          enabled: true,
          maxTurns: 4,
          allowedTools: [],
          deniedTools: [],
          constraints: [],
        },
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

      await registry.disableRuntimeAgent("qa");
      expect((await registry.inspectRuntimeAgent("qa"))?.runtime.enabled).toBe(false);

      await registry.enableRuntimeAgent("qa");
      expect((await registry.inspectRuntimeAgent("qa"))?.runtime.enabled).toBe(true);
    } finally {
      await storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
