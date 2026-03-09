import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { OrchestratorConfig, PresetDefinition } from "../types.js";

const LEGACY_CONFIG_FILE = ".weiclaw-agentos.json";

/**
 * @deprecated Legacy compatibility path only.
 * Runtime source-of-truth is AgentOsStorage (SQLite/file fallback).
 */
export function resolveLegacyConfigPath(cwd = process.cwd()): string {
  return path.join(cwd, LEGACY_CONFIG_FILE);
}

/**
 * @deprecated Legacy compatibility check only.
 * Kept for one-way migration from `.weiclaw-agentos.json`.
 */
export function legacyConfigExists(cwd = process.cwd()): boolean {
  return existsSync(resolveLegacyConfigPath(cwd));
}

/**
 * @deprecated Legacy compatibility read only.
 * Do not use as runtime source of truth.
 */
export async function readLegacyConfigFile(cwd = process.cwd()): Promise<Partial<OrchestratorConfig> | null> {
  const file = resolveLegacyConfigPath(cwd);
  if (!existsSync(file)) {return null;}
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Partial<OrchestratorConfig>;
}

/**
 * @deprecated Legacy compatibility write only for controlled migration tooling.
 * Runtime writes must go through AgentOsRepository -> AgentOsStorage.
 */
export async function writeLegacyConfigFile(config: Partial<OrchestratorConfig>, cwd = process.cwd()): Promise<void> {
  const file = resolveLegacyConfigPath(cwd);
  await writeFile(file, JSON.stringify(config, null, 2), "utf8");
}

export async function readPresetBundleFile(filePath: string): Promise<PresetDefinition> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as PresetDefinition;
}

export async function writePresetBundleFile(filePath: string, preset: PresetDefinition): Promise<void> {
  await writeFile(filePath, JSON.stringify(preset, null, 2), "utf8");
}
