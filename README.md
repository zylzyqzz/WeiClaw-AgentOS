# WeiClaw-AgentOS

WeiClaw-AgentOS 是一个**本地优先（local-first）**的多智能体执行内核，核心路线是：

- **动态角色系统（Dynamic Roles）**
- **长久记忆（Durable Memory）**

目标是让你可以在本地把角色编排、路由决策、结构化输出、记忆沉淀跑通，并且能被上层系统稳定接入。

## 项目定位

适合：

- 需要可扩展多角色执行流的工程团队
- 需要稳定 CLI JSON 契约的集成方
- 需要“可解释路由 + 可审计记忆”的本地系统

不适合：

- 期望开箱即用的复杂云编排平台
- 期望可视化前端工作台（本仓当前不做前端大工程）

## 当前版本状态

- **状态**：`v2.1.0-alpha`（正在收口至 `v2.1.0-rc.1`）
- **能力等级**：动态角色 + preset + 路由配置化 + JSON 契约 + 三层记忆
- **兼容说明**：`.weiclaw-agentos.json` 已 deprecated，仅用于一次性迁移

## 核心能力

- 动态角色模型：`RoleTemplate` + `RuntimeAgent`
- 角色生命周期：create/update/enable/disable/delete/import/export/validate
- preset 生命周期：create/update/delete/import/export/validate
- 路由优先级：`--roles` > `--preset` > dynamic route
- 路由可解释：`routeSummary` / `selectedRoles` / `selectionReasons`
- 机器可读输出：`--json` + 统一错误对象 + 稳定 exit code
- 本地存储：SQLite 优先，文件 fallback
- 三层记忆：`short-term` / `long-term` / `project-entity`

## 核心概念

- `RoleTemplate`：角色模板。定义职责、目标、输入输出契约、默认策略。
- `RuntimeAgent`：运行时实例。由模板实例化，可启用/禁用/更新。
- `Preset`：预设组合。定义角色集合、顺序、默认策略、适用任务类型。
- `Orchestrator`：编排与路由核心。按优先级选择执行角色并输出结构化结果。
- `Memory layers`：记忆分层。会话短记忆、长期摘要记忆、项目实体记忆。

## 快速开始（5 分钟）

前置：Node 22+、pnpm。

```bash
pnpm install
pnpm tsgo
```

第一轮验证：

```bash
pnpm agentos -- demo
pnpm agentos -- list-roles
pnpm agentos -- list-presets
pnpm agentos -- inspect-memory --session demo-main
```

JSON 接入验证：

```bash
pnpm agentos -- run --goal "生成 alpha 发布检查清单" --preset default-demo --json
```

## 最小 Demo（推荐）

### Demo 命令

```bash
pnpm agentos -- demo
```

默认会触发 preset 路由，并输出：

- `routeSummary`
- `selectedRoles`
- `selectionReasons`
- `conclusion/plan/risks/acceptance`

### 强制显式角色

```bash
pnpm agentos -- run --goal "评审当前实现风险" --roles planner,reviewer
```

### 动态路由兜底

```bash
pnpm agentos -- run --goal "调查并制定修复方案" --task-type research --required-capabilities research,review --preset ""
```

## CLI 常用命令

```bash
# 角色
pnpm agentos -- list-roles
pnpm agentos -- inspect-role --id planner
pnpm agentos -- create-role --id qa --name QA --capabilities qa,review
pnpm agentos -- validate-role --id qa

# 预设
pnpm agentos -- list-presets
pnpm agentos -- inspect-preset --id default-demo
pnpm agentos -- create-preset --id qa-only --roles reviewer --order reviewer --task-types qa,review
pnpm agentos -- validate-preset --id qa-only

# 运行
pnpm agentos -- run --goal "实现动态路由" --preset default-demo
pnpm agentos -- run --goal "仅按角色执行" --roles planner,builder

# 记忆
pnpm agentos -- inspect-memory --session local-main
pnpm agentos -- inspect-memory --session local-main --layer long-term
```

兼容别名：`list-agents`（建议优先使用 `list-roles`）。

## JSON 输出示例

```json
{
  "ok": true,
  "command": "run",
  "version": "2.1.0-alpha",
  "routeSummary": "preset route (default-demo)",
  "selectedRoles": ["commander", "planner", "builder", "reviewer"],
  "selectionReasons": ["priority: preset (second)", "preset selected: default-demo"],
  "result": {
    "conclusion": "..."
  },
  "metadata": {
    "generatedAt": "2026-03-09T00:00:00.000Z"
  }
}
```

更多契约细节见：`docs/cli-schema.md`。

## 文档入口

- 架构：`docs/architecture.md`
- 路线图：`docs/roadmap.md`
- 快速上手：`docs/getting-started.md`
- CLI 使用：`docs/cli-usage.md`
- 示例任务：`docs/examples.md`
- 扩展指南：`docs/extension-guide.md`
- JSON 契约：`docs/cli-schema.md`

## 已知限制

- 当前执行输出为规则编排与结构化文本结果，不是复杂分布式执行引擎。
- 记忆策略为 alpha 版本，聚焦可观察与可追踪，不追求高级压缩算法。
- 路由是可配置评分策略，不是学习型智能路由器。
- `chat` 适合本地调试，不建议当作生产协议层。

## 开发者扩展入口

- 扩展角色：`create-role` / `update-role` / `import-role`
- 扩展 preset：`create-preset` / `update-preset` / `import-preset`
- 调整路由策略：编辑运行配置中的 `routing`（taskTypeRules/capabilityKeywords/weights）
- 接入上层系统：优先使用 `--json`，按 `docs/cli-schema.md` 解析

## 公开仓 / 私有仓边界

本仓仅包含公开实现与示例能力，不包含任何私有密钥、私有提示词资产、商业机密、私有工作流。

## 贡献与质量门槛

提交前建议至少执行：

```bash
pnpm tsgo
pnpm exec vitest run test/agentos/*.test.ts
```
