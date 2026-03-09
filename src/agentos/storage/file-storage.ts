import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  MemoryRecord,
  OrchestratorConfig,
  PresetDefinition,
  RoleTemplate,
  RuntimeAgent,
  SessionState,
} from "../types.js";
import type { AgentOsStorage } from "./storage.js";

interface FileDb {
  sessions: Record<string, SessionState>;
  memory: MemoryRecord[];
  roleTemplates: Record<string, RoleTemplate>;
  runtimeAgents: Record<string, RuntimeAgent>;
  presets: Record<string, PresetDefinition>;
  runtimeConfig?: Partial<OrchestratorConfig>;
  meta: Record<string, string>;
}

export class FileAgentOsStorage implements AgentOsStorage {
  private state: FileDb = {
    sessions: {},
    memory: [],
    roleTemplates: {},
    runtimeAgents: {},
    presets: {},
    runtimeConfig: undefined,
    meta: {},
  };

  constructor(private readonly filePath: string) {}

  async init(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<FileDb>;
      this.state = {
        sessions: parsed.sessions ?? {},
        memory: parsed.memory ?? [],
        roleTemplates: parsed.roleTemplates ?? {},
        runtimeAgents: parsed.runtimeAgents ?? {},
        presets: parsed.presets ?? {},
        runtimeConfig: parsed.runtimeConfig,
        meta: parsed.meta ?? {},
      };
    } catch {
      await this.flush();
    }
  }

  async close(): Promise<void> {}

  async upsertSession(state: SessionState): Promise<void> {
    this.state.sessions[state.sessionId] = state;
    await this.flush();
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    return this.state.sessions[sessionId] ?? null;
  }

  async appendMemory(
    input: Omit<MemoryRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ): Promise<MemoryRecord> {
    const record: MemoryRecord = {
      id: input.id ?? randomUUID(),
      createdAt: input.createdAt ?? new Date().toISOString(),
      sessionId: input.sessionId,
      layer: input.layer,
      scope: input.scope,
      content: input.content,
      summary: input.summary,
      sourceTaskId: input.sourceTaskId,
    };
    this.state.memory.unshift(record);
    await this.flush();
    return record;
  }

  async listMemory(query: { sessionId?: string; layer?: string; scope?: string; limit?: number }): Promise<MemoryRecord[]> {
    let rows = this.state.memory;
    if (query.sessionId) {rows = rows.filter((x) => x.sessionId === query.sessionId);}
    if (query.layer) {rows = rows.filter((x) => x.layer === query.layer);}
    if (query.scope) {rows = rows.filter((x) => x.scope === query.scope);}
    return rows.slice(0, Math.max(1, query.limit ?? 50));
  }

  async upsertRoleTemplate(template: RoleTemplate): Promise<void> {
    this.state.roleTemplates[template.id] = template;
    await this.flush();
  }

  async getRoleTemplate(templateId: string): Promise<RoleTemplate | null> {
    return this.state.roleTemplates[templateId] ?? null;
  }

  async listRoleTemplates(): Promise<RoleTemplate[]> {
    return Object.values(this.state.roleTemplates).toSorted((a, b) => a.id.localeCompare(b.id));
  }

  async deleteRoleTemplate(templateId: string): Promise<void> {
    delete this.state.roleTemplates[templateId];
    await this.flush();
  }

  async upsertRuntimeAgent(agent: RuntimeAgent): Promise<void> {
    this.state.runtimeAgents[agent.id] = agent;
    await this.flush();
  }

  async getRuntimeAgent(agentId: string): Promise<RuntimeAgent | null> {
    return this.state.runtimeAgents[agentId] ?? null;
  }

  async listRuntimeAgents(): Promise<RuntimeAgent[]> {
    return Object.values(this.state.runtimeAgents).toSorted((a, b) => a.id.localeCompare(b.id));
  }

  async deleteRuntimeAgent(agentId: string): Promise<void> {
    delete this.state.runtimeAgents[agentId];
    await this.flush();
  }

  async upsertPreset(preset: PresetDefinition): Promise<void> {
    this.state.presets[preset.id] = preset;
    await this.flush();
  }

  async getPreset(presetId: string): Promise<PresetDefinition | null> {
    return this.state.presets[presetId] ?? null;
  }

  async listPresets(): Promise<PresetDefinition[]> {
    return Object.values(this.state.presets).toSorted((a, b) => a.id.localeCompare(b.id));
  }

  async deletePreset(presetId: string): Promise<void> {
    delete this.state.presets[presetId];
    await this.flush();
  }

  async getRuntimeConfig(): Promise<Partial<OrchestratorConfig> | null> {
    return this.state.runtimeConfig ?? null;
  }

  async setRuntimeConfig(config: Partial<OrchestratorConfig>): Promise<void> {
    this.state.runtimeConfig = config;
    await this.flush();
  }

  async getMeta(key: string): Promise<string | null> {
    return this.state.meta[key] ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    this.state.meta[key] = value;
    await this.flush();
  }

  private async flush(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
