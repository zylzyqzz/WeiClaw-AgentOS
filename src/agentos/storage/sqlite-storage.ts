import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  MemoryRecord,
  OrchestratorConfig,
  PresetDefinition,
  RoleTemplate,
  RuntimeAgent,
  SessionState,
} from "../types.js";
import type { AgentOsStorage } from "./storage.js";

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export class SqliteAgentOsStorage implements AgentOsStorage {
  private db: DatabaseSync | null = null;

  constructor(private readonly dbPath: string) {}

  async init(): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 3000;

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        active_task_id TEXT,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        meta_json TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS memory_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        layer TEXT NOT NULL,
        scope TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        source_task_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_templates (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runtime_agents (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS presets (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS config_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meta_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memory_session_created
      ON memory_records (session_id, created_at DESC);
    `);
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  async upsertSession(state: SessionState): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO sessions (session_id, active_task_id, status, updated_at, meta_json)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          active_task_id = excluded.active_task_id,
          status = excluded.status,
          updated_at = excluded.updated_at,
          meta_json = excluded.meta_json
      `)
      .run(
        state.sessionId,
        state.activeTaskId ?? null,
        state.status,
        state.updatedAt,
        JSON.stringify(state.meta ?? {}),
      );
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db
      .prepare(
        `SELECT session_id, active_task_id, status, updated_at, meta_json FROM sessions WHERE session_id = ?`,
      )
      .get(sessionId) as
      | {
          session_id: string;
          active_task_id: string | null;
          status: SessionState["status"];
          updated_at: string;
          meta_json: string;
        }
      | undefined;
    if (!row) {
      return null;
    }
    return {
      sessionId,
      activeTaskId: row.active_task_id ?? undefined,
      status: row.status,
      updatedAt: row.updated_at,
      meta: parseJson<Record<string, unknown>>(row.meta_json),
    };
  }

  async appendMemory(
    input: Omit<MemoryRecord, "id" | "createdAt"> & { id?: string; createdAt?: string },
  ): Promise<MemoryRecord> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
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
    this.db
      .prepare(`
        INSERT INTO memory_records
        (id, session_id, layer, scope, content, summary, source_task_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        record.id,
        record.sessionId,
        record.layer,
        record.scope,
        record.content,
        record.summary ?? null,
        record.sourceTaskId ?? null,
        record.createdAt,
      );
    return record;
  }

  async listMemory(query: {
    sessionId?: string;
    layer?: string;
    scope?: string;
    limit?: number;
  }): Promise<MemoryRecord[]> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const where: string[] = [];
    const args: Array<string | number> = [];
    if (query.sessionId) {
      where.push("session_id = ?");
      args.push(query.sessionId);
    }
    if (query.layer) {
      where.push("layer = ?");
      args.push(query.layer);
    }
    if (query.scope) {
      where.push("scope = ?");
      args.push(query.scope);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Math.max(1, query.limit ?? 50);
    const rows = this.db
      .prepare(`
        SELECT id, session_id, layer, scope, content, summary, source_task_id, created_at
        FROM memory_records ${whereSql}
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(...args, limit) as Array<{
      id: string;
      session_id: string;
      layer: MemoryRecord["layer"];
      scope: string;
      content: string;
      summary: string | null;
      source_task_id: string | null;
      created_at: string;
    }>;
    return rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      layer: row.layer,
      scope: row.scope,
      content: row.content,
      summary: row.summary ?? undefined,
      sourceTaskId: row.source_task_id ?? undefined,
      createdAt: row.created_at,
    }));
  }

  async upsertRoleTemplate(template: RoleTemplate): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO role_templates (id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `)
      .run(template.id, JSON.stringify(template), template.updatedAt);
  }

  async getRoleTemplate(templateId: string): Promise<RoleTemplate | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db
      .prepare(`SELECT payload_json FROM role_templates WHERE id = ?`)
      .get(templateId) as { payload_json: string } | undefined;
    return row ? parseJson<RoleTemplate>(row.payload_json) : null;
  }

  async listRoleTemplates(): Promise<RoleTemplate[]> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const rows = this.db
      .prepare(`SELECT payload_json FROM role_templates ORDER BY id ASC`)
      .all() as Array<{
      payload_json: string;
    }>;
    return rows.map((row) => parseJson<RoleTemplate>(row.payload_json));
  }

  async deleteRoleTemplate(templateId: string): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db.prepare(`DELETE FROM role_templates WHERE id = ?`).run(templateId);
  }

  async upsertRuntimeAgent(agent: RuntimeAgent): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO runtime_agents (id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `)
      .run(agent.id, JSON.stringify(agent), agent.updatedAt);
  }

  async getRuntimeAgent(agentId: string): Promise<RuntimeAgent | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db
      .prepare(`SELECT payload_json FROM runtime_agents WHERE id = ?`)
      .get(agentId) as { payload_json: string } | undefined;
    return row ? parseJson<RuntimeAgent>(row.payload_json) : null;
  }

  async listRuntimeAgents(): Promise<RuntimeAgent[]> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const rows = this.db
      .prepare(`SELECT payload_json FROM runtime_agents ORDER BY id ASC`)
      .all() as Array<{
      payload_json: string;
    }>;
    return rows.map((row) => parseJson<RuntimeAgent>(row.payload_json));
  }

  async deleteRuntimeAgent(agentId: string): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db.prepare(`DELETE FROM runtime_agents WHERE id = ?`).run(agentId);
  }

  async upsertPreset(preset: PresetDefinition): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO presets (id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `)
      .run(preset.id, JSON.stringify(preset), preset.updatedAt);
  }

  async getPreset(presetId: string): Promise<PresetDefinition | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db.prepare(`SELECT payload_json FROM presets WHERE id = ?`).get(presetId) as
      | { payload_json: string }
      | undefined;
    return row ? parseJson<PresetDefinition>(row.payload_json) : null;
  }

  async listPresets(): Promise<PresetDefinition[]> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const rows = this.db
      .prepare(`SELECT payload_json FROM presets ORDER BY id ASC`)
      .all() as Array<{
      payload_json: string;
    }>;
    return rows.map((row) => parseJson<PresetDefinition>(row.payload_json));
  }

  async deletePreset(presetId: string): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db.prepare(`DELETE FROM presets WHERE id = ?`).run(presetId);
  }

  async getRuntimeConfig(): Promise<Partial<OrchestratorConfig> | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db
      .prepare(`SELECT value_json FROM config_state WHERE key = 'runtime_config'`)
      .get() as { value_json: string } | undefined;
    return row ? parseJson<Partial<OrchestratorConfig>>(row.value_json) : null;
  }

  async setRuntimeConfig(config: Partial<OrchestratorConfig>): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO config_state (key, value_json, updated_at)
        VALUES ('runtime_config', ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `)
      .run(JSON.stringify(config), new Date().toISOString());
  }

  async getMeta(key: string): Promise<string | null> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    const row = this.db.prepare(`SELECT value FROM meta_state WHERE key = ?`).get(key) as
      | { value: string }
      | undefined;
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    if (!this.db) {
      throw new Error("Storage not initialized");
    }
    this.db
      .prepare(`
        INSERT INTO meta_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .run(key, value, new Date().toISOString());
  }
}
