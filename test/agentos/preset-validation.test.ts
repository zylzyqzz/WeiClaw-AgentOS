import { describe, expect, it } from "vitest";
import { validatePreset } from "../../src/agentos/registry/role-validation.js";
import { defaultDemoPresets } from "../../src/agentos/runtime/defaults.js";

describe("preset validation", () => {
  it("validates default demo preset", () => {
    const presets = defaultDemoPresets();
    const preset = presets["default-demo"];
    const check = validatePreset(preset, [
      {
        id: "commander",
        enabled: true,
        capabilities: ["coordination", "planning"],
        outputContract: "a",
        policy: { enabled: true, maxTurns: 6, allowedTools: [], deniedTools: [], constraints: [] },
      },
      {
        id: "planner",
        enabled: true,
        capabilities: ["planning", "research"],
        outputContract: "a",
        policy: { enabled: true, maxTurns: 6, allowedTools: [], deniedTools: [], constraints: [] },
      },
      {
        id: "builder",
        enabled: true,
        capabilities: ["build", "ops"],
        outputContract: "a",
        policy: { enabled: true, maxTurns: 6, allowedTools: [], deniedTools: [], constraints: [] },
      },
      {
        id: "reviewer",
        enabled: true,
        capabilities: ["review", "qa"],
        outputContract: "a",
        policy: { enabled: true, maxTurns: 6, allowedTools: [], deniedTools: [], constraints: [] },
      },
    ]);
    expect(check.valid).toBe(true);
  });

  it("detects semantic preset issues", () => {
    const preset = {
      id: "bad",
      name: "bad",
      description: "bad",
      roles: ["unknown-role"],
      order: ["unknown-role", "unknown-role"],
      defaultPolicy: {
        enabled: true,
        maxTurns: 6,
        allowedTools: ["bash"],
        deniedTools: ["bash"],
        constraints: [],
      },
      taskTypes: ["review"],
      tags: [],
      enabled: true,
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const check = validatePreset(preset, []);
    expect(check.valid).toBe(false);
    const codes = check.findings.map((x) => x.code);
    expect(codes).toContain("PRESET_ROLE_MISSING");
    expect(codes).toContain("PRESET_ORDER_DUPLICATE");
    expect(codes).toContain("PRESET_CAPABILITY_MISSING");
  });
});
