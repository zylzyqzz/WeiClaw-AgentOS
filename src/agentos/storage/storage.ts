import type {
  MemoryQuery,
  MemoryRecord,
  OrchestratorConfig,
  PresetDefinition,
  RoleTemplate,
  RuntimeAgent,
  SessionState,
} from "../types.js";

export interface AgentOsStorage {
  init(): Promise<void>;
  close(): Promise<void>;

  upsertSession(state: SessionState): Promise<void>;
  getSession(sessionId: string): Promise<SessionState | null>;

  appendMemory(
    input: Omit<MemoryRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ): Promise<MemoryRecord>;
  listMemory(query: MemoryQuery): Promise<MemoryRecord[]>;

  upsertRoleTemplate(template: RoleTemplate): Promise<void>;
  getRoleTemplate(templateId: string): Promise<RoleTemplate | null>;
  listRoleTemplates(): Promise<RoleTemplate[]>;
  deleteRoleTemplate(templateId: string): Promise<void>;

  upsertRuntimeAgent(agent: RuntimeAgent): Promise<void>;
  getRuntimeAgent(agentId: string): Promise<RuntimeAgent | null>;
  listRuntimeAgents(): Promise<RuntimeAgent[]>;
  deleteRuntimeAgent(agentId: string): Promise<void>;

  upsertPreset(preset: PresetDefinition): Promise<void>;
  getPreset(presetId: string): Promise<PresetDefinition | null>;
  listPresets(): Promise<PresetDefinition[]>;
  deletePreset(presetId: string): Promise<void>;

  getRuntimeConfig(): Promise<Partial<OrchestratorConfig> | null>;
  setRuntimeConfig(config: Partial<OrchestratorConfig>): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}
