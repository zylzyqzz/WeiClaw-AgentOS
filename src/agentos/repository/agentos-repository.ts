import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  ConsistencyIssue,
  OrchestratorConfig,
  PresetDefinition,
  RoleTemplate,
  RuntimeAgent,
} from "../types.js";
import type { AgentOsStorage } from "../storage/storage.js";

const LEGACY_CONFIG_FILE = ".weiclaw-agentos.json";
const LEGACY_MIGRATION_KEY = "legacy_config_migrated";

function mergeConfig(base: OrchestratorConfig, patch?: Partial<OrchestratorConfig> | null): OrchestratorConfig {
  if (!patch) {return base;}
  return {
    ...base,
    ...patch,
    presets: {
      ...base.presets,
      ...patch.presets,
    },
    routing: {
      ...base.routing,
      ...patch.routing,
      taskTypeRules: {
        ...base.routing.taskTypeRules,
        ...patch.routing?.taskTypeRules,
      },
      capabilityKeywords: {
        ...base.routing.capabilityKeywords,
        ...patch.routing?.capabilityKeywords,
      },
      weights: {
        ...base.routing.weights,
        ...patch.routing?.weights,
      },
    },
  };
}

export class AgentOsRepository {
  constructor(
    private readonly storage: AgentOsStorage,
    private readonly cwd: string,
  ) {}

  async loadConfig(base: OrchestratorConfig): Promise<OrchestratorConfig> {
    await this.migrateLegacyConfigIfNeeded();

    const stored = await this.storage.getRuntimeConfig();
    let merged = mergeConfig(base, stored);

    const presets = await this.storage.listPresets();
    if (presets.length > 0) {
      merged = {
        ...merged,
        presets: Object.fromEntries(presets.map((p) => [p.id, p])),
      };
    }

    if (!(await this.storage.getPreset(merged.defaultPreset))) {
      const fallback = presets[0]?.id ?? Object.keys(merged.presets)[0] ?? "default-demo";
      merged.defaultPreset = fallback;
      await this.storage.setRuntimeConfig({ defaultPreset: fallback });
    }

    return merged;
  }

  async saveConfigPatch(patch: Partial<OrchestratorConfig>): Promise<void> {
    const current = (await this.storage.getRuntimeConfig()) ?? {};
    await this.storage.setRuntimeConfig({ ...current, ...patch });
  }

  async upsertPreset(preset: PresetDefinition): Promise<void> {
    await this.storage.upsertPreset(preset);
  }

  async deletePreset(presetId: string, defaultPreset: string): Promise<void> {
    if (presetId === defaultPreset) {
      throw new Error(`Cannot delete preset "${presetId}": referenced by defaultPreset`);
    }
    await this.storage.deletePreset(presetId);
  }

  async listPresets(): Promise<PresetDefinition[]> {
    return this.storage.listPresets();
  }

  async getPreset(presetId: string): Promise<PresetDefinition | null> {
    return this.storage.getPreset(presetId);
  }

  async checkConsistency(config: OrchestratorConfig): Promise<ConsistencyIssue[]> {
    const issues: ConsistencyIssue[] = [];
    const runtimeAgents = await this.storage.listRuntimeAgents();
    const runtimeRoleIds = new Set(runtimeAgents.map((x) => x.id));

    if (!config.presets[config.defaultPreset]) {
      issues.push({
        level: "error",
        code: "DEFAULT_PRESET_MISSING",
        message: `defaultPreset "${config.defaultPreset}" is not defined`,
        fixHint: "Set defaultPreset to an existing preset id",
      });
    }

    for (const preset of Object.values(config.presets)) {
      for (const roleId of preset.roles) {
        if (!runtimeRoleIds.has(roleId)) {
          issues.push({
            level: "error",
            code: "PRESET_ROLE_NOT_FOUND",
            message: `Preset ${preset.id} references missing RuntimeAgent ${roleId}`,
            fixHint: `Create role ${roleId} or remove it from preset ${preset.id}`,
          });
        }
      }
      if (preset.order.some((id) => !preset.roles.includes(id))) {
        issues.push({
          level: "warning",
          code: "PRESET_ORDER_MISMATCH",
          message: `Preset ${preset.id} has order roles not included in preset.roles`,
          fixHint: "Align preset.order with preset.roles",
        });
      }
    }

    return issues;
  }

  async migrateLegacyConfigIfNeeded(): Promise<void> {
    const migrated = await this.storage.getMeta(LEGACY_MIGRATION_KEY);
    if (migrated === "1") {return;}

    const legacyPath = path.join(this.cwd, LEGACY_CONFIG_FILE);
    if (!existsSync(legacyPath)) {
      await this.storage.setMeta(LEGACY_MIGRATION_KEY, "1");
      return;
    }
    console.warn(
      `[agentos] Detected deprecated legacy config at ${LEGACY_CONFIG_FILE}; migrating to storage source-of-truth.`,
    );

    try {
      const parsed = JSON.parse(readFileSync(legacyPath, "utf8")) as Partial<OrchestratorConfig>;
      if (parsed.presets) {
        for (const preset of Object.values(parsed.presets)) {
          if (preset && typeof preset === "object" && "id" in preset) {
            await this.storage.upsertPreset(preset);
          }
        }
      }
      const cfgPatch: Partial<OrchestratorConfig> = {};
      if (parsed.defaultPreset) {cfgPatch.defaultPreset = parsed.defaultPreset;}
      if (parsed.routing) {cfgPatch.routing = parsed.routing;}
      if (Object.keys(cfgPatch).length > 0) {
        await this.saveConfigPatch(cfgPatch);
      }
      await this.storage.setMeta(LEGACY_MIGRATION_KEY, "1");
      console.warn(
        `[agentos] Legacy config migration completed. ${LEGACY_CONFIG_FILE} is now compatibility-only.`,
      );
    } catch {
      await this.storage.setMeta(LEGACY_MIGRATION_KEY, "1");
      console.warn(
        `[agentos] Legacy config migration failed to parse ${LEGACY_CONFIG_FILE}; marked as migrated to avoid repeated retries.`,
      );
    }
  }

  async seedPresetsIfEmpty(defaultPresets: Record<string, PresetDefinition>): Promise<void> {
    const existing = await this.storage.listPresets();
    if (existing.length > 0) {return;}
    for (const preset of Object.values(defaultPresets)) {
      await this.storage.upsertPreset(preset);
    }
  }

  async seedConfigIfEmpty(defaultConfig: OrchestratorConfig): Promise<void> {
    const existing = await this.storage.getRuntimeConfig();
    if (existing) {return;}
    await this.storage.setRuntimeConfig({
      defaultPreset: defaultConfig.defaultPreset,
      projectName: defaultConfig.projectName,
      logLevel: defaultConfig.logLevel,
      routing: defaultConfig.routing,
    });
  }

  async listRoleTemplates(): Promise<RoleTemplate[]> {
    return this.storage.listRoleTemplates();
  }

  async listRuntimeAgents(): Promise<RuntimeAgent[]> {
    return this.storage.listRuntimeAgents();
  }
}
