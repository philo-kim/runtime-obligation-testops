import type { RuntimeControlPlane, Surface } from "../types.js";

export interface VitestWorkspaceOptions {
  aliases?: Record<string, string>;
}

function renderArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function renderAliases(aliases: Record<string, string>): string[] {
  const entries = Object.entries(aliases);
  if (entries.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push('import path from "node:path";');
  lines.push("");
  lines.push("const alias = {");

  for (const [key, value] of entries) {
    lines.push(`  ${JSON.stringify(key)}: path.resolve(process.cwd(), ${JSON.stringify(value)}),`);
  }

  lines.push("};");
  lines.push("");

  return lines;
}

function vitestSurfaces(controlPlane: RuntimeControlPlane): Surface[] {
  return controlPlane.surfaces.filter((surface) => surface.execution?.runner === "vitest");
}

export interface VitestProjectConfig {
  test: {
    name: string;
    environment: string;
    setupFiles: string[];
    include: string[];
    exclude?: string[];
    testTimeout?: number;
    globals: boolean;
  };
  resolve?: {
    alias: Record<string, string>;
  };
}

export function buildVitestWorkspaceProjects(
  controlPlane: RuntimeControlPlane,
  options: VitestWorkspaceOptions = {},
): VitestProjectConfig[] {
  const surfaces = vitestSurfaces(controlPlane);
  if (surfaces.length === 0) {
    throw new Error("No surfaces with execution.runner='vitest' were found");
  }

  return surfaces.map((surface) => {
    const execution = surface.execution ?? {};
    const environment = execution.environment ?? "node";
    const setupFiles = execution.setupFiles ?? [];
    const include = execution.include ?? surface.testPatterns;
    const exclude = execution.exclude ?? [];

    return {
      test: {
        name: surface.id,
        environment,
        setupFiles,
        include,
        ...(exclude.length > 0 ? { exclude } : {}),
        ...(execution.testTimeout ? { testTimeout: execution.testTimeout } : {}),
        globals: true,
      },
      ...(options.aliases && Object.keys(options.aliases).length > 0
        ? {
            resolve: {
              alias: Object.fromEntries(
                Object.entries(options.aliases).map(([key, value]) => [key, value]),
              ),
            },
          }
        : {}),
    };
  });
}

export function generateVitestWorkspace(
  controlPlane: RuntimeControlPlane,
  options: VitestWorkspaceOptions = {},
): string {
  const surfaces = vitestSurfaces(controlPlane);
  if (surfaces.length === 0) {
    throw new Error("No surfaces with execution.runner='vitest' were found");
  }

  const lines: string[] = [];
  lines.push('import { defineWorkspace } from "vitest/config";');
  lines.push("");
  lines.push(...renderAliases(options.aliases ?? {}));
  lines.push("export default defineWorkspace([");

  for (const surface of surfaces) {
    const execution = surface.execution ?? {};
    const environment = execution.environment ?? "node";
    const setupFiles = execution.setupFiles ?? [];
    const include = execution.include ?? surface.testPatterns;
    const exclude = execution.exclude ?? [];

    lines.push("  {");
    lines.push("    test: {");
    lines.push(`      name: ${JSON.stringify(surface.id)},`);
    lines.push(`      environment: ${JSON.stringify(environment)},`);
    lines.push(`      setupFiles: ${renderArray(setupFiles)},`);
    lines.push(`      include: ${renderArray(include)},`);
    if (exclude.length > 0) {
      lines.push(`      exclude: ${renderArray(exclude)},`);
    }
    if (execution.testTimeout) {
      lines.push(`      testTimeout: ${execution.testTimeout},`);
    }
    lines.push("      globals: true,");
    lines.push("    },");
    if (options.aliases && Object.keys(options.aliases).length > 0) {
      lines.push("    resolve: { alias },");
    }
    lines.push("  },");
  }

  lines.push("]);");

  return lines.join("\n");
}
