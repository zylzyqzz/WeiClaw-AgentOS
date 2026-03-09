import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { formatCliCommand } from "../cli/command-format.js";
import { formatWeiClawInstallerLogo } from "../cli/banner.js";
import { createConfigIO, type OpenClawConfig, writeConfigFile } from "../config/config.js";
import type { ModelApi } from "../config/types.models.js";
import { formatConfigPath } from "../config/logging.js";
import { resolveSessionTranscriptsDir } from "../config/sessions.js";
import { resolveOpenClawPackageRoot } from "../infra/openclaw-root.js";
import { buildNpmResolutionInstallFields, recordPluginInstall } from "../plugins/installs.js";
import { installPluginFromNpmSpec } from "../plugins/install.js";
import { enablePluginInConfig } from "../plugins/enable.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { runTui } from "../tui/tui.js";
import { resolveUserPath, shortenHomePath } from "../utils.js";
import { createClackPrompter } from "../wizard/clack-prompter.js";
import type { WizardPrompter } from "../wizard/prompts.js";
import { WizardCancelledError } from "../wizard/prompts.js";
import { DEFAULT_AGENT_WORKSPACE_DIR, ensureAgentWorkspace } from "../agents/workspace.js";
import { probeGatewayReachable } from "./onboard-helpers.js";
import { resolveGatewayInstallToken } from "./gateway-install-token.js";
import {
  buildGatewayInstallPlan,
  gatewayInstallErrorHint,
} from "./daemon-install-helpers.js";
import {
  DEFAULT_GATEWAY_DAEMON_RUNTIME,
} from "./daemon-runtime.js";
import { resolveGatewayService } from "../daemon/service.js";
import { isSystemdUserServiceAvailable } from "../daemon/systemd.js";
import { ensureSystemdUserLingerInteractive } from "./systemd-linger.js";

// =============================================================================
// Coding Plan Provider 元数据
// =============================================================================
export interface CodingPlanProviderMeta {
  providerKey: string;
  displayName: string;
  baseUrl: string;
  api: ModelApi;
  defaultModel: string;
  models: Array<{ id: string; name: string }>;
}

// 第一次选择：方案
type BootstrapPlanChoice = "coding-plan" | "custom";

// 第二次选择（Coding Plan 子选项）
type BootstrapProviderChoice =
  | "aliyun-bailian"    // 阿里云百炼
  | "volcengine"        // 火山引擎
  | "tencent"           // 腾讯云
  | "qianfan"           // 百度千帆
  | "liantong"          // 联通云
  | "custom";          // 自定义

type BootstrapChannelChoice = "telegram" | "feishu";

type SetupBootstrapOptions = {
  workspace?: string;
  skipTui?: boolean;
};

type BootstrapDeps = {
  createPrompter: () => WizardPrompter;
  installPluginFromNpmSpec: typeof installPluginFromNpmSpec;
  enablePluginInConfig: typeof enablePluginInConfig;
  recordPluginInstall: typeof recordPluginInstall;
  buildNpmResolutionInstallFields: typeof buildNpmResolutionInstallFields;
  writeConfigFile: typeof writeConfigFile;
  runTui: typeof runTui;
  probeGatewayReachable: typeof probeGatewayReachable;
  resolveOpenClawPackageRoot: typeof resolveOpenClawPackageRoot;
  spawn: typeof spawn;
  sleep: (ms: number) => Promise<void>;
};

const DEFAULT_GATEWAY_PORT = 19789;
const FEISHU_PLUGIN_SPEC = "@openclaw/feishu";

