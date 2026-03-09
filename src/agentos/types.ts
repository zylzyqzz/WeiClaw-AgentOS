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
  roleOrder: string[];
  defaultStrategy: string;
  taskTypes: string[];
  tags: string[];
  enabled: boolean;
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
}

export interface MemoryQuery {
  sessionId?: string;
  layer?: MemoryLayer;
  scope?: string;
  limit?: number;
}

export interface RoleValidationIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export interface RoleValidationResult {
  valid: boolean;
  issues: RoleValidationIssue[];
}

export interface RoleBundle {
  template: RoleTemplate;
  runtime: RuntimeAgent;
}
