import type { PresetDefinition } from "../types.js";

export function listPresets(presets: Record<string, PresetDefinition>): PresetDefinition[] {
  return Object.values(presets).toSorted((a, b) => a.id.localeCompare(b.id));
}

export function inspectPreset(
  presets: Record<string, PresetDefinition>,
  presetId: string,
): PresetDefinition | null {
  return presets[presetId] ?? null;
}

export function ensurePresetExists(
  presets: Record<string, PresetDefinition>,
  presetId: string,
): PresetDefinition {
  const preset = presets[presetId];
  if (!preset) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  if (!preset.enabled) {
    throw new Error(`Preset is disabled: ${presetId}`);
  }
  return preset;
}

export function findPresetReferences(
  presets: Record<string, PresetDefinition>,
  roleId: string,
): string[] {
  return Object.values(presets)
    .filter((preset) => preset.roles.includes(roleId) || preset.order.includes(roleId))
    .map((preset) => preset.id);
}