// =============================================================================
// Coding Plan Provider 元数据映射
// =============================================================================
export const CODING_PLAN_PROVIDERS: Record<BootstrapProviderChoice, CodingPlanProviderMeta> = {
  "aliyun-bailian": {
    providerKey: "aliyun-bailian-coding-plan",
    displayName: "阿里云百炼",
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1",
    api: "openai-completions",
    defaultModel: "qwen3-coder-next",
    models: [
      { id: "qwen3.5-plus", name: "qwen3.5-plus" },
      { id: "qwen3-max-2026-01-23", name: "qwen3-max-2026-01-23" },
      { id: "qwen3-coder-next", name: "qwen3-coder-next" },
      { id: "qwen3-coder-plus", name: "qwen3-coder-plus" },
      { id: "MiniMax-M2.5", name: "MiniMax-M2.5" },
      { id: "glm-5", name: "glm-5" },
      { id: "glm-4.7", name: "glm-4.7" },
      { id: "kimi-k2.5", name: "kimi-k2.5" },
    ],
  },
  volcengine: {
    providerKey: "volcengine-coding-plan",
    displayName: "火山引擎",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    api: "openai-completions",
    defaultModel: "doubao-seed-code",
    models: [
      { id: "doubao-seed-code", name: "doubao-seed-code" },
      { id: "glm-4.7", name: "glm-4.7" },
      { id: "deepseek-v3.2", name: "deepseek-v3.2" },
      { id: "kimi-k2-thinking", name: "kimi-k2-thinking" },
      { id: "kimi-k2.5", name: "kimi-k2.5" },
    ],
  },
  tencent: {
    providerKey: "tencent-coding-plan",
    displayName: "腾讯云",
    baseUrl: "https://api.lkeap.cloud.tencent.com/coding/v3",
    api: "openai-completions",
    defaultModel: "tc-code-latest",
    models: [
      { id: "tc-code-latest", name: "tc-code-latest" },
      { id: "hunyuan-2.0-instruct", name: "hunyuan-2.0-instruct" },
      { id: "hunyuan-2.0-thinking", name: "hunyuan-2.0-thinking" },
      { id: "hunyuan-t1", name: "hunyuan-t1" },
      { id: "hunyuan-turbos", name: "hunyuan-turbos" },
      { id: "minimax-m2.5", name: "minimax-m2.5" },
      { id: "kimi-k2.5", name: "kimi-k2.5" },
      { id: "glm-5", name: "glm-5" },
    ],
  },
  qianfan: {
    providerKey: "baidu-qianfan-coding-plan",
    displayName: "百度千帆",
    baseUrl: "https://qianfan.baidubce.com/v2/coding",
    api: "openai-completions",
    defaultModel: "qianfan-code-latest",
    models: [
      { id: "qianfan-code-latest", name: "qianfan-code-latest" },
      { id: "kimi-k2.5", name: "kimi-k2.5" },
      { id: "deepseek-v3.2", name: "deepseek-v3.2" },
      { id: "glm-5", name: "glm-5" },
    ],
  },
  liantong: {
    providerKey: "cucloud-coding-plan",
    displayName: "联通云",
    baseUrl: "https://aigw-gzgy2.cucloud.cn:8443/v1",
    api: "openai-completions",
    defaultModel: "glm-5",
    models: [
      { id: "MiniMax-M2.5", name: "MiniMax-M2.5" },
      { id: "glm-5", name: "glm-5" },
      { id: "kimi-k2.5", name: "kimi-k2.5" },
      { id: "Qwen3.5-397B-A17B", name: "Qwen3.5-397B-A17B" },
      { id: "Qwen3-235B-A22B", name: "Qwen3-235B-A22B" },
      { id: "DeepSeek V3.1", name: "DeepSeek V3.1" },
    ],
  },
  custom: {
    providerKey: "custom-openai-compatible",
    displayName: "自定义",
    baseUrl: "",
    api: "openai-completions",
    defaultModel: "",
    models: [],
  },
};

// 第一次选择：方案
const PLAN_OPTIONS: Array<{
  value: BootstrapPlanChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "coding-plan",
    label: "Coding Plan",
    hint: "推荐 / Recommended",
  },
  {
    value: "custom",
    label: "自定义 / Custom",
    hint: "",
  },
];

// 第二次选择：Coding Plan 子选项
const PROVIDER_OPTIONS: Array<{
  value: BootstrapProviderChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "aliyun-bailian",
    label: "阿里云百炼",
    hint: "",
  },
  {
    value: "volcengine",
    label: "火山引擎",
    hint: "",
  },
  {
    value: "tencent",
    label: "腾讯云",
    hint: "",
  },
  {
    value: "qianfan",
    label: "百度千帆",
    hint: "",
  },
  {
    value: "liantong",
    label: "联通云",
    hint: "",
  },
];

const CHANNEL_OPTIONS: Array<{
  value: BootstrapChannelChoice;
  label: string;
  hint: string;
}> = [
  {
    value: "telegram",
    label: "Telegram",
    hint: "更轻 / Lighter",
  },
  {
    value: "feishu",
    label: "Feishu",
    hint: "按需插件 / Optional plugin",
  },
];

function randomToken(): string {
  return randomBytes(24).toString("hex");
}

