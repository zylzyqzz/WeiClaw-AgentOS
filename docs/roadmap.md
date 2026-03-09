# WeiClaw-AgentOS Roadmap

## v2.1.0 alpha (current)

- dynamic role model (`RoleTemplate` + `RuntimeAgent`)
- role lifecycle closed loop (create/update/enable/disable/delete/import/export/validate)
- preset lifecycle closed loop (create/update/delete/import/export/validate)
- routing with explicit roles / preset / dynamic capability selection
- preset inspection and validation
- structured run output with route reasoning
- semantic lint findings (`level/code/message/target`)
- machine-readable CLI mode (`--json` + unified error payload/exit codes)
- local-first persistence (SQLite primary, file fallback)

## Next

- preset editing and persistence workflow from CLI
- richer role validation semantics (tool policy and memory scope linting)
- stronger dynamic routing scoring and explainability
- broader error recovery coverage

## Later

- role version migration helpers
- memory lifecycle operations (prune/archive/import)
- higher-scale profiling for larger dynamic role graphs
