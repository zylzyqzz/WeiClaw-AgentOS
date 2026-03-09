# WeiClaw-AgentOS Examples

## Sample Task Catalog

### A. 需求拆解与执行计划

```bash
pnpm agentos -- run --goal "把 v2.1.0-alpha 收口成 rc 候选" --preset default-demo
```

预期：`planner` 和 `commander` 给出结构化计划与结论。

### B. 代码构建与风险审查

```bash
pnpm agentos -- run --goal "实现并评审一条新 CLI 路由" --roles builder,reviewer
```

预期：`builder` 产出实现路径，`reviewer` 产出风险与验收点。

### C. 动态路由（不指定 preset）

```bash
pnpm agentos -- run --goal "调查异常并给出修复方案" --task-type research --required-capabilities research,review --preset ""
```

预期：系统按能力与权重选择角色，并输出 `selectionReasons`。

### D. 记忆观察

```bash
pnpm agentos -- demo
pnpm agentos -- inspect-memory --session demo-main
pnpm agentos -- inspect-memory --session demo-main --layer long-term
```

预期：看到 short-term / long-term / project-entity 的写入记录与汇总。

### E. JSON 集成 smoke test

```bash
pnpm agentos -- demo --json
pnpm agentos -- validate-preset --id default-demo --json
```

预期：顶层均为统一 envelope（`ok/command/version/result/error/metadata`）。
