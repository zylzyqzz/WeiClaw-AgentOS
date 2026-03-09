import { describe, expect, it } from "vitest";
import { validateRoleBundle, validatePreset } from "../../src/agentos/registry/role-validation.js";

describe("semantic lint", () => {
  it("emits policy/memory/output-contract findings for role", () => {
    const result = validateRoleBundle({
      template: {
        id: "x-template",
        name: "x",
        description: "x",
        goals: ["x"],
        systemInstruction: "x",
        inputContract: "in",
        outputContract: "out-a",
        capabilities: ["review"],
        policy: {
          enabled: true,
          maxTurns: 0,
          allowedTools: ["bash"],
          deniedTools: ["bash"],
          constraints: [],
        },
        memoryScope: {
          layers: ["long-term"],
          scopes: ["*"],
          crossSessionRead: true,
        },
        enabled: true,
        version: "bad",
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      runtime: {
        id: "x",
        templateId: "x-template",
        name: "x",
        description: "x",
        capabilities: ["review"],
        policy: {
          enabled: false,
          maxTurns: 1,
          allowedTools: [],
          deniedTools: [],
          constraints: [],
        },
        memoryScope: {
          layers: ["short-term"],
          scopes: ["session:*"],
          crossSessionRead: false,
        },
        enabled: true,
        version: "1.0.0",
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(result.valid).toBe(false);
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain("POLICY_TOOL_CONFLICT");
    expect(codes).toContain("POLICY_MAX_TURNS_INVALID");
    expect(codes).toContain("VERSION_INVALID");
    expect(codes).toContain("MEMORY_SCOPE_WIDE_LONG_TERM");
  });

  it("emits disabled role and contract mismatch for preset", () => {
    const preset = {
      id: "p",
      name: "p",
      description: "p",
      roles: ["r1", "r2"],
      order: ["r1", "r2"],
      defaultPolicy: {
        enabled: true,
        maxTurns: 3,
        allowedTools: [],
        deniedTools: [],
        constraints: [],
      },
      taskTypes: ["review"],
      tags: [],
      enabled: true,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = validatePreset(preset, [
      {
        id: "r1",
        enabled: false,
        capabilities: ["review"],
        outputContract: "a",
        policy: { enabled: true, maxTurns: 3, allowedTools: [], deniedTools: [], constraints: [] },
      },
      {
        id: "r2",
        enabled: true,
        capabilities: ["planning"],
        outputContract: "b",
        policy: { enabled: true, maxTurns: 3, allowedTools: [], deniedTools: [], constraints: [] },
      },
    ]);

    expect(result.valid).toBe(false);
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain("PRESET_DISABLED_ROLE");
    expect(codes).toContain("PRESET_OUTPUT_CONTRACT_INCOMPATIBLE");
  });
});
