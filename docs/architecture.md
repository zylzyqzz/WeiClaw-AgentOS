# WeiClaw-AgentOS Architecture

## Core model

WeiClaw-AgentOS is a **dynamic-role + durable-memory** local-first runtime.

- `RoleTemplate` = 角色模板（稳定职责定义）
- `RuntimeAgent` = 运行时实例（可启停、可升级、可路由）
- `Preset` = 预设组合（角色顺序、策略、适用任务类型）
- `AgentRegistry` = 角色注册中心（模板与运行时实例生命周期）

`commander / planner / builder / reviewer` only exist as default demo preset seed and are not hardcoded runtime dependencies.

## Single runtime tree

`src/agentos/*` is the runtime implementation source:

- `types.ts`
- `config/loader.ts`
- `storage/*`
- `repository/agentos-repository.ts`
- `registry/*`
- `session/session-store.ts`
- `memory/memory-manager.ts`
- `orchestrator/orchestrator.ts`
- `runtime/*`

CLI entry: `src/cli/agentos.ts`

## Persistence model (source of truth)

- Runtime source-of-truth: `AgentOsStorage` (`SQLite` first, file fallback).
- Persisted domains: `RoleTemplate`, `RuntimeAgent`, `Preset`, runtime config patch, migration metadata.
- Deprecated compatibility input: `.weiclaw-agentos.json` (migration source only, not active runtime writer).

Startup flow:

1. load base defaults from `config/loader.ts`
2. run one-time legacy migration in `AgentOsRepository`
3. merge persisted runtime config patch and persisted presets
4. run consistency checks and surface findings

Consistency findings include:

- `level`
- `code`
- `message`
- `fixHint`

## Routing order and decision

Routing order is strict:

1. explicit roles (`run --roles`)
2. preset (`run --preset`)
3. dynamic route fallback

Dynamic route is config-driven by `OrchestratorConfig.routing`:

- `taskTypeRules`
- `capabilityKeywords`
- `weights`
- `maxDynamicRoles`

Decision explainability fields:

- `routeSummary`
- `selectedRoles`
- `selectionReasons`

## Memory model

Three layers are currently written on each successful run:

- `short-term` session goal trace
- `long-term` summarized conclusion
- `project-entity` project-level completion note

Current scope:

- focused on observability and local debugging
- not a full memory compression pipeline

Inspectability:

- `inspect-memory` returns `records + summary`
- layer filtering supported via `--layer`

## CLI and JSON contract

Core machine-readable commands support `--json` with unified envelope.

See authoritative schema contract: `docs/cli-schema.md`

Exit code contract:

- `0` success
- `1` generic/bad-request/unexpected
- `2` validation failure
- `3` not-found/conflict

## Document authority

Authoritative docs:

- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/cli-schema.md`

`docs/agentos/*` files are supplemental/archive context and must not conflict with authoritative docs.
