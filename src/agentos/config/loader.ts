import path from "node:path";
import { defaultDemoPresets } from "../runtime/defaults.js";
import type { OrchestratorConfig } from "../types.js";

export function defaultOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  const dataDir = path.join(cwd, ".weiclaw-agentos");
  return {
    storagePath: path.join(dataDir, "agentos.db"),
    fallbackPath: path.join(dataDir, "agentos.fallback.json"),
    defaultSessionId: "local-main",
    projectName: "WeiClaw-AgentOS",
    logLevel: "info",
    defaultPreset: "default-demo",
    presets: defaultDemoPresets(),
    routing: {
      taskTypeRules: {
        build: { requiredCapabilities: ["build"], preferredRoles: ["builder"] },
        review: { requiredCapabilities: ["review"], preferredRoles: ["reviewer"] },
        research: { requiredCapabilities: ["research"], preferredRoles: ["planner"] },
        qa: { requiredCapabilities: ["qa"], preferredRoles: ["reviewer"] },
      },
      capabilityKeywords: {
        planning: ["plan", "strategy"],
        build: ["build", "implement", "code"],
        review: ["review", "risk"],
        qa: ["test", "quality"],
        ops: ["deploy", "ops"],
        research: ["research", "investigate"],
      },
      weights: {
        requiredCapability: 6,
        preferredRole: 3,
        keywordMatch: 2,
        coordinationConstraint: 1,
      },
      maxDynamicRoles: 4,
    },
  };
}

export function loadOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  return defaultOrchestratorConfig(cwd);
}
