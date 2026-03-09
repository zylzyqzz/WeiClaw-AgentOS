import { readFile, writeFile } from "node:fs/promises";
import type { RoleBundle } from "../types.js";

export async function writeRoleBundleJson(filePath: string, bundle: RoleBundle): Promise<void> {
  await writeFile(filePath, JSON.stringify(bundle, null, 2), "utf8");
}

export async function readRoleBundleJson(filePath: string): Promise<RoleBundle> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as RoleBundle;
}
