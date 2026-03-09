import type { AgentRegistry } from "../registry/agent-registry.js";
import type { OrchestratorConfig, RoleTemplate, RuntimeAgent } from "../types.js";
import { defaultDemoRoleTemplates, defaultDemoRuntimeAgents } from "./defaults.js";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTemplate(input: RoleTemplate): RoleTemplate {
  const ts = nowIso();
  return {
    ...input,
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
  };
}

function normalizeRuntimeAgent(input: RuntimeAgent): RuntimeAgent {
  const ts = nowIso();
  return {
    ...input,
    createdAt: input.createdAt ?? ts,
    updatedAt: ts,
  };
}

export async function bootstrapRegistry(
  registry: AgentRegistry,
  config: OrchestratorConfig,
): Promise<void> {
  const existingTemplates = await registry.listTemplates();
  const existingAgents = await registry.listRuntimeAgents();

  if (existingTemplates.length === 0 && existingAgents.length === 0) {
    for (const template of defaultDemoRoleTemplates()) {
      await registry.registerTemplate(template);
    }
    for (const agent of defaultDemoRuntimeAgents()) {
      await registry.createRuntimeAgent(agent);
    }
  }

  for (const template of config.roleTemplates ?? []) {
    await registry.registerTemplate(normalizeTemplate(template));
  }
  for (const agent of config.runtimeAgents ?? []) {
    await registry.createRuntimeAgent(normalizeRuntimeAgent(agent));
  }
}