function printBootstrapLogo() {
  if (!process.stdout.isTTY) {
    return;
  }
  process.stdout.write(`\n${formatWeiClawInstallerLogo()}\n\n`);
}

function applyBootstrapBaseConfig(cfg: OpenClawConfig, workspace: string, gatewayToken: string) {
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        workspace,
      },
    },
    gateway: {
      ...cfg.gateway,
      mode: "local",
      port: DEFAULT_GATEWAY_PORT,
      bind: "loopback",
      auth: {
        ...cfg.gateway?.auth,
        mode: "token",
        token: gatewayToken,
      },
      controlUi: {
        ...cfg.gateway?.controlUi,
        enabled: false,
      },
    },
    browser: {
      ...cfg.browser,
      enabled: false,
    },
  } satisfies OpenClawConfig;
}

async function promptModelApiKey(params: {
  prompter: WizardPrompter;
  label: string;
  envVar: string;
}): Promise<string | undefined> {
  const value = String(
    await params.prompter.text({
      message: `${params.label} API Key / API Key`,
      initialValue: process.env[params.envVar]?.trim() || "",
      placeholder: `${params.envVar} (留空则走环境变量 / blank = use env)`,
    }),
  ).trim();
  return value || process.env[params.envVar]?.trim() || undefined;
}

async function applyModelPreset(params: {
  cfg: OpenClawConfig;
  provider: BootstrapProviderChoice;
  prompter: WizardPrompter;
}): Promise<OpenClawConfig> {
  const { cfg, provider, prompter } = params;
  const meta = CODING_PLAN_PROVIDERS[provider];

  // 自定义 Provider（完全手填）
  if (provider === "custom") {
    const baseUrl = String(
      await prompter.text({
        message: "请输入 Base URL / Enter Base URL",
        placeholder: "https://api.example.com/v1",
      }),
    ).trim();

    const modelId = String(
      await prompter.text({
        message: "请输入模型 ID / Enter model ID",
        placeholder: "gpt-4o",
      }),
    ).trim();

    const apiKey = String(
      await prompter.text({
        message: "请输入 API Key / Enter API Key",
        placeholder: "sk-...",
      }),
    ).trim();

    if (!baseUrl || !modelId || !apiKey) {
      return cfg;
    }

    const providerId = "custom";
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: { primary: `${providerId}/${modelId}` },
          models: {
            ...cfg.agents?.defaults?.models,
            [`${providerId}/${modelId}`]: {
              alias: "自定义 / Custom",
            },
          },
        },
      },
      models: {
        ...cfg.models,
        providers: {
          ...cfg.models?.providers,
          [providerId]: {
            api: "openai-completions",
            baseUrl,
            apiKey,
            models: [
              {
                id: modelId,
                name: modelId,
                reasoning: false,
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 128000,
                maxTokens: 8192,
              },
            ],
          },
        },
      },
    };
  }

  // 预填 URL 显示
  await prompter.note(`连接地址 / Endpoint: ${meta.baseUrl}`, meta.displayName);

  // 让用户选择模型
  const modelChoice = await prompter.select({
    message: "请选择模型 / Select model",
    options: [
      ...meta.models.map((m) => ({ value: m.id, label: m.name, hint: "" })),
      { value: "__custom__", label: "自定义模型 ID", hint: "" },
    ],
    initialValue: meta.defaultModel,
  });

  let modelId = modelChoice;
  if (modelChoice === "__custom__") {
    modelId = String(
      await prompter.text({
        message: "请输入自定义模型 ID / Enter custom model ID",
        validate: (value) => (value.trim() ? undefined : "必填 / Required"),
      }),
    ).trim();
  }

  // 填写 API Key
  const apiKey = await promptModelApiKey({
    prompter,
    label: meta.displayName,
    envVar: "",
  });

  if (!apiKey) {
    return cfg;
  }

  const providerId = meta.providerKey;
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        model: { primary: `${providerId}/${modelId}` },
        models: {
          ...cfg.agents?.defaults?.models,
          [`${providerId}/${modelId}`]: {
            alias: meta.displayName,
          },
        },
      },
    },
    models: {
      ...cfg.models,
      providers: {
        ...cfg.models?.providers,
        [providerId]: {
          api: meta.api,
          baseUrl: meta.baseUrl,
          apiKey,
          models: [
            {
              id: modelId,
              name: modelId,
              reasoning: modelId.includes("thinking") || modelId.includes("DeepSeek"),
              input: ["text"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 8192,
            },
          ],
        },
      },
    },
  };
}

