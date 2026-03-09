import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defaultDemoPresets } from "../runtime/defaults.js";
import type { OrchestratorConfig, PresetDefinition } from "../types.js";

const CONFIG_FILE = ".weiclaw-agentos.json";

function normalizePresets(
  input?: Record<string, PresetDefinition> | Record<string, string[]>,
): Record<string, PresetDefinition> {
  const base = defaultDemoPresets();
  if (!input) {
    return base;
  }

  const output: Record<string, PresetDefinition> = { ...base };
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      const ts = new Date().toISOString();
      output[key] = {
        id: key,
        name: key,
        description: "Migrated from legacy preset role list",
        roles: value,
        order: value,
        defaultPolicy: {
          enabled: true,
          maxTurns: 6,
          allowedTools: [],
          deniedTools: [],
          constraints: [],
        },
        taskTypes: ["general"],
        tags: ["migrated"],
        enabled: true,
        version: "1.0.0",
        createdAt: ts,
        updatedAt: ts,
      };
    } else {
      output[key] = value;
    }
  }
  return output;
}

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
  };
}

export function loadOrchestratorConfig(cwd = process.cwd()): OrchestratorConfig {
  const base = defaultOrchestratorConfig(cwd);
  const configPath = path.join(cwd, CONFIG_FILE);
  if (!existsSync(configPath)) {
    return base;
  }
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<OrchestratorConfig> & {
      presets?: Record<string, PresetDefinition> | Record<string, string[]>;
    };
    return {
      ...base,
      ...parsed,
      presets: normalizePresets(parsed.presets),
    };
  } catch (err) {
    throw new Error(
      `Failed to parse ${CONFIG_FILE}: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
}
