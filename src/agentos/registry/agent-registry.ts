import type { AgentOsStorage } from "../storage/storage.js";
import type {
  AgentCapability,
  AgentPolicy,
  PresetDefinition,
  RoleBundle,
  RoleTemplate,
  RuntimeAgent,
} from "../types.js";
import { findPresetReferences } from "./preset-utils.js";
import { validateRoleBundle } from "./role-validation.js";

export interface ResolvedRuntimeAgent {
  runtime: RuntimeAgent;
  template: RoleTemplate;
  effectiveCapabilities: AgentCapability[];
  effectivePolicy: AgentPolicy;
}

export class AgentRegistry {
  constructor(private readonly storage: AgentOsStorage) {}

  async registerTemplate(template: RoleTemplate): Promise<void> {
    await this.storage.upsertRoleTemplate(template);
  }

  async updateTemplate(templateId: string, patch: Partial<RoleTemplate>): Promise<RoleTemplate> {
    const current = await this.storage.getRoleTemplate(templateId);
    if (!current) {
      throw new Error(`RoleTemplate not found: ${templateId}`);
    }
    const next: RoleTemplate = {
      ...current,
      ...patch,
      id: current.id,
      updatedAt: new Date().toISOString(),
    };
    await this.storage.upsertRoleTemplate(next);
    return next;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const agents = await this.storage.listRuntimeAgents();
    if (agents.some((agent) => agent.templateId === templateId)) {
      throw new Error(`Cannot delete RoleTemplate ${templateId}: RuntimeAgent still references it`);
    }
    await this.storage.deleteRoleTemplate(templateId);
  }

  async listTemplates(): Promise<RoleTemplate[]> {
    return this.storage.listRoleTemplates();
  }

  async createRuntimeAgent(agent: RuntimeAgent): Promise<void> {
    const template = await this.storage.getRoleTemplate(agent.templateId);
    if (!template) {
      throw new Error(`RoleTemplate not found: ${agent.templateId}`);
    }
    await this.storage.upsertRuntimeAgent(agent);
  }

  async updateRuntimeAgent(agentId: string, patch: Partial<RuntimeAgent>): Promise<RuntimeAgent> {
    const current = await this.storage.getRuntimeAgent(agentId);
    if (!current) {
      throw new Error(`RuntimeAgent not found: ${agentId}`);
    }
    const next: RuntimeAgent = {
      ...current,
      ...patch,
      id: current.id,
      templateId: patch.templateId ?? current.templateId,
      updatedAt: new Date().toISOString(),
    };
    const template = await this.storage.getRoleTemplate(next.templateId);
    if (!template) {
      throw new Error(`RoleTemplate not found: ${next.templateId}`);
    }
    await this.storage.upsertRuntimeAgent(next);
    return next;
  }

  async enableRuntimeAgent(agentId: string): Promise<void> {
    await this.updateRuntimeAgent(agentId, { enabled: true });
  }

  async disableRuntimeAgent(agentId: string): Promise<void> {
    await this.updateRuntimeAgent(agentId, { enabled: false });
  }

  async deleteRuntimeAgent(
    agentId: string,
    presets: Record<string, PresetDefinition>,
  ): Promise<void> {
    const refs = findPresetReferences(presets, agentId);
    if (refs.length > 0) {
      throw new Error(
        `Cannot delete RuntimeAgent ${agentId}: referenced by presets ${refs.join(", ")}`,
      );
    }
    await this.storage.deleteRuntimeAgent(agentId);
  }

  async listRuntimeAgents(): Promise<RuntimeAgent[]> {
    return this.storage.listRuntimeAgents();
  }

  async inspectRuntimeAgent(agentId: string): Promise<ResolvedRuntimeAgent | null> {
    const runtime = await this.storage.getRuntimeAgent(agentId);
    if (!runtime) {
      return null;
    }
    const template = await this.storage.getRoleTemplate(runtime.templateId);
    if (!template) {
      return null;
    }
    return this.resolve(runtime, template);
  }

  async resolveMany(agentIds: string[]): Promise<ResolvedRuntimeAgent[]> {
    const out: ResolvedRuntimeAgent[] = [];
    for (const id of agentIds) {
      const resolved = await this.inspectRuntimeAgent(id);
      if (!resolved) {
        continue;
      }
      if (!resolved.runtime.enabled) {
        continue;
      }
      if (!resolved.template.enabled) {
        continue;
      }
      if (!resolved.effectivePolicy.enabled) {
        continue;
      }
      out.push(resolved);
    }
    return out;
  }

  async exportRoleBundle(agentId: string): Promise<RoleBundle> {
    const resolved = await this.inspectRuntimeAgent(agentId);
    if (!resolved) {
      throw new Error(`RuntimeAgent not found: ${agentId}`);
    }
    return {
      template: resolved.template,
      runtime: resolved.runtime,
    };
  }

  async importRoleBundle(bundle: RoleBundle, overwrite = false): Promise<void> {
    const validation = validateRoleBundle(bundle);
    if (!validation.valid) {
      const first = validation.findings.find((x) => x.level === "error");
      throw new Error(`Invalid role bundle: ${first?.target}: ${first?.message}`);
    }

    const existingRole = await this.storage.getRuntimeAgent(bundle.runtime.id);
    const existingTemplate = await this.storage.getRoleTemplate(bundle.template.id);
    if (!overwrite && (existingRole || existingTemplate)) {
      throw new Error(
        `Role import conflict: existing role/template found for ${bundle.runtime.id}`,
      );
    }

    await this.storage.upsertRoleTemplate(bundle.template);
    await this.storage.upsertRuntimeAgent(bundle.runtime);
  }

  private resolve(runtime: RuntimeAgent, template: RoleTemplate): ResolvedRuntimeAgent {
    const effectiveCapabilities =
      runtime.capabilities.length > 0 ? runtime.capabilities : template.capabilities;
    const effectivePolicy: AgentPolicy = {
      ...template.policy,
      ...runtime.policy,
      enabled: runtime.enabled && template.enabled && runtime.policy.enabled,
    };
    return {
      runtime,
      template,
      effectiveCapabilities,
      effectivePolicy,
    };
  }
}