function applyTelegramConfig(cfg: OpenClawConfig, botToken: string): OpenClawConfig {
  return {
    ...cfg,
    channels: {
      ...cfg.channels,
      telegram: {
        ...cfg.channels?.telegram,
        enabled: true,
        botToken,
        dmPolicy: "open",
        allowFrom: ["*"],
      },
      ...(cfg.channels?.feishu
        ? {
            feishu: {
              ...cfg.channels.feishu,
              enabled: false,
            },
          }
        : {}),
    },
  };
}

function applyFeishuConfig(params: {
  cfg: OpenClawConfig;
  appId: string;
  appSecret: string;
}): OpenClawConfig {
  return {
    ...params.cfg,
    channels: {
      ...params.cfg.channels,
      feishu: {
        ...params.cfg.channels?.feishu,
        enabled: true,
        appId: params.appId,
        appSecret: params.appSecret,
        connectionMode: "websocket",
        dmPolicy: "open",
        allowFrom: ["*"],
      },
      ...(params.cfg.channels?.telegram
        ? {
            telegram: {
              ...params.cfg.channels.telegram,
              enabled: false,
            },
          }
        : {}),
    },
  };
}

async function ensureFeishuPlugin(params: {
  cfg: OpenClawConfig;
  deps: BootstrapDeps;
  runtime: RuntimeEnv;
}): Promise<OpenClawConfig> {
  // 先尝试安装，如果已存在则更新
  let result = await params.deps.installPluginFromNpmSpec({
    spec: FEISHU_PLUGIN_SPEC,
    logger: {
      info: (message) => params.runtime.log(message),
      warn: (message) => params.runtime.log(message),
    },
    mode: "install",
  });

  // 如果插件已存在，使用 update 模式重试
  if (!result.ok && result.error?.includes("already exists")) {
    params.runtime.log("Feishu 插件已存在，正在更新... / Feishu plugin already exists, updating...");
    result = await params.deps.installPluginFromNpmSpec({
      spec: FEISHU_PLUGIN_SPEC,
      logger: {
        info: (message) => params.runtime.log(message),
        warn: (message) => params.runtime.log(message),
      },
      mode: "update",
    });
  }

  if (!result.ok) {
    throw new Error(`Feishu plugin install failed: ${result.error}`);
  }

  let next = params.deps.enablePluginInConfig(params.cfg, result.pluginId).config;
  next = params.deps.recordPluginInstall(next, {
    pluginId: result.pluginId,
    source: "npm",
    spec: FEISHU_PLUGIN_SPEC,
    installPath: result.targetDir,
    version: result.version,
    ...params.deps.buildNpmResolutionInstallFields(result.npmResolution),
  });
  return next;
}

// 检测当前环境是否适合自动打开 TUI
function isTuiEnvironment(): boolean {
  // 非交互式环境 - 不适合
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }

  // SSH 远程环境 - 不适合
  const sshConnection = process.env.SSH_CONNECTION || process.env.SSH_CLIENT;
  if (sshConnection) {
    return false;
  }

  // TERM 环境变量检测 - dumb 或 screen 但不是 256color 不适合
  const term = process.env.TERM?.toLowerCase() || "";
  if (term === "dumb" || (term.includes("screen") && !term.includes("256"))) {
    return false;
  }

  // Termux 手机终端 - 不适合
  const termProgram = process.env.TERM_PROGRAM?.toLowerCase() || "";
  if (termProgram.includes("termux")) {
    return false;
  }

  // 其他交互式终端环境适合
  return true;
}

