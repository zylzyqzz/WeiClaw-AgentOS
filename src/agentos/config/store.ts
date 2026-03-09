import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig, PresetDefinition } from "../types.js";
import { defaultOrchestratorConfig, loadOrchestratorConfig } from "./loader.js";

const CONFIG_FILE = ".weiclaw-agentos.json";

export function resolveConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE);
}

export async function saveOrchestratorConfig(
  config: OrchestratorConfig,
  cwd = process.cwd(),
): Promise<void> {
  const configPath = resolveConfigPath(cwd);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

export async function upsertPreset(
  preset: PresetDefinition,
  cwd = process.cwd(),
): Promise<OrchestratorConfig> {
  const config = loadOrchestratorConfig(cwd);
  config.presets[preset.id] = preset;
  await saveOrchestratorConfig(config, cwd);
  return config;
}

export async function deletePreset(
  presetId: string,
  cwd = process.cwd(),
): Promise<OrchestratorConfig> {
  const config = loadOrchestratorConfig(cwd);
  if (!config.presets[presetId]) {
    throw new Error(`Preset not found: ${presetId}`);
  }
  if (config.defaultPreset === presetId) {
    throw new Error(`Cannot delete preset "${presetId}": referenced by defaultPreset`);
  }
  delete config.presets[presetId];
  await saveOrchestratorConfig(config, cwd);
  return config;
}

export async function readPresetBundleFile(filePath: string): Promise<PresetDefinition> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as PresetDefinition;
}

export async function writePresetBundleFile(
  filePath: string,
  preset: PresetDefinition,
): Promise<void> {
  await writeFile(filePath, JSON.stringify(preset, null, 2), "utf8");
}

export function configExists(cwd = process.cwd()): boolean {
  return existsSync(resolveConfigPath(cwd));
}

export function freshConfig(cwd = process.cwd()): OrchestratorConfig {
  return defaultOrchestratorConfig(cwd);
}
