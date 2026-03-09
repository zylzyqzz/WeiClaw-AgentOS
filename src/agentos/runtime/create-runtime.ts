import { loadOrchestratorConfig } from "../config/loader.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { AgentRegistry } from "../registry/agent-registry.js";
import { SessionStore } from "../session/session-store.js";
import { createAgentOsStorage } from "../storage/factory.js";
import { bootstrapRegistry } from "./bootstrap.js";

export async function createAgentOsRuntime(cwd = process.cwd()) {
  const config = loadOrchestratorConfig(cwd);
  const storage = await createAgentOsStorage(config);
  const registry = new AgentRegistry(storage);
  await bootstrapRegistry(registry, config);

  const sessionStore = new SessionStore(storage);
  const memory = new MemoryManager(storage);
  const orchestrator = new Orchestrator(config, registry, sessionStore, memory);

  return {
    config,
    storage,
    registry,
    memory,
    sessionStore,
    orchestrator,
  };
}
