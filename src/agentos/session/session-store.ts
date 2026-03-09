import type { AgentOsStorage } from "../storage/storage.js";
import type { SessionState } from "../types.js";

export class SessionStore {
  constructor(private readonly storage: AgentOsStorage) {}

  async getOrCreate(sessionId: string): Promise<SessionState> {
    const current = await this.storage.getSession(sessionId);
    if (current) {
      return current;
    }
    const state: SessionState = {
      sessionId,
      status: "idle",
      updatedAt: new Date().toISOString(),
      meta: {},
    };
    await this.storage.upsertSession(state);
    return state;
  }

  async markRunning(sessionId: string, taskId: string): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "running",
      updatedAt: new Date().toISOString(),
    });
  }

  async markCompleted(sessionId: string, taskId: string): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  }

  async markFailed(sessionId: string, taskId: string, message: string): Promise<void> {
    const current = await this.getOrCreate(sessionId);
    const errs = Array.isArray(current.meta.errors) ? current.meta.errors : [];
    await this.storage.upsertSession({
      ...current,
      activeTaskId: taskId,
      status: "failed",
      updatedAt: new Date().toISOString(),
      meta: {
        ...current.meta,
        errors: [...errs, message],
      },
    });
  }
}
