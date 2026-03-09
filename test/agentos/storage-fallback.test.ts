import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultOrchestratorConfig } from "../../src/agentos/config/loader.js";
import { createAgentOsStorage } from "../../src/agentos/storage/factory.js";

describe("AgentOS storage factory", () => {
  it("falls back to file storage when sqlite path is invalid", async () => {
    const root = await mkdtemp(join(tmpdir(), "agentos-fallback-"));
    const config = {
      ...defaultOrchestratorConfig(root),
      storagePath: "/dev/null/agentos.db",
      fallbackPath: join(root, "fallback.json"),
    };

    const storage = await createAgentOsStorage(config);
    try {
      await storage.upsertSession({
        sessionId: "s1",
        status: "idle",
        updatedAt: new Date().toISOString(),
        meta: {},
      });

      const raw = await readFile(config.fallbackPath, "utf8");
      expect(raw).toContain('"sessions"');
    } finally {
      await storage.close();
      await rm(root, { recursive: true, force: true });
    }
  });
});
