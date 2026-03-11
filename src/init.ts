import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { copyTextFile } from "./fs-utils.js";
import type { InitResult } from "./types.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function templatePath(...parts: string[]): string {
  return path.join(packageRoot, "templates", ...parts);
}

function schemaPath(): string {
  return path.join(packageRoot, "schema", "runtime-control-plane.schema.json");
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
      source: schemaPath(),
      destination: path.join(targetDir, "testops", "runtime-control-plane.schema.json"),
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
