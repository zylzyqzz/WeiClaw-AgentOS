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

const ROUTE_PRIORITY_EXPLICIT = "priority: explicit roles (highest)";
const ROUTE_PRIORITY_PRESET = "priority: preset (second)";
const ROUTE_PRIORITY_DYNAMIC = "priority: dynamic route (fallback)";

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function missingRequiredCapabilities(
  selected: ResolvedRuntimeAgent[],
  required: AgentCapability[],
): AgentCapability[] {
  const covered = new Set(selected.flatMap((agent) => agent.effectiveCapabilities as string[]));
  return required.filter((cap) => !covered.has(cap));
}

function getPreset(config: OrchestratorConfig, presetId: string): PresetDefinition {
  return ensurePresetExists(config.presets, presetId);
}

function mergeRouteInputs(
  config: OrchestratorConfig,
  request: TaskRequest,
): {
  required: AgentCapability[];
  preferred: string[];
  excluded: string[];
  reasons: string[];
} {
  const reasons: string[] = [];
  const taskType = (request.taskType ?? "").trim();
  const rule = taskType ? config.routing.taskTypeRules[taskType] : undefined;

  const required = uniq([
    ...(rule?.requiredCapabilities ?? []),
    ...(request.requiredCapabilities ?? []),
  ]) as AgentCapability[];

  const preferred = uniq([...(rule?.preferredRoles ?? []), ...(request.preferredRoles ?? [])]);
  const excluded = uniq([...(rule?.excludedRoles ?? []), ...(request.excludedRoles ?? [])]);

  if (taskType && rule) {
    reasons.push(`taskType rule applied: ${taskType}`);
  }
  if (required.length > 0) {
    reasons.push(`requiredCapabilities: ${required.join(", ")}`);
  }
  if (preferred.length > 0) {
    reasons.push(`preferredRoles: ${preferred.join(", ")}`);
  }
  if (excluded.length > 0) {
    reasons.push(`excludedRoles: ${excluded.join(", ")}`);
  }

  return { required, preferred, excluded, reasons };
}

function scoreAgent(
  config: OrchestratorConfig,
  agent: ResolvedRuntimeAgent,
  request: TaskRequest,
  merged: ReturnType<typeof mergeRouteInputs>,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const caps = agent.effectiveCapabilities;

  if (merged.required.length > 0) {
    const matched = merged.required.filter((cap) => caps.includes(cap));
    if (matched.length > 0) {
      score += matched.length * config.routing.weights.requiredCapability;
      reasons.push(`matched requiredCapabilities: ${matched.join(",")}`);
    } else {
      reasons.push("no requiredCapabilities matched");
    }
  }

  if (merged.preferred.includes(agent.runtime.id)) {
    score += config.routing.weights.preferredRole;
    reasons.push("in preferredRoles");
  }

  if (merged.excluded.includes(agent.runtime.id)) {
    reasons.push("in excludedRoles");
    return { score: -1000, reasons };
  }

  const text = `${request.goal} ${request.taskType ?? ""}`.toLowerCase();
  for (const [capability, words] of Object.entries(config.routing.capabilityKeywords)) {
    if (
      words.some((w) => text.includes(w.toLowerCase())) &&
      caps.includes(capability as AgentCapability)
    ) {
      score += config.routing.weights.keywordMatch;
      reasons.push(`matched capability keywords: ${capability}`);
    }
  }

  const constraints = request.constraints ?? [];
  if (constraints.length > 0 && caps.includes("coordination")) {
    score += config.routing.weights.coordinationConstraint;
    reasons.push("coordination for constraints");
  }

  return { score, reasons: reasons.length > 0 ? reasons : ["fallback score"] };
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
          ROUTE_PRIORITY_EXPLICIT,
          `explicit roles requested: ${explicitRoles.join(", ")}`,
          `resolved roles: ${selected.map((x) => x.runtime.id).join(", ") || "none"}`,
        ],
      };
    }

    const shouldUsePreset = request.preset !== "";
    const presetId = request.preset ?? this.config.defaultPreset;
    if (shouldUsePreset && presetId) {
      const preset = getPreset(this.config, presetId);
      const roleIds = uniq(preset.order.length > 0 ? preset.order : preset.roles).filter(
        (id) => !(request.excludedRoles ?? []).includes(id),
      );
      const roleContexts = [] as Array<{
        id: string;
        enabled: boolean;
        capabilities: string[];
        outputContract: string;
        policy: {
          enabled: boolean;
          maxTurns: number;
          allowedTools: string[];
          deniedTools: string[];
          constraints: string[];
        };
      }>;
      for (const agentId of roleIds) {
        const inspected = await this.registry.inspectRuntimeAgent(agentId);
        if (!inspected) {
          continue;
        }
        roleContexts.push({
          id: inspected.runtime.id,
          enabled: inspected.runtime.enabled && inspected.template.enabled,
          capabilities: inspected.effectiveCapabilities,
          outputContract: inspected.template.outputContract,
          policy: inspected.effectivePolicy,
        });
      }
      const validation = validatePreset(preset, roleContexts);
      if (!validation.valid) {
        const first = validation.findings.find((x) => x.level === "error");
        throw new Error(`Invalid preset ${preset.id}: ${first?.message ?? "unknown error"}`);
      }

      const selected = await this.registry.resolveMany(roleIds);
      if (selected.length > 0) {
        return {
          routeSummary: `preset route (${preset.id})`,
          selected,
          reasons: [
            ROUTE_PRIORITY_PRESET,
            `preset selected: ${preset.id}`,
            `preset defaultPolicy.maxTurns: ${preset.defaultPolicy.maxTurns}`,
            `preset roles resolved: ${selected.map((x) => x.runtime.id).join(", ")}`,
          ],
        };
      }
    }

    const merged = mergeRouteInputs(this.config, request);
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
      const evaluated = scoreAgent(this.config, resolved, request, merged);
      if (evaluated.score > -1000) {
        scored.push({ resolved, score: evaluated.score, reasons: evaluated.reasons });
      }
    }

    const selected = scored
      .toSorted((a, b) => b.score - a.score)
      .slice(0, this.config.routing.maxDynamicRoles)
      .filter((x) => x.score > 0)
      .map((x) => x.resolved);

    if (merged.required.length > 0) {
      const missing = missingRequiredCapabilities(selected, merged.required);
      if (missing.length > 0) {
        return {
          routeSummary: "dynamic capability route",
          selected: [],
          reasons: [
            ROUTE_PRIORITY_DYNAMIC,
            ...merged.reasons,
            `missing requiredCapabilities coverage: ${missing.join(", ")}`,
          ],
        };
      }
    }

    const reasons = [
      ROUTE_PRIORITY_DYNAMIC,
      ...merged.reasons,
      ...scored
        .toSorted((a, b) => b.score - a.score)
        .slice(0, this.config.routing.maxDynamicRoles)
        .map((x) => `${x.resolved.runtime.id}: score=${x.score}; ${x.reasons.join("; ")}`),
    ];

    return {
      routeSummary: "dynamic capability route",
      selected,
      reasons,
    };
  }
}
