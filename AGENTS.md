# WeiClaw-AgentOS

## Project identity

公开仓：WeiClaw-AgentOS
目标：建设 v2.1.0 多智能体 + 长久记忆 本地优先系统
禁止写入：API key、私有提示词资产、商业机密、私有工作流

## Working mode

- 不要先问问题，先扫描仓库，再直接落地
- 如果仓库接近空仓，直接初始化
- 不要只讲方案，必须创建/修改文件
- 每轮结束输出：已完成内容、文件列表、下一步
- 不要执行 git push
- 沿用现有技术栈；若仓库为空，优先 TypeScript + Node 20 + pnpm
- 本地优先，先单机可跑

## MVP scope

先实现：

- orchestrator
- agent registry
- session store
- memory manager
- config loader
- CLI entry

核心类型至少包括：

- AgentDefinition
- TaskRequest
- TaskResult
- SessionState
- MemoryRecord
- OrchestratorConfig

记忆先做三层：

- short-term session memory
- long-term summarized memory
- project/entity memory

存储优先：

- SQLite
- 如初始化受阻，可先 file-based fallback，但接口必须抽象好

CLI 至少提供：

- run
- chat
- inspect-memory
- list-agents

Demo 先做 4 个角色：

- commander
- planner
- builder
- reviewer

## Output contract

最终任务输出尽量结构化为：

- conclusion
- plan
- risks
- acceptance

## File targets

优先创建或完善：

- README.md
- docs/architecture.md
- docs/roadmap.md
- src/cli/
- src/core/orchestrator/
- src/core/session/
- src/core/config/
- src/agents/
- src/memory/
- src/storage/
- src/types/
- tests/

## Quality bar

- 禁止 TODO 伪代码
- 尽量给真实实现
- 补基础测试、日志、错误处理
- 不做花哨前端
- 不做分布式
- 不引入不必要依赖
