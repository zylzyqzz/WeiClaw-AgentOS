#!/usr/bin/env node
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { inspectPreset, listPresets } from "../agentos/registry/preset-utils.js";
import { readRoleBundleJson, writeRoleBundleJson } from "../agentos/registry/role-io.js";
import { validateRoleBundle } from "../agentos/registry/role-validation.js";
import { createAgentOsRuntime } from "../agentos/runtime/create-runtime.js";
import type {
  AgentCapability,
  AgentPolicy,
  AgentMemoryScope,
  RoleBundle,
  RoleTemplate,
  RuntimeAgent,
} from "../agentos/types.js";

const argv = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));

function getArg(name: string): string | undefined {
  const index = argv.findIndex((arg) => arg === `--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function getCsv(name: string): string[] {
  const raw = getArg(name);
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseBool(name: string, fallback: boolean): boolean {
  const raw = getArg(name);
  if (!raw) {
    return fallback;
  }
  return raw === "true";
}

function parseIntSafe(name: string, fallback: number): number {
  const n = Number(getArg(name) ?? String(fallback));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function buildPolicy(defaultEnabled = true): AgentPolicy {
  return {
    enabled: parseBool("policy-enabled", defaultEnabled),
    maxTurns: parseIntSafe("max-turns", 6),
    allowedTools: getCsv("allowed-tools"),
    deniedTools: getCsv("denied-tools"),
    constraints: getCsv("constraints"),
  };
}

function buildMemoryScope(): AgentMemoryScope {
  const layers = getCsv("memory-layers") as Array<"short-term" | "long-term" | "project-entity">;
  return {
    layers: layers.length > 0 ? layers : ["short-term", "long-term", "project-entity"],
    scopes:
      getCsv("memory-scopes").length > 0 ? getCsv("memory-scopes") : ["session:*", "entity:*"],
    crossSessionRead: parseBool("cross-session-read", false),
  };
}

function buildRoleTemplate(roleId: string): RoleTemplate {
  const ts = nowIso();
  const capabilities = getCsv("capabilities") as AgentCapability[];
  return {
    id: `${roleId}-template`,
    name: getArg("name") ?? roleId,
    description: getArg("description") ?? `Runtime role template ${roleId}`,
    goals: getCsv("goals").length > 0 ? getCsv("goals") : ["deliver actionable output"],
    systemInstruction:
      getArg("system-instruction") ??
      "Analyze the task and provide a concise, structured output aligned with role goals.",
    inputContract: getArg("input-contract") ?? "task goal + constraints + context",
    outputContract: getArg("output-contract") ?? "conclusion + plan + risks + acceptance",
    capabilities: capabilities.length > 0 ? capabilities : ["planning"],
    policy: buildPolicy(true),
    memoryScope: buildMemoryScope(),
    enabled: parseBool("template-enabled", true),
    version: getArg("version") ?? "1.0.0",
    tags: getCsv("tags"),
    createdAt: ts,
    updatedAt: ts,
  };
}

function buildRuntimeAgent(roleId: string, template: RoleTemplate): RuntimeAgent {
  const ts = nowIso();
  const capabilities = getCsv("capabilities") as AgentCapability[];
  return {
    id: roleId,
    templateId: template.id,
    name: getArg("runtime-name") ?? template.name,
    description: getArg("runtime-description") ?? template.description,
    capabilities: capabilities.length > 0 ? capabilities : template.capabilities,
    policy: buildPolicy(true),
    memoryScope: buildMemoryScope(),
    enabled: parseBool("enabled", true),
    version: getArg("runtime-version") ?? template.version,
    tags: getCsv("runtime-tags").length > 0 ? getCsv("runtime-tags") : template.tags,
    createdAt: ts,
    updatedAt: ts,
  };
}

async function runCommand() {
  const goal = getArg("goal");
  if (!goal) {
    throw new Error('Missing goal. Use: run --goal "..."');
  }
  const sessionId = getArg("session") ?? "local-main";
  const runtime = await createAgentOsRuntime();
  try {
    const result = await runtime.orchestrator.run({
      sessionId,
      goal,
      taskType: getArg("task-type"),
      constraints: getCsv("constraints"),
      roles: getCsv("roles").length > 0 ? getCsv("roles") : undefined,
      preset: getArg("preset"),
      requiredCapabilities: getCsv("required-capabilities") as AgentCapability[],
      preferredRoles: getCsv("preferred-roles"),
      excludedRoles: getCsv("excluded-roles"),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await runtime.storage.close();
  }
}

async function chatCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "local-main";
  const roleList = getCsv("roles");
  const preset = getArg("preset");
  const rl = readline.createInterface({ input, output });
  console.log("WeiClaw-AgentOS chat mode. Type 'exit' to quit.");
  try {
    while (true) {
      const line = (await rl.question("> ")).trim();
      if (line === "exit") {
        break;
      }
      if (!line) {
        continue;
      }
      const result = await runtime.orchestrator.run({
        sessionId,
        goal: line,
        roles: roleList.length > 0 ? roleList : undefined,
        preset,
      });
      console.log(`routeSummary: ${result.routeSummary}`);
      console.log(`selectedRoles: ${result.selectedRoles.join(",")}`);
      console.log(`selectionReasons: ${result.selectionReasons.join(" | ")}`);
      console.log(`conclusion: ${result.conclusion}`);
    }
  } finally {
    rl.close();
    await runtime.storage.close();
  }
}

async function inspectMemoryCommand() {
  const runtime = await createAgentOsRuntime();
  const sessionId = getArg("session") ?? "local-main";
  const layer = getArg("layer") as "short-term" | "long-term" | "project-entity" | undefined;
  try {
    const rows = layer
      ? await runtime.memory.inspectByLayer(sessionId, layer, 50)
      : await runtime.memory.inspect(sessionId, 50);
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await runtime.storage.close();
  }
}

async function listRolesCommand() {
  const runtime = await createAgentOsRuntime();
  try {
    const agents = await runtime.registry.listRuntimeAgents();
    const rows = [] as Array<Record<string, string | boolean | number>>;
    for (const agent of agents) {
      const resolved = await runtime.registry.inspectRuntimeAgent(agent.id);
      rows.push({
        id: agent.id,
        name: agent.name,
        templateId: agent.templateId,
        enabled: agent.enabled,
        version: agent.version,
        capabilities: (resolved?.effectiveCapabilities ?? []).join(","),
        maxTurns: resolved?.effectivePolicy.maxTurns ?? 0,
      });
    }
    console.table(rows);
  } finally {
    await runtime.storage.close();
  }
}

async function inspectRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: inspect-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const role = await runtime.registry.inspectRuntimeAgent(roleId);
    if (!role) {
      throw new Error(`RuntimeAgent not found: ${roleId}`);
    }
    console.log(JSON.stringify(role, null, 2));
  } finally {
    await runtime.storage.close();
  }
}

async function createRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: create-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const template = buildRoleTemplate(roleId);
    const runtimeAgent = buildRuntimeAgent(roleId, template);
    const bundle: RoleBundle = { template, runtime: runtimeAgent };
    const validation = validateRoleBundle(bundle);
    if (!validation.valid) {
      throw new Error(
        `Role validation failed: ${validation.issues.map((x) => `${x.field}=${x.message}`).join("; ")}`,
      );
    }
    await runtime.registry.importRoleBundle(bundle, false);
    console.log(`Role created: ${roleId}`);
  } finally {
    await runtime.storage.close();
  }
}

async function updateRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: update-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const inspected = await runtime.registry.inspectRuntimeAgent(roleId);
    if (!inspected) {
      throw new Error(`RuntimeAgent not found: ${roleId}`);
    }

    const templatePatch: Partial<RoleTemplate> = {};
    const runtimePatch: Partial<RuntimeAgent> = {};

    if (getArg("name")) {
      templatePatch.name = getArg("name");
    }
    if (getArg("description")) {
      templatePatch.description = getArg("description");
    }
    if (getArg("system-instruction")) {
      templatePatch.systemInstruction = getArg("system-instruction");
    }
    if (getArg("input-contract")) {
      templatePatch.inputContract = getArg("input-contract");
    }
    if (getArg("output-contract")) {
      templatePatch.outputContract = getArg("output-contract");
    }
    if (getArg("version")) {
      templatePatch.version = getArg("version");
    }
    if (getCsv("goals").length > 0) {
      templatePatch.goals = getCsv("goals");
    }
    if (getCsv("tags").length > 0) {
      templatePatch.tags = getCsv("tags");
    }
    if (getCsv("capabilities").length > 0) {
      templatePatch.capabilities = getCsv("capabilities") as AgentCapability[];
    }

    if (getArg("runtime-name")) {
      runtimePatch.name = getArg("runtime-name");
    }
    if (getArg("runtime-description")) {
      runtimePatch.description = getArg("runtime-description");
    }
    if (getArg("runtime-version")) {
      runtimePatch.version = getArg("runtime-version");
    }
    if (getArg("enabled")) {
      runtimePatch.enabled = parseBool("enabled", inspected.runtime.enabled);
    }
    if (getCsv("runtime-tags").length > 0) {
      runtimePatch.tags = getCsv("runtime-tags");
    }
    if (getCsv("capabilities").length > 0) {
      runtimePatch.capabilities = getCsv("capabilities") as AgentCapability[];
    }

    if (Object.keys(templatePatch).length > 0) {
      await runtime.registry.updateTemplate(inspected.template.id, templatePatch);
    }
    if (Object.keys(runtimePatch).length > 0) {
      await runtime.registry.updateRuntimeAgent(roleId, runtimePatch);
    }

    const updated = await runtime.registry.exportRoleBundle(roleId);
    const validation = validateRoleBundle(updated);
    if (!validation.valid) {
      throw new Error(
        `Updated role invalid: ${validation.issues.map((x) => `${x.field}=${x.message}`).join("; ")}`,
      );
    }

    console.log(`Role updated: ${roleId}`);
  } finally {
    await runtime.storage.close();
  }
}

async function deleteRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: delete-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const bundle = await runtime.registry.exportRoleBundle(roleId);
    await runtime.registry.deleteRuntimeAgent(roleId, runtime.config.presets);
    await runtime.registry.deleteTemplate(bundle.template.id);
    console.log(`Role deleted: ${roleId}`);
  } finally {
    await runtime.storage.close();
  }
}

async function disableRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: disable-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.disableRuntimeAgent(roleId);
    console.log(`Role disabled: ${roleId}`);
  } finally {
    await runtime.storage.close();
  }
}

async function enableRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  if (!roleId) {
    throw new Error("Missing role id. Use: enable-role --id <roleId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.enableRuntimeAgent(roleId);
    console.log(`Role enabled: ${roleId}`);
  } finally {
    await runtime.storage.close();
  }
}

async function exportRoleCommand() {
  const roleId = getArg("id") ?? argv[1];
  const file = getArg("file");
  if (!roleId || !file) {
    throw new Error("Usage: export-role --id <roleId> --file <path.json>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const bundle = await runtime.registry.exportRoleBundle(roleId);
    await writeRoleBundleJson(file, bundle);
    console.log(`Role exported: ${roleId} -> ${file}`);
  } finally {
    await runtime.storage.close();
  }
}

async function importRoleCommand() {
  const file = getArg("file");
  if (!file) {
    throw new Error("Usage: import-role --file <path.json> [--overwrite true|false]");
  }
  const overwrite = parseBool("overwrite", false);
  const bundle = await readRoleBundleJson(file);
  const validation = validateRoleBundle(bundle);
  if (!validation.valid) {
    throw new Error(
      `Role import validation failed: ${validation.issues.map((x) => `${x.field}=${x.message}`).join("; ")}`,
    );
  }

  const runtime = await createAgentOsRuntime();
  try {
    await runtime.registry.importRoleBundle(bundle, overwrite);
    console.log(`Role imported: ${bundle.runtime.id}`);
  } finally {
    await runtime.storage.close();
  }
}

async function validateRoleCommand() {
  const roleId = getArg("id");
  const file = getArg("file");

  let bundle: RoleBundle;
  if (file) {
    bundle = await readRoleBundleJson(file);
  } else if (roleId) {
    const runtime = await createAgentOsRuntime();
    try {
      bundle = await runtime.registry.exportRoleBundle(roleId);
    } finally {
      await runtime.storage.close();
    }
  } else {
    throw new Error("Usage: validate-role --id <roleId> | --file <path.json>");
  }

  const validation = validateRoleBundle(bundle);
  console.log(JSON.stringify(validation, null, 2));
  if (!validation.valid) {
    process.exitCode = 1;
  }
}

async function listPresetsCommand() {
  const runtime = await createAgentOsRuntime();
  try {
    console.table(
      listPresets(runtime.config.presets).map((preset) => ({
        id: preset.id,
        name: preset.name,
        enabled: preset.enabled,
        roles: preset.roleOrder.join(","),
        taskTypes: preset.taskTypes.join(","),
      })),
    );
  } finally {
    await runtime.storage.close();
  }
}

async function inspectPresetCommand() {
  const id = getArg("id") ?? argv[1];
  if (!id) {
    throw new Error("Missing preset id. Use: inspect-preset --id <presetId>");
  }
  const runtime = await createAgentOsRuntime();
  try {
    const preset = inspectPreset(runtime.config.presets, id);
    if (!preset) {
      throw new Error(`Preset not found: ${id}`);
    }
    console.log(JSON.stringify(preset, null, 2));
  } finally {
    await runtime.storage.close();
  }
}

async function listAgentsAliasCommand() {
  await listRolesCommand();
}

async function main() {
  const command = argv[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(
      [
        "Usage: node --import tsx src/cli/agentos.ts <command> [options]",
        "Commands:",
        "  run --goal <text> [--roles a,b] [--preset <id>] [--required-capabilities a,b] [--preferred-roles a,b] [--excluded-roles a,b]",
        "  chat [--roles a,b] [--preset <id>]",
        "  list-roles",
        "  inspect-role --id <roleId>",
        "  create-role --id <roleId> [--name <name>] [--system-instruction <text>] [--capabilities a,b]",
        "  update-role --id <roleId> [patch fields]",
        "  disable-role --id <roleId>",
        "  enable-role --id <roleId>",
        "  delete-role --id <roleId>",
        "  export-role --id <roleId> --file <path.json>",
        "  import-role --file <path.json> [--overwrite true|false]",
        "  validate-role --id <roleId> | --file <path.json>",
        "  list-presets",
        "  inspect-preset --id <presetId>",
        "  inspect-memory [--session <id>] [--layer short-term|long-term|project-entity]",
        "  list-agents (compat alias of list-roles)",
      ].join("\n"),
    );
    return;
  }

  switch (command) {
    case "run":
      await runCommand();
      return;
    case "chat":
      await chatCommand();
      return;
    case "inspect-memory":
      await inspectMemoryCommand();
      return;
    case "list-roles":
      await listRolesCommand();
      return;
    case "inspect-role":
      await inspectRoleCommand();
      return;
    case "create-role":
      await createRoleCommand();
      return;
    case "update-role":
      await updateRoleCommand();
      return;
    case "disable-role":
      await disableRoleCommand();
      return;
    case "enable-role":
      await enableRoleCommand();
      return;
    case "delete-role":
      await deleteRoleCommand();
      return;
    case "export-role":
      await exportRoleCommand();
      return;
    case "import-role":
      await importRoleCommand();
      return;
    case "validate-role":
      await validateRoleCommand();
      return;
    case "list-presets":
      await listPresetsCommand();
      return;
    case "inspect-preset":
      await inspectPresetCommand();
      return;
    case "list-agents":
      await listAgentsAliasCommand();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((err) => {
  console.error(`[agentos] ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
