import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { MemoryManager } from "../../src/agentos/memory/memory-manager.js";
import { Orchestrator } from "../../src/agentos/orchestrator/orchestrator.js";
import { AgentRegistry } from "../../src/agentos/registry/agent-registry.js";
import { bootstrapRegistry } from "../../src/agentos/runtime/bootstrap.js";
import { SessionStore } from "../../src/agentos/session/session-store.js";
import { SqliteAgentOsStorage } from "../../src/agentos/storage/sqlite-storage.js";

describe("AgentOS run contract", () => {
  it("returns route fields and structured output contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-run-"));
    const storage = new SqliteAgentOsStorage(join(root, "agentos.db"));
    await storage.init();

    try {
      const cfg = defaultOrchestratorConfig(root);
      const registry = new AgentRegistry(storage);
      await bootstrapRegistry(registry, cfg);
      const orchestrator = new Orchestrator(
        cfg,
        registry,
        new SessionStore(storage),
        new MemoryManager(storage),
      );

      const result = await orchestrator.run({ sessionId: "s", goal: "plan and build" });
      expect(result.routeSummary.length).toBeGreaterThan(0);
      expect(result.selectedRoles.length).toBeGreaterThan(0);
      expect(result.selectionReasons.length).toBeGreaterThan(0);
      expect(result.conclusion.length).toBeGreaterThan(0);
      expect(result.plan.length).toBeGreaterThan(0);
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.acceptance.length).toBeGreaterThan(0);
    } finally {
      await storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
