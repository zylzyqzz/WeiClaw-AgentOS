# WeiClaw 极简私有助手

```
╔══════════════════╗
║    WeiClaw      ║
║  极简私有助手    ║
╚══════════════════╝
```

**Minimal private agent** - 基于 OpenClaw 改造的极简私有 AI 助手。

## 项目亮点

- **极简安装**：一行命令完成安装，自动引导配置
- **私有部署**：本地运行，数据不离开你的设备
- **多模型支持**：接入 OpenAI Compatible API（百度千帆、Moonshot、Kimi 等）
- **多通道接入**：Telegram、Feishu/Lark
- **终端交互**：内置 TUI，可在终端直接对话
- **国际/中国双入口**：全球网络与中国大陆网络分别优化

## 当前状态

### ✅ 已完成

- WeiClaw 主 CLI 及 `openclaw` 兼容别名
- Bootstrap 极简安装流程（选模型 → 选通道 → 填凭证 → 选 TUI）
- Telegram 通道完整支持
- Feishu/Lark 通道（需在引导流程中手动选择安装）
- 基础命令：`setup --bootstrap`、`configure`、`doctor`、`status`、`tui`
- Gateway 运行在端口 `19789`
- 国际/中国双安装入口

### 🔄 完善中

- npm runtime 包发布闭环（当前依赖 GitHub Release + ghproxy.net 回退）
- 更稳定的国内分发源

## WeiClaw-AgentOS MVP（v2.1.0 alpha）

当前能力已升级为“动态角色 + 长久记忆 + 可解释任务路由”。

术语：

- `RoleTemplate` = 角色模板
- `RuntimeAgent` = 运行时实例
- `Preset` = 预设组合
- `AgentRegistry` = 角色注册中心

默认 `commander/planner/builder/reviewer` 仅作为 demo preset，不是底层固定依赖。

核心能力：

- 动态角色模型（模板 + 运行时实例，支持版本/标签/策略/记忆范围）
- 角色生命周期闭环（create/update/enable/disable/delete/export/import/validate）
- 任务路由优先级：`--roles` > `--preset` > 动态能力路由
- 路由结果可解释输出：`routeSummary` / `selectedRoles` / `selectionReasons`
- preset 生命周期闭环（create/update/delete/export/import/validate）
- 语义 lint（policy/capability/memoryScope/preset 引用与顺序冲突）
- 机器可读输出（`--json` + 统一错误结构 + 稳定 exit code）
- 三层记忆（short-term / long-term / project-entity）
- SQLite 优先 + 文件回退

CLI 示例：

```bash
pnpm agentos -- list-roles
pnpm agentos -- create-role --id qa --name QA --system-instruction "review quality" --capabilities qa,review
pnpm agentos -- update-role --id qa --goals "prevent regressions" --version 1.0.1
pnpm agentos -- validate-role --id qa
pnpm agentos -- export-role --id qa --file /tmp/qa-role.json
pnpm agentos -- import-role --file /tmp/qa-role.json --overwrite true
pnpm agentos -- validate-role --id qa --json
pnpm agentos -- list-presets
pnpm agentos -- create-preset --id qa-only --roles reviewer --order reviewer --task-types review,qa
pnpm agentos -- update-preset --id qa-only --version 1.0.1 --enabled true
pnpm agentos -- validate-preset --id qa-only
pnpm agentos -- export-preset --id qa-only --file /tmp/qa-only-preset.json
pnpm agentos -- import-preset --file /tmp/qa-only-preset.json --overwrite true
pnpm agentos -- inspect-preset --id default-demo
pnpm agentos -- run --goal "实现本地多智能体 alpha" --roles commander,qa
pnpm agentos -- run --goal "检查风险" --preset default-demo --required-capabilities review
pnpm agentos -- run --goal "机器可读路由输出" --preset default-demo --json
```

## 快速开始

### 国际网络安装

#### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/zylzyqzz/WeiClaw/main/scripts/bootstrap/install.sh | bash
```

#### Windows PowerShell

```powershell
iwr -useb https://raw.githubusercontent.com/zylzyqzz/WeiClaw/main/scripts/bootstrap/install.ps1 | iex
```

### 中国大陆安装

由于 `raw.githubusercontent.com` 在中国大陆可能无法访问，请使用 jsDelivr CDN 作为脚本入口。

#### macOS / Linux

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/zylzyqzz/WeiClaw@main/scripts/bootstrap/install.sh | bash
```

#### Windows PowerShell

```powershell
iwr -useb https://cdn.jsdelivr.net/gh/zylzyqzz/WeiClaw@main/scripts/bootstrap/install.ps1 | iex
```

### 安装后会发生什么

1. 自动检测并安装 Git、Node.js（如未安装）
2. 下载并安装 runtime 包
3. 启动引导流程（Bootstrap）
4. 根据终端环境自动决定是否打开 TUI

## 引导安装流程

首次安装后会进入引导流程，按提示完成配置：