async function maybeLaunchTui(params: {
  cfg: OpenClawConfig;
  gatewayToken: string;
  runtime: RuntimeEnv;
  deps: BootstrapDeps;
}): Promise<{ launched: boolean; message: string }> {
  // 检测环境是否适合自动打开 TUI
  if (!isTuiEnvironment()) {
    return { launched: false, message: "current-environment-not-suitable" };
  }

  const wsUrl = `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`;
  const probe = await params.deps.probeGatewayReachable({
    url: wsUrl,
    token: params.gatewayToken,
  });

  if (!probe.ok) {
    const root = await params.deps.resolveOpenClawPackageRoot({
      cwd: process.cwd(),
      argv1: process.argv[1],
      moduleUrl: import.meta.url,
    });
    if (!root) {
      params.runtime.log("未找到启动入口 / Could not resolve gateway entry.");
      return { launched: false, message: "no-entry" };
    }
    const wrapper = path.join(root, "openclaw.mjs");
    if (!wrapper) {
      params.runtime.log("未找到启动入口 / Could not resolve gateway entry.");
      return { launched: false, message: "no-entry" };
    }
    const child: ReturnType<typeof spawn> = params.deps.spawn(
      process.execPath,
      [wrapper, "gateway", "--bind", "loopback", "--port", String(DEFAULT_GATEWAY_PORT), "--allow-unconfigured"],
      {
        cwd: root,
        stdio: "ignore",
        detached: true,
      },
    );
    child.unref();
    await params.deps.sleep(2500);
  }

  const followupProbe = await params.deps.probeGatewayReachable({
    url: wsUrl,
    token: params.gatewayToken,
  });
  if (!followupProbe.ok) {
    params.runtime.log("网关未就绪，跳过 TUI / Gateway not ready, skipping TUI.");
    return { launched: false, message: "gateway-not-ready" };
  }

  await params.deps.runTui({
    url: wsUrl,
    token: params.gatewayToken,
    deliver: false,
  });
  return { launched: true, message: "tui-launched" };
}

