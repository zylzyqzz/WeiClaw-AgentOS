import type { OrchestratorConfig } from "../types.js";
import { FileAgentOsStorage } from "./file-storage.js";
import { SqliteAgentOsStorage } from "./sqlite-storage.js";
import type { AgentOsStorage } from "./storage.js";

export async function createAgentOsStorage(config: OrchestratorConfig): Promise<AgentOsStorage> {
  const sqlite = new SqliteAgentOsStorage(config.storagePath);
  try {
    await sqlite.init();
    return sqlite;
  } catch (err) {
    console.warn(
      `[agentos] SQLite init failed (${err instanceof Error ? err.message : String(err)}), using file fallback`,
    );
    const file = new FileAgentOsStorage(config.fallbackPath);
    await file.init();
    return file;
  }
}
