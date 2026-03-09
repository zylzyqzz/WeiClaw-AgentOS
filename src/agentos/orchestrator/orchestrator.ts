import { randomUUID } from "node:crypto";
import { MemoryManager } from "../memory/memory-manager.js";
import { AgentRegistry, type ResolvedRuntimeAgent } from "../registry/agent-registry.js";
import { ensurePresetExists } from "../registry/preset-utils.js";
import { validatePreset } from "../registry/role-validation.js";
import { SessionStore } from "../session/session-store.js";
import type {
  AgentCapability,
  OrchestratorConfig,
  PresetDefinition,
  TaskRequest,
  TaskResult,
} from "../types.js";

interface RouteDecision {
  routeSummary: string;
  selected: ResolvedRuntimeAgent[];
  reasons: string[];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function includesAny<T extends string>(target: T[], wanted: T[]): boolean {
  return wanted.some((x) => target.includes(x));
}

function scoreAgent(
  agent: ResolvedRuntimeAgent,
  request: TaskRequest,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const caps = agent.effectiveCapabilities;
  const required = request.requiredCapabilities ?? [];

  if (required.length > 0) {
    if (required.every((cap) => caps.includes(cap))) {
      score += 6;
      reasons.push(`matches requiredCapabilities: ${required.join(",")}`);
    } else {
      reasons.push(`missing requiredCapabilities`);
      return { score: -1000, reasons };
    }
  }

  if ((request.preferredRoles ?? []).includes(agent.runtime.id)) {
    score += 3;
    reasons.push("in preferredRoles");
  }

  if ((request.excludedRoles ?? []).includes(agent.runtime.id)) {
    reasons.push("in excludedRoles");
    return { score: -1000, reasons };
  }

  const text = `${request.goal} ${request.taskType ?? ""}`.toLowerCase();
  const keywordMap: Array<{ words: string[]; caps: AgentCapability[]; label: string }> = [
    { words: ["plan", "strategy"], caps: ["planning"], label: "planning keywords" },
    { words: ["build", "implement", "code"], caps: ["build"], label: "build keywords" },
    { words: ["review", "risk"], caps: ["review"], label: "review keywords" },
    { words: ["test", "quality"], caps: ["qa"], label: "qa keywords" },
    { words: ["deploy", "ops"], caps: ["ops"], label: "ops keywords" },
    { words: ["research", "investigate"], caps: ["research"], label: "research keywords" },
  ];

  for (const rule of keywordMap) {
    if (rule.words.some((w) => text.includes(w)) && includesAny(caps, rule.caps)) {
      score += 2;
      reasons.push(`matched ${rule.label}`);
    }
  }

  const constraints = request.constraints ?? [];
  if (constraints.length > 0 && caps.includes("coordination")) {
    score += 1;
    reasons.push("coordination for constraints");
  }

  return { score, reasons: reasons.length > 0 ? reasons : ["fallback score"] };
}

function getPreset(config: OrchestratorConfig, presetId: string): PresetDefinition {
  return ensurePresetExists(config.presets, presetId);
}

export class Orchestrator {
  constructor(
    private readonly config: OrchestratorConfig,
    private readonly registry: AgentRegistry,
    private readonly sessions: SessionStore,
    private readonly memory: MemoryManager,
  ) {}

  async run(request: TaskRequest): Promise<TaskResult> {
    const taskId = randomUUID();
    await this.sessions.markRunning(request.sessionId, taskId);
    try {
      const route = await this.selectRoles(request);
      if (route.selected.length === 0) {
        throw new Error("No enabled runtime roles are available for this task route");
      }

      const roleOutputs = route.selected.map((agent, idx) => ({
        roleId: agent.runtime.id,
        output:
          `[${idx + 1}] ${agent.runtime.name}: ${agent.template.systemInstruction} ` +
          `Goal="${request.goal}" TaskType="${request.taskType ?? "general"}"`,
      }));

      const plan = roleOutputs.map((entry) => entry.output);
      const conclusion = `Task completed with dynamic roles: ${route.selected.map((x) => x.runtime.id).join(", ")}.`;
      const risks = [
        "Route quality depends on role metadata and capability definitions",
        "Role disablement or preset drift can reduce route coverage",
      ];
      const acceptance = [
        "Route generated from explicit roles, preset, or dynamic scoring",
        "Result includes routeSummary, selectedRoles, selectionReasons",
        "Memory persisted across short-term, long-term, and project/entity",
      ];

      const result: TaskResult = {
        requestId: taskId,
        sessionId: request.sessionId,
        routeSummary: route.routeSummary,
        selectedRoles: route.selected.map((x) => x.runtime.id),
        selectionReasons: route.reasons,
        conclusion,
        plan,
        risks,
        acceptance,
        roleOutputs,
      };

      await this.memory.captureRun(request.sessionId, request.goal, conclusion, taskId);
      await this.sessions.markCompleted(request.sessionId, taskId);
      return result;
    } catch (err) {
      await this.sessions.markFailed(
        request.sessionId,
        taskId,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }
  }

  private async selectRoles(request: TaskRequest): Promise<RouteDecision> {
    const explicitRoles = uniq(request.roles ?? []);
    if (explicitRoles.length > 0) {
      const selected = await this.registry.resolveMany(explicitRoles);
      return {
        routeSummary: "explicit roles route",
        selected,
        reasons: [
          `explicit roles requested: ${explicitRoles.join(", ")}`,
          `resolved roles: ${selected.map((x) => x.runtime.id).join(", ") || "none"}`,
        ],
      };
    }

    const shouldUsePreset = request.preset !== "";
    const presetId = request.preset ?? this.config.defaultPreset;
    if (shouldUsePreset && presetId) {
      const preset = getPreset(this.config, presetId);
      const roleIds = uniq(preset.roleOrder).filter(
        (id) => !(request.excludedRoles ?? []).includes(id),
      );
      const existingIds = (await this.registry.listRuntimeAgents()).map((x) => x.id);
      const validation = validatePreset(preset, existingIds);
      if (!validation.valid) {
        const first = validation.issues.find((x) => x.level === "error");
        throw new Error(`Invalid preset ${preset.id}: ${first?.message ?? "unknown error"}`);
      }

      const selected = await this.registry.resolveMany(roleIds);
      if (selected.length > 0) {
        return {
          routeSummary: `preset route (${preset.id})`,
          selected,
          reasons: [
            `preset selected: ${preset.id}`,
            `preset strategy: ${preset.defaultStrategy}`,
            `preset roles resolved: ${selected.map((x) => x.runtime.id).join(", ")}`,
          ],
        };
      }
    }

    const all = await this.registry.listRuntimeAgents();
    const scored: Array<{ resolved: ResolvedRuntimeAgent; score: number; reasons: string[] }> = [];
    for (const role of all) {
      const resolved = await this.registry.inspectRuntimeAgent(role.id);
      if (
        !resolved ||
        !resolved.runtime.enabled ||
        !resolved.template.enabled ||
        !resolved.effectivePolicy.enabled
      ) {
        continue;
      }
      const evaluated = scoreAgent(resolved, request);
      if (evaluated.score > -1000) {
        scored.push({ resolved, score: evaluated.score, reasons: evaluated.reasons });
      }
    }

    const selected = scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, 4)
      .filter((x) => x.score > 0)
      .map((x) => x.resolved);

    const reasons = scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => `${x.resolved.runtime.id}: score=${x.score}; ${x.reasons.join("; ")}`);

    return {
      routeSummary: "dynamic capability route",
      selected,
      reasons,
    };
  }
}