export async function runSetupBootstrap(
  opts: SetupBootstrapOptions = {},
  runtime: RuntimeEnv = defaultRuntime,
  deps?: Partial<BootstrapDeps>,
) {
  const resolvedDeps: BootstrapDeps = {
    createPrompter: createClackPrompter,
    installPluginFromNpmSpec,
    enablePluginInConfig,
    recordPluginInstall,
    buildNpmResolutionInstallFields,
    writeConfigFile,
    runTui,
    probeGatewayReachable,
    resolveOpenClawPackageRoot,
    spawn,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...deps,
  };

  const prompter = resolvedDeps.createPrompter();
  const io = createConfigIO();
  const workspace = resolveUserPath(opts.workspace?.trim() || DEFAULT_AGENT_WORKSPACE_DIR);
  const gatewayToken = randomToken();

  try {
    printBootstrapLogo();
    await prompter.intro("WeiClaw 极简安装 / Minimal setup");

    // 第一层：选择方案
    const planChoice = await prompter.select<BootstrapPlanChoice>({
      message: "请选择接入方案 / Select plan",
      options: PLAN_OPTIONS,
      initialValue: "coding-plan",
    });

    let modelChoice: BootstrapProviderChoice;

    if (planChoice === "coding-plan") {
      // 第二层：选择 Coding Plan 厂商
      modelChoice = await prompter.select<BootstrapProviderChoice>({
        message: "请选择云服务商 / Select provider",
        options: PROVIDER_OPTIONS,
        initialValue: "aliyun-bailian",
      });
    } else {
      // 自定义方案
      modelChoice = "custom";
    }

    const channelChoice = await prompter.select<BootstrapChannelChoice>({
      message: "请选择通道 / Select channel",
      options: CHANNEL_OPTIONS,
      initialValue: "telegram",
    });

    let nextConfig: OpenClawConfig = applyBootstrapBaseConfig({}, workspace, gatewayToken);
    nextConfig = await applyModelPreset({
      cfg: nextConfig,
      provider: modelChoice,
      prompter,
    });

    if (channelChoice === "telegram") {
      const botToken = String(
        await prompter.text({
          message: "请输入 Telegram Bot Token / Enter Telegram Bot Token",
          validate: (value) => (value.trim() ? undefined : "必填 / Required"),
        }),
      ).trim();
      nextConfig = applyTelegramConfig(nextConfig, botToken);
    } else {
      const appId = String(
        await prompter.text({
          message: "请输入 Feishu App ID / Enter Feishu App ID",
          validate: (value) => (value.trim() ? undefined : "必填 / Required"),
        }),
      ).trim();
      const appSecret = String(
        await prompter.text({
          message: "请输入 Feishu App Secret / Enter Feishu App Secret",
          validate: (value) => (value.trim() ? undefined : "必填 / Required"),
        }),
      ).trim();
      nextConfig = await ensureFeishuPlugin({
        cfg: nextConfig,
        deps: resolvedDeps,
        runtime,
      });
      nextConfig = applyFeishuConfig({ cfg: nextConfig, appId, appSecret });
    }

    await resolvedDeps.writeConfigFile(nextConfig);
    await ensureAgentWorkspace({
      dir: workspace,
      ensureBootstrapFiles: !nextConfig.agents?.defaults?.skipBootstrap,
    });
    await fs.mkdir(resolveSessionTranscriptsDir(), { recursive: true });

    // Linux 后台运行支持：安装 systemd user service + linger
    if (process.platform === "linux") {
      const systemdAvailable = await isSystemdUserServiceAvailable();
      if (systemdAvailable) {
        // 确保 linger 启用（使能用户服务在 logout 后继续运行）
        await ensureSystemdUserLingerInteractive({
          runtime,
          prompter: {
            confirm: prompter.confirm,
            note: prompter.note,
          },
          reason:
            "Linux 安装默认使用 systemd user service。关闭终端后服务将继续运行。",
          requireConfirm: false,
        });

        // 自动安装 daemon service
        const service = resolveGatewayService();
        const loaded = await service.isLoaded({ env: process.env });
        if (!loaded) {
          await prompter.note("正在安装 Gateway 服务... / Installing Gateway service...", "Gateway");
          try {
            const tokenResolution = await resolveGatewayInstallToken({
              config: nextConfig,
              env: process.env,
            });
            if (!tokenResolution.unavailableReason) {
              const { programArguments, workingDirectory, environment } = await buildGatewayInstallPlan({
                env: process.env,
                port: DEFAULT_GATEWAY_PORT,
                token: tokenResolution.token,
                runtime: DEFAULT_GATEWAY_DAEMON_RUNTIME,
                warn: (message, title) => prompter.note(message, title),
                config: nextConfig,
              });
              await service.install({
                env: process.env,
                stdout: process.stdout,
                programArguments,
                workingDirectory,
                environment,
              });
              await prompter.note(
                "Gateway 服务已安装并启动 / Gateway service installed and started.",
                "Gateway",
              );
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            await prompter.note(`Gateway 服务安装失败 / Gateway service install failed: ${errMsg}`, "Gateway");
            await prompter.note(gatewayInstallErrorHint(), "Gateway");
          }
        }
      } else {
        await prompter.note(
          "Systemd user service 不可用，跳过后台服务安装。请使用 docker 或其他方式运行。",
          "Gateway",
        );
      }
    }

    // 自动尝试启动 TUI（内部会检测环境是否适合）
    if (!opts.skipTui) {
      const result = await maybeLaunchTui({
        cfg: nextConfig,
        gatewayToken,
        runtime,
        deps: resolvedDeps,
      });

      if (result.launched) {
        return;
      }

      // 环境不适合自动打开 TUI
      if (result.message === "current-environment-not-suitable") {
        await prompter.outro(
          [
            "安装完成 / Setup complete",
            `配置文件 / Config: ${formatConfigPath(io.configPath)}`,
            `工作区 / Workspace: ${shortenHomePath(workspace)}`,
            "",
            "当前环境不适合自动打开 TUI / Current environment is not suitable for auto-launching TUI",
            "请在本地交互终端执行 / Please run locally: weiclaw",
          ].join("\n"),
        );
        return;
      }
    }

    // 构建 outro 消息
    const outroLines = [
      "安装完成 / Setup complete",
      `配置文件 / Config: ${formatConfigPath(io.configPath)}`,
      `工作区 / Workspace: ${shortenHomePath(workspace)}`,
    ];

    // Linux: 如果已安装 systemd service，显示服务状态
    if (process.platform === "linux") {
      const service = resolveGatewayService();
      const loaded = await service.isLoaded({ env: process.env });
      if (loaded) {
        outroLines.push(
          "",
          "Gateway 服务已后台运行 / Gateway service is running in background",
          `服务状态 / Status: ${formatCliCommand("weiclaw status")}`,
          "关闭终端后服务将继续运行 / Service will continue running after terminal closes",
        );
      } else {
        outroLines.push(`启动 / Start: npm run start`);
      }
    } else {
      outroLines.push(`启动 / Start: npm run start`);
    }

    outroLines.push(
      `终端 / TUI: ${formatCliCommand("weiclaw tui")}`,
      `高级配置 / Advanced: ${formatCliCommand("weiclaw configure")}`,
    );

    await prompter.outro(outroLines.join("\n"));
  } catch (error) {
    if (error instanceof WizardCancelledError) {
      runtime.exit(1);
      return;
    }
    throw error;
  }
}
