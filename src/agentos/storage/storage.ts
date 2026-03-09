import type {
  MemoryQuery,
  MemoryRecord,
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
}
