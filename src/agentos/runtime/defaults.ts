import type { AgentMemoryScope, PresetDefinition, RoleTemplate, RuntimeAgent } from "../types.js";

const nowIso = () => new Date().toISOString();

function basePolicy() {
  return {
    enabled: true,
    maxTurns: 6,
    allowedTools: [],
    deniedTools: [],
    constraints: [],
  };
}

function baseMemoryScope(): AgentMemoryScope {
  return {
    layers: ["short-term", "long-term", "project-entity"],
    scopes: ["session:*", "entity:*"],
    crossSessionRead: false,
  };
}

function template(
  id: string,
  name: string,
  description: string,
  goals: string[],
  systemInstruction: string,
  capabilities: string[],
): RoleTemplate {
  const ts = nowIso();
  return {
    id,
    name,
    description,
    goals,
    systemInstruction,
    inputContract: "task goal + constraints + context",
    outputContract: "structured role output",
    capabilities,
    policy: basePolicy(),
    memoryScope: baseMemoryScope(),
    enabled: true,
    version: "1.0.0",
    tags: ["demo", "preset"],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function defaultDemoRoleTemplates(): RoleTemplate[] {
  return [
    template(
      "commander-template",
      "Commander",
      "Coordinate final synthesis and decision.",
      ["Deliver final conclusion and acceptance"],
      "Synthesize all role outputs and return clear final direction.",
      ["coordination", "planning"],
    ),
    template(
      "planner-template",
      "Planner",
      "Break the goal into executable steps.",
      ["Produce clear execution plan"],
      "Translate goals and constraints into ordered actionable steps.",
      ["planning", "research"],
    ),
    template(
      "builder-template",
      "Builder",
      "Produce implementation strategy and actions.",
      ["Deliver runnable implementation path"],
      "Favor minimal runnable increments and concrete actions.",
      ["build", "ops"],
    ),
    template(
      "reviewer-template",
      "Reviewer",
      "Assess risks and acceptance quality.",
      ["Reduce regressions and hidden risk"],
      "Review output for risks, edge cases, and missing acceptance checks.",
      ["review", "qa"],
    ),
  ];
}

function runtimeAgent(
  id: string,
  templateId: string,
  name: string,
  description: string,
  capabilities: string[],
): RuntimeAgent {
  const ts = nowIso();
  return {
    id,
    templateId,
    name,
    description,
    capabilities,
    policy: basePolicy(),
    memoryScope: baseMemoryScope(),
    enabled: true,
    version: "1.0.0",
    tags: ["demo", "preset"],
    createdAt: ts,
    updatedAt: ts,
  };
}

export function defaultDemoRuntimeAgents(): RuntimeAgent[] {
  return [
    runtimeAgent(
      "commander",
      "commander-template",
      "Commander",
      "Demo coordinator runtime instance",
      ["coordination", "planning"],
    ),
    runtimeAgent("planner", "planner-template", "Planner", "Demo planning runtime instance", [
      "planning",
      "research",
    ]),
    runtimeAgent("builder", "builder-template", "Builder", "Demo implementation runtime instance", [
      "build",
      "ops",
    ]),
    runtimeAgent("reviewer", "reviewer-template", "Reviewer", "Demo review runtime instance", [
      "review",
      "qa",
    ]),
  ];
}

export function defaultDemoPresets(): Record<string, PresetDefinition> {
  const ts = nowIso();
  return {
    "default-demo": {
      id: "default-demo",
      name: "Default Demo Preset",
      description:
        "Sample preset for local alpha. Uses commander/planner/builder/reviewer as a demo combination only.",
      roles: ["commander", "planner", "builder", "reviewer"],
      order: ["commander", "planner", "builder", "reviewer"],
      defaultPolicy: {
        enabled: true,
        maxTurns: 6,
        allowedTools: [],
        deniedTools: [],
        constraints: [],
      },
      taskTypes: ["general", "build", "review"],
      tags: ["demo", "default"],
      enabled: true,
      version: "1.0.0",
      createdAt: ts,
      updatedAt: ts,
    },
  };
}
