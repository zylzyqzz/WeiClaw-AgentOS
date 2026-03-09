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

describe("orchestrator route selection", () => {
  async function setup() {
    const root = await mkdtemp(join(tmpdir(), "agentos-route-"));
    const storage = new SqliteAgentOsStorage(join(root, "agentos.db"));
    await storage.init();
    const cfg = defaultOrchestratorConfig(root);
    const registry = new AgentRegistry(storage);
    await bootstrapRegistry(registry, cfg);
    const orchestrator = new Orchestrator(
      cfg,
      registry,
      new SessionStore(storage),
      new MemoryManager(storage),
    );
    return { root, storage, cfg, registry, orchestrator };
  }

  it("uses explicit roles route when --roles is provided", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "s1",
        goal: "execute task",
        roles: ["commander", "reviewer"],
      });
      expect(result.routeSummary).toContain("explicit");
      expect(result.selectedRoles).toEqual(["commander", "reviewer"]);
      expect(result.selectionReasons.join(" ")).toContain("explicit roles requested");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("uses preset route when preset is provided", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "s2",
        goal: "build feature",
        preset: "default-demo",
      });
      expect(result.routeSummary).toContain("preset route");
      expect(result.selectedRoles.length).toBeGreaterThan(0);
      expect(result.selectionReasons.join(" ")).toContain("priority: preset");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("uses dynamic route and respects capabilities/preferred/excluded", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "s3",
        goal: "investigate and review issue",
        taskType: "research",
        requiredCapabilities: ["review"],
        preferredRoles: ["reviewer"],
        excludedRoles: ["builder"],
        preset: "",
      });
      expect(result.routeSummary).toContain("dynamic capability route");
      expect(result.selectedRoles).not.toContain("builder");
      expect(result.selectedRoles).toContain("reviewer");
      expect(result.selectedRoles).toContain("planner");
      expect(result.selectionReasons.length).toBeGreaterThan(0);
      expect(result.selectionReasons.join(" ")).toContain("priority: dynamic route");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("keeps explicit roles as highest priority over preset", async () => {
    const env = await setup();
    try {
      const result = await env.orchestrator.run({
        sessionId: "s-priority",
        goal: "override preset",
        roles: ["reviewer"],
        preset: "default-demo",
      });
      expect(result.routeSummary).toContain("explicit");
      expect(result.selectedRoles).toEqual(["reviewer"]);
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("uses taskType routing rule from config and reports reason", async () => {
    const env = await setup();
    try {
      env.cfg.routing.taskTypeRules["ops-hotfix"] = {
        requiredCapabilities: ["ops"],
        preferredRoles: ["builder"],
      };
      const result = await env.orchestrator.run({
        sessionId: "s-config",
        goal: "hotfix deployment pipeline",
        taskType: "ops-hotfix",
        preset: "",
      });
      expect(result.routeSummary).toContain("dynamic");
      expect(result.selectedRoles).toContain("builder");
      expect(result.selectionReasons.join(" ")).toContain("taskType rule applied: ops-hotfix");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });

  it("fails on invalid preset and on missing required capability", async () => {
    const env = await setup();
    try {
      await expect(
        env.orchestrator.run({
          sessionId: "s4",
          goal: "task",
          preset: "missing-preset",
        }),
      ).rejects.toThrow("Preset not found");

      await expect(
        env.orchestrator.run({
          sessionId: "s5",
          goal: "task",
          preset: "",
          requiredCapabilities: ["finance"],
          preferredRoles: ["builder"],
        }),
      ).rejects.toThrow("No enabled runtime roles");
    } finally {
      await env.storage.close();
      await rm(env.root, { recursive: true, force: true });
    }
  });
});
