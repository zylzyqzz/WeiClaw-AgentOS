# WeiClaw-AgentOS Getting Started

## 目标

在 5 分钟内跑通一个可解释的多角色 demo，并拿到机器可读 JSON。

## 前置条件

- Node 22+
- pnpm

## 1. 安装依赖

```bash
pnpm install
```

## 2. 快速健康检查

```bash
pnpm tsgo
pnpm exec vitest run test/agentos/*.test.ts
```

## 3. 跑第一个 demo

```bash
pnpm agentos -- demo
```

你会看到：

- 路由摘要 `routeSummary`
- 角色选择 `selectedRoles`
- 选择理由 `selectionReasons`
- 结构化结论 `conclusion/plan/risks/acceptance`

## 4. 查看角色与预设

```bash
pnpm agentos -- list-roles
pnpm agentos -- list-presets
pnpm agentos -- inspect-preset --id default-demo
```

## 5. 查看记忆写入

```bash
pnpm agentos -- inspect-memory --session demo-main
```

## 6. 切换机器可读输出

```bash
pnpm agentos -- demo --json
pnpm agentos -- run --goal "生成发布检查清单" --preset default-demo --json
```

JSON 契约文档：`docs/cli-schema.md`

## 下一步

- CLI 详细说明：`docs/cli-usage.md`
- 示例任务：`docs/examples.md`
- 架构细节：`docs/architecture.md`
