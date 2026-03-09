# WeiClaw-AgentOS Architecture

## Core model

WeiClaw-AgentOS alpha is a **dynamic-role + durable-memory** local-first runtime.

- `RoleTemplate` = 角色模板（稳定职责定义）
- `RuntimeAgent` = 运行时实例（可启停、可升级、可路由）
- `Preset` = 预设组合（角色顺序、策略、适用任务类型）
- `AgentRegistry` = 角色注册中心（模板与运行时实例生命周期）

`commander / planner / builder / reviewer` only exist as default demo preset seed and are not hardcoded runtime dependencies.

## Source of truth

`src/agentos/*` is the single runtime implementation tree:

- `types.ts`
- `config/loader.ts`
- `storage/*`
- `registry/*`
- `session/session-store.ts`
- `memory/memory-manager.ts`
- `orchestrator/orchestrator.ts`
- `runtime/*`

CLI entry: `src/cli/agentos.ts`

## Routing order

Task routing order is strict:

1. explicit roles (`run --roles`)
2. preset (`run --preset`)
3. dynamic capability route (`taskType/constraints/requiredCapabilities/preferredRoles/excludedRoles`)

Result contract includes:

- `routeSummary`
- `selectedRoles`
- `selectionReasons`
- `conclusion`
- `plan`
- `risks`
- `acceptance`

## Role lifecycle

Role lifecycle commands:

- `create-role`
- `update-role`
- `disable-role`
- `enable-role`
- `delete-role`
- `export-role`
- `import-role`
- `validate-role`
- `create-preset`
- `update-preset`
- `delete-preset`
- `export-preset`
- `import-preset`
- `validate-preset`

Preset commands:

- `list-presets`
- `inspect-preset`

Compatibility alias:

- `list-agents` (alias of `list-roles`)

Machine-readable mode:

- `--json` on core commands (`run`, `validate-role`, `validate-preset`, `inspect-role`, `inspect-preset`, `list-roles`, `list-presets`)
- unified error object: `{ ok: false, error: { code, message, details } }`
- stable exit codes (`0` success, `2` validation failed, `3` not found/conflict, `1` generic)

Semantic lint output:

- schema: `level` / `code` / `message` / `target`
- levels: `error` / `warning`
