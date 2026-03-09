# WeiClaw-AgentOS Extension Guide

本指南用于扩展动态角色系统，不涉及私有资产或云侧复杂依赖。

## 1) 扩展一个角色

### 创建角色

```bash
pnpm agentos -- create-role \
  --id qa \
  --name "QA" \
  --description "Quality gate" \
  --goals "prevent regressions" \
  --system-instruction "Review output quality and edge cases" \
  --input-contract "task goal + constraints" \
  --output-contract "qa findings + risks + acceptance" \
  --capabilities qa,review \
  --memory-layers short-term,long-term \
  --memory-scopes session:*,entity:*
```

### 校验角色

```bash
pnpm agentos -- validate-role --id qa
```

### 导出/导入角色

```bash
pnpm agentos -- export-role --id qa --file /tmp/qa-role.json
pnpm agentos -- import-role --file /tmp/qa-role.json --overwrite true
```

## 2) 扩展一个 preset

### 创建 preset

```bash
pnpm agentos -- create-preset \
  --id qa-gate \
  --name "QA Gate" \
  --roles planner,qa,reviewer \
  --order planner,qa,reviewer \
  --task-types qa,review
```

### 校验 preset

```bash
pnpm agentos -- validate-preset --id qa-gate
```

## 3) 调整路由策略

路由由 runtime config 的 `routing` 驱动：

- `taskTypeRules`：任务类型映射
- `capabilityKeywords`：关键词映射
- `weights`：评分权重
- `maxDynamicRoles`：动态选择数量上限

优先级固定：

1. `run --roles`（最高）
2. `run --preset`
3. dynamic route（兜底）

## 4) 调试路由

推荐命令：

```bash
pnpm agentos -- run --goal "investigate failure" --task-type research --preset "" --json
```

重点观察字段：

- `routeSummary`
- `selectedRoles`
- `selectionReasons`

## 5) 调试记忆

```bash
pnpm agentos -- inspect-memory --session local-main
pnpm agentos -- inspect-memory --session local-main --layer long-term --json
```

重点观察：

- `result.summary.total`
- `result.summary.byLayer`
- `result.records[*].scope`
