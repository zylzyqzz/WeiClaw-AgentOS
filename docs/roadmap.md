# WeiClaw-AgentOS Roadmap

## v2.1.0 alpha (current baseline)

- dynamic role model (`RoleTemplate` + `RuntimeAgent`)
- role lifecycle closed loop (create/update/enable/disable/delete/import/export/validate)
- preset lifecycle closed loop (create/update/delete/import/export/validate)
- routing with explicit roles / preset / dynamic capability selection
- route explanation output (`routeSummary/selectedRoles/selectionReasons`)
- semantic lint findings (`level/code/message/target`)
- machine-readable CLI envelope (`--json`, unified error payload/exit codes)
- local-first persistence source-of-truth (SQLite primary, file fallback, legacy migration)

## RC focus (toward v2.1.0-rc.1)

- docs consistency and onboarding clarity
- CLI ergonomics and self-explanatory help/error paths
- JSON contract stability and regression coverage
- routing/memory debugability and maintenance readability
- repository hygiene (terminology and legacy boundaries)

## Post-RC candidates

- role version migration helpers
- memory lifecycle ops (prune/archive/import)
- broader load/perf profiling on larger role graphs
