# WeiClaw-AgentOS CLI JSON Schema (v2.1.0-alpha)

WeiClaw-AgentOS core CLI commands support `--json` with a stable envelope for integration.

## Envelope

```json
{
  "ok": true,
  "command": "run",
  "version": "2.1.0-alpha",
  "routeSummary": "dynamic capability route",
  "selectedRoles": ["planner", "reviewer"],
  "selectionReasons": ["priority: dynamic route (fallback)"],
  "result": {},
  "lintFindings": [],
  "error": null,
  "metadata": {
    "generatedAt": "2026-03-09T00:00:00.000Z"
  }
}
```

Field conventions:

- `ok`: `true` on success, `false` on failure
- `command`: executed command name (`run`, `validate-role`, `list-presets`, etc.)
- `version`: AgentOS CLI schema version
- `routeSummary` / `selectedRoles` / `selectionReasons`: populated for route-related outputs, omitted for non-route commands
- `result`: command payload
- `lintFindings`: semantic lint findings for `validate-role` / `validate-preset` and lifecycle commands that run lint
- `error`: present on failures
- `metadata`: stable integration metadata (`generatedAt`, optional `consistencyIssues`, `exitCode`)

## Error object

```json
{
  "ok": false,
  "command": "validate-preset",
  "version": "2.1.0-alpha",
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "preset validation failed",
    "details": {
      "valid": false,
      "findings": []
    }
  },
  "metadata": {
    "generatedAt": "2026-03-09T00:00:00.000Z",
    "exitCode": 2
  }
}
```

## Exit code contract

- `0`: success
- `1`: bad request / unknown command / unexpected error
- `2`: validation failed (`VALIDATION_FAILED`)
- `3`: not found / conflict (`NOT_FOUND`, `CONFLICT`)

## Commands with stable `--json`

- `run`
- `validate-role`
- `validate-preset`
- `inspect-role`
- `inspect-preset`
- `list-roles` (and alias `list-agents`)
- `list-presets`