```
WeiClaw
Minimal private agent

请选择接入方案 / Select plan
1. Coding Plan         推荐 / Recommended
2. 自定义 / Custom

请选择云服务商 / Select provider
1. 阿里云百炼
2. 火山引擎
3. 腾讯云
4. 百度千帆
5. 联通云

连接地址 / Endpoint: https://coding.dashscope.aliyuncs.com/v1 (示例)

请选择模型 / Select model
1. qwen3.5-plus
2. qwen3-coder-next
...

请输入 API Key...

请选择通道 / Select channel
1. Telegram
2. Feishu

请输入 Telegram Bot Token / Enter Telegram Bot Token
```

### Coding Plan 云服务商说明

选择 Coding Plan 后，可选择以下云服务商：

- **阿里云百炼**：默认推荐，预置 URL `https://coding.dashscope.aliyuncs.com/v1`
- **火山引擎**：预置 URL `https://ark.cn-beijing.volces.com/api/coding/v3`
- **腾讯云**：预置 URL `https://api.lkeap.cloud.tencent.com/coding/v3`
- **百度千帆**：预置 URL `https://qianfan.baidubce.com/v2/coding`
- **联通云**：预置 URL `https://aigw-gzgy2.cucloud.cn:8443/v1`
- **自定义**：完全手动填写 URL、模型、API Key

### 安装后行为

- **交互式终端**：安装完成后自动进入引导流程
- **非交互式终端**（如 SSH）：安装完成后显示下一步命令 `weiclaw setup --bootstrap`

### TUI 自动打开行为

- **适合自动打开 TUI 的环境**：本地交互终端
- **不适合自动打开的环境**：SSH 远程、Termux 手机终端等，会显示提示信息

### Linux 后台运行

- **自动后台运行**：Linux 系统上，引导流程完成后自动安装 systemd user service
- **关闭终端后服务继续运行**：通过 systemd linger 实现，关闭 SSH/终端后服务仍在后台运行
- **服务状态**：可通过 `weiclaw status` 查看服务状态
- **手动管理**：

  ```bash
  # 查看服务状态
  systemctl --user status weiclaw

  # 重启服务
  systemctl --user restart weiclaw

  # 停止服务
  systemctl --user stop weiclaw
  ```

### 通道配置

- **Telegram**：只需 Bot Token，最轻量
  - **自动 webhook 清理**：使用 polling 模式时自动检测并清理残留 webhook，避免"服务活着但机器人不回话"
- **Feishu/Lark**：需要 App ID + App Secret，引导流程中可选
  - **自动处理已存在插件**：如果插件目录已存在，自动使用更新模式安装

## 常用命令

```bash
# 启动 Gateway
npm run start

# 重新执行引导配置
weiclaw setup --bootstrap

# 打开终端界面
weiclaw tui

# 查看状态
weiclaw status

# 健康检查与修复
weiclaw doctor

# 高级配置
weiclaw configure

# 高级引导（完整功能）
weiclaw onboard
```

`openclaw` 作为兼容别名保留，与 `weiclaw` 等效。

## 升级方式

### 重新安装（推荐）

```bash
# 国际网络
curl -fsSL https://raw.githubusercontent.com/zylzyqzz/WeiClaw/main/scripts/bootstrap/install.sh | bash

# 中国大陆
curl -fsSL https://cdn.jsdelivr.net/gh/zylzyqzz/WeiClaw@main/scripts/bootstrap/install.sh | bash
```

安装器会自动处理升级。

### 手动指定 runtime 包

```bash
WEICLAW_INSTALL_TARBALL="https://github.com/zylzyqzz/WeiClaw/releases/latest/download/weiclaw-runtime.tgz" bash -c "$(curl -fsSL https://cdn.jsdelivr.net/gh/zylzyqzz/WeiClaw@main/scripts/bootstrap/install.sh)"
```

## 故障排查

### GitHub 下载慢 / 失败

安装器内置自动回退：

1. 官方 GitHub Release
2. ghproxy.net 代理（适合中国大陆）
3. 源码克隆（最终兜底）

如遇网络问题，安装器会自动切换，无需手动操作。

### 引导流程被取消怎么办

```bash
weiclaw setup --bootstrap
```

### 版本显示不对

```bash
weiclaw --version
```

如版本不对，可能是旧版残留，重新执行安装即可。

### npm run start 报 package.json not found

WeiClaw 默认通过全局安装的 runtime 包运行，不需要在项目目录下执行。

如果需要在开发目录下运行：

```bash
npm run start
```

### 如何重新执行引导

```bash
weiclaw setup --bootstrap
```

## 当前限制

- **jsDelivr**：仅作为脚本入口的备用源，不可直接镜像 runtime .tgz 包
- **npm fallback**：尚未发布 `@weiclaw/runtime` 到 npm，暂不作为默认回退链
- **国内分发**：依赖 GitHub Release + ghproxy.net 第三方公共服务

## Roadmap

- [ ] 发布 @weiclaw/runtime 到 npm（更稳定的回退源）
- [ ] 更稳定的国内分发源
- [ ] Feishu/Lark 通道完善
- [ ] 更多模型接入

## License / Attribution

WeiClaw 基于 [OpenClaw](https://github.com/stealth/Claude-Code) 改造，保留上游开源协议与归属声明。

保留文件：

- `LICENSE`
- `NOTICE.md`
- 上游归属声明
