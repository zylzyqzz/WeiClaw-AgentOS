import type { OrchestratorConfig } from "../types.js";
import { FileAgentOsStorage } from "./file-storage.js";
import type { AgentOsStorage } from "./storage.js";

export async function createAgentOsStorage(config: OrchestratorConfig): Promise<AgentOsStorage> {
  const disableSqlite = process.env.OPENCLAW_AGENTOS_DISABLE_SQLITE === "1";
  if (!disableSqlite) {
    const { SqliteAgentOsStorage } = await import("./sqlite-storage.js");
    const sqlite = new SqliteAgentOsStorage(config.storagePath);
    try {
      await sqlite.init();
      return sqlite;
    } catch (err) {
      console.warn(
        `[agentos] SQLite init failed (${err instanceof Error ? err.message : String(err)}), using file fallback`,
      );
    }
  }

  const file = new FileAgentOsStorage(config.fallbackPath);
  await file.init();
  return file;
}
