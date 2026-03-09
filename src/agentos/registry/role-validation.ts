import type {
  AgentPolicy,
  LintFinding,
  LintResult,
  PresetDefinition,
  RoleBundle,
  RuntimeAgent,
} from "../types.js";

interface PresetRoleContext {
  id: string;
  enabled: boolean;
  capabilities: string[];
  outputContract: string;
  policy: AgentPolicy;
}

function isSemverLike(version: string): boolean {
  return /^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$/.test(version);
}

function push(
  findings: LintFinding[],
  level: "error" | "warning",
  code: string,
  message: string,
  target: string,
): void {
  findings.push({ level, code, message, target });
}

function addPolicyFindings(policy: AgentPolicy, findings: LintFinding[], target: string): void {
  if (!policy.enabled) {
    push(findings, "warning", "POLICY_DISABLED", "Policy is disabled", target);
  }
  if (!Number.isInteger(policy.maxTurns) || policy.maxTurns <= 0 || policy.maxTurns > 100) {
    push(
      findings,
      "error",
      "POLICY_MAX_TURNS_INVALID",
      "maxTurns must be an integer between 1 and 100",
      `${target}.maxTurns`,
    );
  }
  const overlap = policy.allowedTools.filter((x) => policy.deniedTools.includes(x));
  if (overlap.length > 0) {
    push(
      findings,
      "error",
      "POLICY_TOOL_CONFLICT",
      `Tool appears in both allow and deny lists: ${overlap.join(", ")}`,
      target,
    );
  }
}

function addMemoryScopeRisk(
  findings: LintFinding[],
  target: string,
  scope: RuntimeAgent["memoryScope"],
): void {
  if (scope.crossSessionRead) {
    push(
      findings,
      "warning",
      "MEMORY_SCOPE_CROSS_SESSION",
      "crossSessionRead enabled; this increases data-leak risk across sessions",
      `${target}.crossSessionRead`,
    );
  }
  if (
    scope.layers.includes("long-term") &&
    scope.scopes.some((x) => x === "*" || x === "global:*")
  ) {
    push(
      findings,
      "warning",
      "MEMORY_SCOPE_WIDE_LONG_TERM",
      "Long-term memory with wide scope may over-share context",
      target,
    );
  }
}

export function validateRoleBundle(bundle: RoleBundle): LintResult {
  const findings: LintFinding[] = [];
  const { template, runtime } = bundle;

  const mustString = [
    ["template.id", template.id],
    ["template.name", template.name],
    ["template.description", template.description],
    ["template.systemInstruction", template.systemInstruction],
    ["template.inputContract", template.inputContract],
    ["template.outputContract", template.outputContract],
    ["runtime.id", runtime.id],
    ["runtime.templateId", runtime.templateId],
    ["runtime.name", runtime.name],
    ["runtime.description", runtime.description],
  ] as const;

  for (const [target, value] of mustString) {
    if (!value || value.trim().length === 0) {
      push(findings, "error", "FIELD_REQUIRED", "Must be a non-empty string", target);
    }
  }

  if (runtime.templateId !== template.id) {
    push(
      findings,
      "error",
      "TEMPLATE_RUNTIME_MISMATCH",
      "RuntimeAgent.templateId must match RoleTemplate.id",
      "runtime.templateId",
    );
  }

  if (template.goals.length === 0) {
    push(findings, "error", "GOALS_EMPTY", "At least one goal is required", "template.goals");
  }

  if (template.capabilities.length === 0) {
    push(
      findings,
      "error",
      "CAPABILITIES_EMPTY",
      "At least one capability is required",
      "template.capabilities",
    );
  }
  if (runtime.capabilities.length === 0) {
    push(
      findings,
      "error",
      "CAPABILITIES_EMPTY",
      "At least one capability is required",
      "runtime.capabilities",
    );
  }

  if (!isSemverLike(template.version)) {
    push(
      findings,
      "error",
      "VERSION_INVALID",
      "Version must look like semantic version (e.g. 1.0.0)",
      "template.version",
    );
  }
  if (!isSemverLike(runtime.version)) {
    push(
      findings,
      "error",
      "VERSION_INVALID",
      "Version must look like semantic version (e.g. 1.0.0)",
      "runtime.version",
    );
  }

  if (
    template.outputContract !==
    runtime.policy.constraints.find((x) => x.startsWith("output:"))?.slice(7)
  ) {
    push(
      findings,
      "warning",
      "OUTPUT_CONTRACT_RUNTIME_UNDECLARED",
      "Runtime constraints do not explicitly pin output contract; consider adding output:<contract>",
      "runtime.policy.constraints",
    );
  }

  addPolicyFindings(template.policy, findings, "template.policy");
  addPolicyFindings(runtime.policy, findings, "runtime.policy");
  addMemoryScopeRisk(findings, "template.memoryScope", template.memoryScope);
  addMemoryScopeRisk(findings, "runtime.memoryScope", runtime.memoryScope);

  return {
    valid: !findings.some((x) => x.level === "error"),
    findings,
  };
}

