import { describe, expect, it } from "vitest";
import { validatePreset } from "../../src/agentos/registry/role-validation.js";
import { defaultDemoPresets } from "../../src/agentos/runtime/defaults.js";

describe("preset validation", () => {
  it("validates default demo preset", () => {
    const presets = defaultDemoPresets();
    const preset = presets["default-demo"];
    const check = validatePreset(preset, ["commander", "planner", "builder", "reviewer"]);
    expect(check.valid).toBe(true);
  });

  it("detects missing role references in preset", () => {
    const preset = {
      id: "bad",
      name: "bad",
      description: "bad",
      roleOrder: ["unknown-role"],
      defaultStrategy: "balanced",
      taskTypes: ["general"],
      tags: [],
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const check = validatePreset(preset, ["commander"]);
    expect(check.valid).toBe(false);
    expect(check.issues.map((x) => x.message).join(" ")).toContain("missing roles");
  });
});
