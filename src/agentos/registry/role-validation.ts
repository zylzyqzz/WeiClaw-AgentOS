import type {
  AgentPolicy,
  PresetDefinition,
  RoleBundle,
  RoleValidationIssue,
  RoleValidationResult,
} from "../types.js";

function isSemverLike(version: string): boolean {
  return /^\d+\.\d+\.\d+([-.][A-Za-z0-9.]+)?$/.test(version);
}

function addPolicyIssues(policy: AgentPolicy, issues: RoleValidationIssue[], prefix: string): void {
  if (!policy.enabled) {
    issues.push({ level: "warning", field: `${prefix}.enabled`, message: "Policy is disabled" });
  }
  if (!Number.isInteger(policy.maxTurns) || policy.maxTurns <= 0 || policy.maxTurns > 100) {
    issues.push({
      level: "error",
      field: `${prefix}.maxTurns`,
      message: "maxTurns must be an integer between 1 and 100",
    });
  }
  const overlap = policy.allowedTools.filter((x) => policy.deniedTools.includes(x));
  if (overlap.length > 0) {
    issues.push({
      level: "error",
      field: `${prefix}.allowedTools/deniedTools`,
      message: `Tool appears in both allow and deny lists: ${overlap.join(", ")}`,
    });
  }
}

export function validateRoleBundle(bundle: RoleBundle): RoleValidationResult {
  const issues: RoleValidationIssue[] = [];
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

  for (const [field, value] of mustString) {
    if (!value || value.trim().length === 0) {
      issues.push({ level: "error", field, message: "Must be a non-empty string" });
    }
  }

  if (runtime.templateId !== template.id) {
    issues.push({
      level: "error",
      field: "runtime.templateId",
      message: "RuntimeAgent.templateId must match RoleTemplate.id",
    });
  }

  if (template.goals.length === 0) {
    issues.push({
      level: "error",
      field: "template.goals",
      message: "At least one goal is required",
    });
  }

  if (template.capabilities.length === 0) {
    issues.push({
      level: "error",
      field: "template.capabilities",
      message: "At least one capability is required",
    });
  }

  if (runtime.capabilities.length === 0) {
    issues.push({
      level: "error",
      field: "runtime.capabilities",
      message: "At least one capability is required",
    });
  }

  if (!isSemverLike(template.version)) {
    issues.push({
      level: "error",
      field: "template.version",
      message: "Version must look like semantic version (e.g. 1.0.0)",
    });
  }

  if (!isSemverLike(runtime.version)) {
    issues.push({
      level: "error",
      field: "runtime.version",
      message: "Version must look like semantic version (e.g. 1.0.0)",
    });
  }

  addPolicyIssues(template.policy, issues, "template.policy");
  addPolicyIssues(runtime.policy, issues, "runtime.policy");

  if (template.memoryScope.layers.length === 0) {
    issues.push({
      level: "error",
      field: "template.memoryScope.layers",
      message: "At least one memory layer is required",
    });
  }
  if (runtime.memoryScope.layers.length === 0) {
    issues.push({
      level: "error",
      field: "runtime.memoryScope.layers",
      message: "At least one memory layer is required",
    });
  }

  return {
    valid: !issues.some((x) => x.level === "error"),
    issues,
  };
}

export function validatePreset(
  preset: PresetDefinition,
  existingRoleIds: string[],
): { valid: boolean; issues: RoleValidationIssue[] } {
  const issues: RoleValidationIssue[] = [];
  if (!preset.id.trim()) {
    issues.push({ level: "error", field: "preset.id", message: "Preset id is required" });
  }
  if (preset.roleOrder.length === 0) {
    issues.push({
      level: "error",
      field: "preset.roleOrder",
      message: "Preset must include at least one role",
    });
  }
  const missing = preset.roleOrder.filter((roleId) => !existingRoleIds.includes(roleId));
  if (missing.length > 0) {
    issues.push({
      level: "error",
      field: "preset.roleOrder",
      message: `Preset references missing roles: ${missing.join(", ")}`,
    });
  }
  return {
    valid: !issues.some((x) => x.level === "error"),
    issues,
  };
}