function requiredCapsByTaskType(taskTypes: string[]): string[] {
  const out: string[] = [];
  const set = new Set(taskTypes.map((x) => x.toLowerCase()));
  if (set.has("build")) {
    out.push("build");
  }
  if (set.has("review")) {
    out.push("review");
  }
  if (set.has("qa")) {
    out.push("qa");
  }
  if (set.has("research")) {
    out.push("research");
  }
  if (set.has("ops")) {
    out.push("ops");
  }
  return out;
}

export function validatePreset(
  preset: PresetDefinition,
  roleContexts: PresetRoleContext[],
): LintResult {
  const findings: LintFinding[] = [];
  const roleById = new Map(roleContexts.map((x) => [x.id, x]));

  if (!preset.id.trim()) {
    push(findings, "error", "PRESET_ID_REQUIRED", "Preset id is required", "preset.id");
  }
  if (!isSemverLike(preset.version)) {
    push(
      findings,
      "error",
      "PRESET_VERSION_INVALID",
      "Preset version must be semver-like",
      "preset.version",
    );
  }
  if (preset.roles.length === 0) {
    push(
      findings,
      "error",
      "PRESET_ROLES_EMPTY",
      "Preset must include at least one role",
      "preset.roles",
    );
  }
  if (preset.order.length === 0) {
    push(
      findings,
      "error",
      "PRESET_ORDER_EMPTY",
      "Preset order must include at least one role",
      "preset.order",
    );
  }

  const missing = preset.roles.filter((id) => !roleById.has(id));
  if (missing.length > 0) {
    push(
      findings,
      "error",
      "PRESET_ROLE_MISSING",
      `Preset references missing roles: ${missing.join(", ")}`,
      "preset.roles",
    );
  }

  const duplicate = preset.order.filter((id, idx, arr) => arr.indexOf(id) !== idx);
  if (duplicate.length > 0) {
    push(
      findings,
      "warning",
      "PRESET_ORDER_DUPLICATE",
      `Preset order has duplicates: ${Array.from(new Set(duplicate)).join(", ")}`,
      "preset.order",
    );
  }

  const orderOutsideRoles = preset.order.filter((id) => !preset.roles.includes(id));
  if (orderOutsideRoles.length > 0) {
    push(
      findings,
      "error",
      "PRESET_ORDER_ROLE_MISMATCH",
      `Preset order references roles outside preset.roles: ${orderOutsideRoles.join(", ")}`,
      "preset.order",
    );
  }

  for (const roleId of preset.roles) {
    const role = roleById.get(roleId);
    if (!role) {
      continue;
    }
    if (!role.enabled) {
      push(
        findings,
        "error",
        "PRESET_DISABLED_ROLE",
        `Disabled role referenced by preset: ${roleId}`,
        `preset.roles.${roleId}`,
      );
    }
    const overlap = role.policy.allowedTools.filter((x) =>
      preset.defaultPolicy.deniedTools.includes(x),
    );
    if (overlap.length > 0) {
      push(
        findings,
        "error",
        "PRESET_POLICY_CONFLICT",
        `Preset defaultPolicy denies tools allowed by role ${roleId}: ${overlap.join(", ")}`,
        `preset.defaultPolicy`,
      );
    }
  }

  const required = requiredCapsByTaskType(preset.taskTypes);
  for (const cap of required) {
    if (
      !roleContexts.some(
        (role) => preset.roles.includes(role.id) && role.capabilities.includes(cap),
      )
    ) {
      push(
        findings,
        "error",
        "PRESET_CAPABILITY_MISSING",
        `Preset taskTypes require capability "${cap}" but no included role provides it`,
        "preset.taskTypes",
      );
    }
  }

  const contracts = new Set(
    roleContexts
      .filter((role) => preset.roles.includes(role.id))
      .map((role) => role.outputContract.trim())
      .filter((x) => x.length > 0),
  );
  if (contracts.size > 1) {
    push(
      findings,
      "warning",
      "PRESET_OUTPUT_CONTRACT_INCOMPATIBLE",
      "Preset includes roles with incompatible outputContract definitions",
      "preset.roles",
    );
  }

  return {
    valid: !findings.some((x) => x.level === "error"),
    findings,
  };
}
