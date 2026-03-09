# WeiClaw-AgentOS CLI Usage

## 命令分组

### 运行

- `demo [--goal <text>] [--preset <id>] [--session <id>]`
- `run --goal <text> [--roles a,b] [--preset <id>] [--task-type <type>] [--required-capabilities a,b] [--preferred-roles a,b] [--excluded-roles a,b]`
- `chat [--roles a,b] [--preset <id>]`

### 角色（RoleTemplate/RuntimeAgent）

- `list-roles`
- `inspect-role --id <roleId>`
- `create-role --id <roleId> ...`
- `update-role --id <roleId> ...`
- `enable-role --id <roleId>`
- `disable-role --id <roleId>`
- `delete-role --id <roleId>`
- `export-role --id <roleId> --file <path.json>`
- `import-role --file <path.json> [--overwrite true|false]`
- `validate-role --id <roleId> | --file <path.json>`

### 预设（Preset）

- `list-presets`
- `inspect-preset --id <presetId>`
- `create-preset --id <presetId> --roles a,b --order a,b`
- `update-preset --id <presetId> ...`
- `delete-preset --id <presetId>`
- `export-preset --id <presetId> --file <path.json>`
- `import-preset --file <path.json> [--overwrite true|false]`
- `validate-preset --id <presetId> | --file <path.json>`

### 记忆

- `inspect-memory [--session <id>] [--layer short-term|long-term|project-entity]`

兼容别名：`list-agents`（建议优先使用 `list-roles`）。

## 常见用法

### 1) 强制角色执行

```bash
pnpm agentos -- run --goal "评审当前风险" --roles planner,reviewer
```

### 2) 使用预设组合

```bash
pnpm agentos -- run --goal "完成 alpha 规划" --preset default-demo
```

### 3) 动态路由兜底

```bash
pnpm agentos -- run --goal "调查性能瓶颈" --task-type research --required-capabilities research --preset ""
```

### 4) 机器可读模式

```bash
pnpm agentos -- run --goal "输出 JSON 契约" --preset default-demo --json
```

## 错误与退出码

- `0` 成功
- `1` 参数错误/未知命令/未预期错误
- `2` 校验失败（`VALIDATION_FAILED`）
- `3` 资源不存在或冲突（`NOT_FOUND`/`CONFLICT`）

错误对象结构见：`docs/cli-schema.md`
