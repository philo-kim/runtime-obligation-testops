import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyTextFile } from "./fs-utils.js";
import type { InitResult } from "./types.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function templatePath(...parts: string[]): string {
  return path.join(packageRoot, "templates", ...parts);
}

function schemaPath(fileName: string): string {
  return path.join(packageRoot, "schema", fileName);
}

export function initWorkspace(
  targetDir: string,
  preset: "base" | "vitest" = "base",
  force = false,
): InitResult {
  const result: InitResult = {
    written: [],
    skipped: [],
  };

  const files = [
    {
      source: templatePath("base", "runtime-control-plane.json"),
      destination: path.join(targetDir, "testops", "runtime-control-plane.json"),
    },
    {
      source: templatePath("base", "runtime-inventory.json"),
      destination: path.join(targetDir, "testops", "runtime-inventory.json"),
    },
    {
      source: templatePath("base", "runtime-surfaces.json"),
      destination: path.join(targetDir, "testops", "runtime-surfaces.json"),
    },
    {
      source: templatePath("base", "fidelity-policy.json"),
      destination: path.join(targetDir, "testops", "fidelity-policy.json"),
    },
    {
      source: templatePath("base", "runtime-discovery-policy.json"),
      destination: path.join(targetDir, "testops", "runtime-discovery-policy.json"),
    },
    {
      source: templatePath("base", "runtime-quality-policy.json"),
      destination: path.join(targetDir, "testops", "runtime-quality-policy.json"),
    },
    {
      source: templatePath("base", "runtime-self-check-policy.json"),
      destination: path.join(targetDir, "testops", "runtime-self-check-policy.json"),
    },
    {
      source: templatePath("base", "runtime-retrospective.json"),
      destination: path.join(targetDir, "testops", "runtime-retrospective.json"),
    },
    {
      source: schemaPath("runtime-control-plane.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-control-plane.schema.json"),
    },
    {
      source: schemaPath("runtime-inventory.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-inventory.schema.json"),
    },
    {
      source: schemaPath("runtime-surfaces.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-surfaces.schema.json"),
    },
    {
      source: schemaPath("fidelity-policy.schema.json"),
      destination: path.join(targetDir, "testops", "fidelity-policy.schema.json"),
    },
    {
      source: schemaPath("runtime-discovery-policy.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-discovery-policy.schema.json"),
    },
    {
      source: schemaPath("runtime-quality-policy.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-quality-policy.schema.json"),
    },
    {
      source: schemaPath("runtime-self-check-policy.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-self-check-policy.schema.json"),
    },
    {
      source: schemaPath("runtime-retrospective.schema.json"),
      destination: path.join(targetDir, "testops", "runtime-retrospective.schema.json"),
    },
    {
      source: templatePath("github", "testops-control.yml"),
      destination: path.join(targetDir, ".github", "workflows", "testops-control.yml"),
    },
  ];

  const rootAgentsPath = path.join(targetDir, "AGENTS.md");
  files.push({
    source: templatePath("base", "AGENTS.md"),
    destination: existsSync(rootAgentsPath)
      ? path.join(targetDir, "testops", "AGENTS.runtime-obligation-testops.md")
      : rootAgentsPath,
  });

  if (preset === "vitest") {
    files.push({
      source: templatePath("vitest", "vitest.runtime.workspace.ts"),
      destination: path.join(targetDir, "vitest.runtime.workspace.ts"),
    });
  }

  for (const file of files) {
    if (!force && existsSync(file.destination)) {
      result.skipped.push(file.destination);
      continue;
    }

    copyTextFile(file.source, file.destination);
    result.written.push(file.destination);
  }

  return result;
}
