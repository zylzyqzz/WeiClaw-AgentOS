import { defaultOrchestratorConfig } from "../config/loader.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { Orchestrator } from "../orchestrator/orchestrator.js";
import { AgentOsRepository } from "../repository/agentos-repository.js";
import { AgentRegistry } from "../registry/agent-registry.js";
import { SessionStore } from "../session/session-store.js";
import { createAgentOsStorage } from "../storage/factory.js";
import { defaultDemoPresets } from "./defaults.js";
import { bootstrapRegistry } from "./bootstrap.js";

export async function createAgentOsRuntime(cwd = process.cwd()) {
  const baseConfig = defaultOrchestratorConfig(cwd);
  const storage = await createAgentOsStorage(baseConfig);
  const repository = new AgentOsRepository(storage, cwd);

  await repository.seedConfigIfEmpty(baseConfig);
  await repository.seedPresetsIfEmpty(defaultDemoPresets());

  const config = await repository.loadConfig(baseConfig);
  const registry = new AgentRegistry(storage);
  await bootstrapRegistry(registry, config);

  const consistencyIssues = await repository.checkConsistency(config);

  const sessionStore = new SessionStore(storage);
  const memory = new MemoryManager(storage);
  const orchestrator = new Orchestrator(config, registry, sessionStore, memory);

  return {
    config,
    storage,
    registry,
    repository,
    memory,
    sessionStore,
    orchestrator,
    consistencyIssues,
  };
}
