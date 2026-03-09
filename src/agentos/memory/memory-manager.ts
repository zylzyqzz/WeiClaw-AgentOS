import type { AgentOsStorage } from "../storage/storage.js";
import type { MemoryLayer, MemoryRecord } from "../types.js";

export class MemoryManager {
  constructor(private readonly storage: AgentOsStorage) {}

  async write(
    sessionId: string,
    layer: MemoryLayer,
    scope: string,
    content: string,
    sourceTaskId?: string,
    summary?: string,
  ): Promise<MemoryRecord> {
    return this.storage.appendMemory({
      sessionId,
      layer,
      scope,
      content,
      sourceTaskId,
      summary,
    });
  }

  async captureRun(
    sessionId: string,
    goal: string,
    conclusion: string,
    taskId: string,
  ): Promise<void> {
    await this.write(sessionId, "short-term", `session:${sessionId}`, goal, taskId);
    await this.write(sessionId, "long-term", "long-term:summary", conclusion, taskId, conclusion);
    await this.write(
      sessionId,
      "project-entity",
      "entity:delivery",
      `Task ${taskId} completed with conclusion: ${conclusion}`,
      taskId,
    );
  }

  async inspect(sessionId: string, limit = 20): Promise<MemoryRecord[]> {
    return this.storage.listMemory({ sessionId, limit });
  }

  async inspectByLayer(sessionId: string, layer: MemoryLayer, limit = 20): Promise<MemoryRecord[]> {
    return this.storage.listMemory({ sessionId, layer, limit });
  }
}
