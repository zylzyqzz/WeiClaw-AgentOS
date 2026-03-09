# WeiClaw-AgentOS CLI JSON Schema (v2.1.0-alpha)

WeiClaw-AgentOS 核心命令支持 `--json`，采用统一 envelope，便于上层系统稳定解析。

## 1. Top-level Envelope

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

### 稳定字段（Stable Contract）

- `ok: boolean`
- `command: string`
- `version: string`
- `result: unknown`
- `error?: { code: string; message: string; details?: unknown }`
- `metadata: Record<string, unknown>`

### 路由相关字段（Route Commands）

- `routeSummary?: string`
- `selectedRoles?: string[]`
- `selectionReasons?: string[]`

> 这些字段在 `run` / `demo` 等路由命令中出现；其他命令可能省略。

### 校验相关字段（Validation Commands）

- `lintFindings?: Array<{ level: "error"|"warning"; code: string; message: string; target: string }>`

## 2. Error Envelope

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

## 3. Exit Code Contract

- `0`: success
- `1`: bad request / unknown command / unexpected error
- `2`: validation failed (`VALIDATION_FAILED`)
- `3`: not found / conflict (`NOT_FOUND`, `CONFLICT`)

## 4. Command-level Result Shapes

### `run` / `demo`

`result` 关键字段：

- `requestId: string`
- `sessionId: string`
- `routeSummary: string`
- `selectedRoles: string[]`
- `selectionReasons: string[]`
- `conclusion: string`
- `plan: string[]`
- `risks: string[]`
- `acceptance: string[]`
- `roleOutputs: Array<{ roleId: string; output: string }>`

### `list-roles`

`result: Array<{ id, name, templateId, enabled, version, capabilities, maxTurns }>`

### `inspect-role`

`result: { runtime, template, effectiveCapabilities, effectivePolicy }`

### `list-presets`

`result: Array<PresetDefinition>`

### `inspect-preset`

`result: PresetDefinition`

### `validate-role` / `validate-preset`

`result: { valid: boolean; findings: LintFinding[] }`

### `inspect-memory`

`result: { records: MemoryRecord[]; summary: { total: number; byLayer: Record<string, number>; latestAt?: string } }`

## 5. 当前稳定支持 `--json` 的核心命令

- `demo`
- `run`
- `validate-role`
- `validate-preset`
- `inspect-role`
- `inspect-preset`
- `list-roles`（`list-agents` 为兼容别名）
- `list-presets`
- `inspect-memory`

## 6. 兼容性建议

- 集成方应优先依赖顶层 envelope 与 `command` 区分分支解析。
- 不要依赖人类可读模式输出（table/log 文本）。
- 建议对 `version` 做最小断言并保留向后兼容解析器。
