export type MemoryLayer = "short-term" | "long-term" | "project-entity";

export type AgentCapability =
  | "planning"
  | "build"
  | "review"
  | "coordination"
  | "qa"
  | "ops"
  | "research"
  | "finance"
  | "sales"
  | (string & {});

export interface AgentPolicy {
  enabled: boolean;
  maxTurns: number;
  allowedTools: string[];
  deniedTools: string[];
  constraints: string[];
}

export interface AgentMemoryScope {
  layers: MemoryLayer[];
  scopes: string[];
  crossSessionRead: boolean;
}

export interface RoutingTaskTypeRule {
  requiredCapabilities?: AgentCapability[];
  preferredRoles?: string[];
  excludedRoles?: string[];
}

export interface RoutingWeights {
  requiredCapability: number;
  preferredRole: number;
  keywordMatch: number;
  coordinationConstraint: number;
}

export interface RoutingConfig {
  taskTypeRules: Record<string, RoutingTaskTypeRule>;
  capabilityKeywords: Record<string, string[]>;
  weights: RoutingWeights;
  maxDynamicRoles: number;
}

export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  goals: string[];
  systemInstruction: string;
  inputContract: string;
  outputContract: string;
  capabilities: AgentCapability[];
  policy: AgentPolicy;
  memoryScope: AgentMemoryScope;
  enabled: boolean;
  version: string;
  tags: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeAgent {
  id: string;
  templateId: string;
  name: string;
  description: string;
  capabilities: AgentCapability[];
  policy: AgentPolicy;
  memoryScope: AgentMemoryScope;
  enabled: boolean;
  version: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  roles: string[];
  order: string[];
  defaultPolicy: AgentPolicy;
  taskTypes: string[];
  tags: string[];
  enabled: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRequest {
  sessionId: string;
  goal: string;
  taskType?: string;
  constraints?: string[];
  context?: Record<string, unknown>;
  roles?: string[];
  preset?: string;
  requiredCapabilities?: AgentCapability[];
  preferredRoles?: string[];
  excludedRoles?: string[];
}

export interface TaskResult {
  requestId: string;
  sessionId: string;
  routeSummary: string;
  selectedRoles: string[];
  selectionReasons: string[];
  conclusion: string;
  plan: string[];
  risks: string[];
  acceptance: string[];
  roleOutputs: Array<{
    roleId: string;
    output: string;
  }>;
}

export interface SessionState {
  sessionId: string;
  activeTaskId?: string;
  status: "idle" | "running" | "completed" | "failed";
  updatedAt: string;
  meta: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  sessionId: string;
  layer: MemoryLayer;
  scope: string;
  content: string;
  summary?: string;
  sourceTaskId?: string;
  createdAt: string;
}

export interface OrchestratorConfig {
  storagePath: string;
  fallbackPath: string;
  defaultSessionId: string;
  projectName: string;
  logLevel: "debug" | "info" | "warn" | "error";
  defaultPreset: string;
  presets: Record<string, PresetDefinition>;
  roleTemplates?: RoleTemplate[];
  runtimeAgents?: RuntimeAgent[];
  routing: RoutingConfig;
}

export interface MemoryQuery {
  sessionId?: string;
  layer?: MemoryLayer;
  scope?: string;
  limit?: number;
}

export interface LintFinding {
  level: "error" | "warning";
  code: string;
  message: string;
  target: string;
}

export interface LintResult {
  valid: boolean;
  findings: LintFinding[];
}

export interface RoleBundle {
  template: RoleTemplate;
  runtime: RuntimeAgent;
}

export interface ConsistencyIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  fixHint?: string;
}

export interface CliEnvelope<T> {
  ok: boolean;
  command: string;
  version: string;
  metadata: Record<string, unknown>;
  result?: T;
  lintFindings?: LintFinding[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
