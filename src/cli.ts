#!/usr/bin/env node
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_FIDELITY_POLICY_PATH,
  DEFAULT_INVENTORY_PATH,
  DEFAULT_REPORT_JSON_PATH,
  DEFAULT_REPORT_MD_PATH,
  DEFAULT_SURFACES_PATH,
} from "./constants.js";
import { generateVitestWorkspace } from "./adapters/vitest.js";
import { deriveSurfaceCatalog } from "./derivation.js";
import { writeTextFile } from "./fs-utils.js";
import { analyzeImpact } from "./impact.js";
import { initWorkspace } from "./init.js";
import { scanRuntimeInventory } from "./inventory.js";
import { loadProjectModel } from "./model.js";
import { writeReports } from "./report.js";
import { printSummary, validateControlPlane } from "./validation.js";
import type { RuntimeControlPlane } from "./types.js";

interface ParsedArgs {
  _: string[];
  flags: Map<string, string[]>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string[]>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawName, rawValue] = token.slice(2).split("=", 2);
    const values = flags.get(rawName) ?? [];

    if (rawValue !== undefined) {
      values.push(rawValue);
      flags.set(rawName, values);
      continue;
    }

    const nextToken = argv[index + 1];
    if (nextToken && !nextToken.startsWith("--")) {
      values.push(nextToken);
      flags.set(rawName, values);
      index += 1;
      continue;
    }

    values.push("true");
    flags.set(rawName, values);
  }

  return { _: positionals, flags };
}

function getFlag(parsed: ParsedArgs, name: string, fallback?: string): string | undefined {
  return parsed.flags.get(name)?.at(-1) ?? fallback;
}

function getFlagValues(parsed: ParsedArgs, name: string): string[] {
  return parsed.flags.get(name) ?? [];
}

function hasFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.has(name);
}

function resolveRoot(parsed: ParsedArgs): string {
  return path.resolve(getFlag(parsed, "root", process.cwd()) ?? process.cwd());
}

function loadControlPlane(repoRoot: string, configPath: string): RuntimeControlPlane {
  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(repoRoot, configPath);

  return JSON.parse(readFileSync(absoluteConfigPath, "utf8")) as RuntimeControlPlane;
}

function maybeWriteJson(filePath: string, value: unknown): void {
  writeTextFile(filePath, JSON.stringify(value, null, 2) + "\n");
}

function printHelp(): void {
  console.log("runtime-obligation-testops");
  console.log("");
  console.log("Commands:");
  console.log("  rotops init [--preset vitest] [--force]");
  console.log("  rotops inventory scan [--root path] [--out path]");
  console.log("  rotops surfaces derive [--root path] [--inventory path] [--out path]");
  console.log(
    "  rotops validate [--config path] [--inventory path] [--surfaces path] [--fidelity path] [--root path] [--allow-missing-annotations]",
  );
  console.log(
    "  rotops report [--config path] [--inventory path] [--surfaces path] [--fidelity path] [--root path] [--allow-missing-annotations]",
  );
  console.log(
    "  rotops impact [--config path] [--inventory path] [--surfaces path] [--fidelity path] [--root path] --changed path [--changed path]",
  );
  console.log(
    "  rotops export vitest-workspace [--config path] [--root path] [--out path] [--alias @=./src]",
  );
}

function commandInit(parsed: ParsedArgs): void {
  const targetDir = resolveRoot(parsed);
  const preset = (getFlag(parsed, "preset", "base") ?? "base") as "base" | "vitest";
  const result = initWorkspace(targetDir, preset, hasFlag(parsed, "force"));

  for (const written of result.written) {
    console.log(path.relative(targetDir, written) || ".");
  }

  for (const skipped of result.skipped) {
    console.log(`skipped ${path.relative(targetDir, skipped) || "."}`);
  }
}

function commandInventoryScan(parsed: ParsedArgs): void {
  const repoRoot = resolveRoot(parsed);
  const outputPath = path.resolve(
    repoRoot,
    getFlag(parsed, "out", DEFAULT_INVENTORY_PATH) ?? DEFAULT_INVENTORY_PATH,
  );
  const inventory = scanRuntimeInventory(repoRoot);
  maybeWriteJson(outputPath, inventory);
  console.log(path.relative(repoRoot, outputPath));
}

function commandSurfaceDerive(parsed: ParsedArgs): void {
  const repoRoot = resolveRoot(parsed);
  const inventoryPath = getFlag(parsed, "inventory", DEFAULT_INVENTORY_PATH) ?? DEFAULT_INVENTORY_PATH;
  const model = loadProjectModel(repoRoot, {
    controlPlanePath: getFlag(parsed, "config", DEFAULT_CONFIG_PATH),
    inventoryPath,
    surfaceCatalogPath: getFlag(parsed, "surfaces", DEFAULT_SURFACES_PATH),
    fidelityPolicyPath: getFlag(parsed, "fidelity", DEFAULT_FIDELITY_POLICY_PATH),
  });

  if (!model.inventory) {
    throw new Error(`Inventory file not found: ${inventoryPath}`);
  }

  const outputPath = path.resolve(
    repoRoot,
    getFlag(parsed, "out", DEFAULT_SURFACES_PATH) ?? DEFAULT_SURFACES_PATH,
  );
  const catalog = deriveSurfaceCatalog(model.inventory);
  maybeWriteJson(outputPath, catalog);
  console.log(path.relative(repoRoot, outputPath));
}

function validateAndMaybeReport(parsed: ParsedArgs, reportOnly: boolean): void {
  const repoRoot = resolveRoot(parsed);
  const model = loadProjectModel(repoRoot, {
    controlPlanePath: getFlag(parsed, "config", DEFAULT_CONFIG_PATH),
    inventoryPath: getFlag(parsed, "inventory", DEFAULT_INVENTORY_PATH),
    surfaceCatalogPath: getFlag(parsed, "surfaces", DEFAULT_SURFACES_PATH),
    fidelityPolicyPath: getFlag(parsed, "fidelity", DEFAULT_FIDELITY_POLICY_PATH),
  });
  const summary = validateControlPlane(model.controlPlane, repoRoot, {
    requireAnnotations: !hasFlag(parsed, "allow-missing-annotations"),
    inventory: model.inventory,
    surfaceCatalog: model.surfaceCatalog,
    fidelityPolicy: model.fidelityPolicy,
  });

  const reports = writeReports(
    repoRoot,
    summary,
    getFlag(parsed, "report-json", DEFAULT_REPORT_JSON_PATH),
    getFlag(parsed, "report-md", DEFAULT_REPORT_MD_PATH),
  );

  printSummary(summary);

  if (reportOnly) {
    console.log("");
    console.log(path.relative(repoRoot, reports.jsonPath));
    console.log(path.relative(repoRoot, reports.mdPath));
  }

  if (summary.issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
  }
}

function commandImpact(parsed: ParsedArgs): void {
  const repoRoot = resolveRoot(parsed);
  const changedFiles = [
    ...getFlagValues(parsed, "changed"),
    ...parsed._.slice(1),
  ].map((file) => path.isAbsolute(file) ? path.relative(repoRoot, file) : file);

  if (changedFiles.length === 0) {
    throw new Error("rotops impact requires at least one --changed file");
  }

  const model = loadProjectModel(repoRoot, {
    controlPlanePath: getFlag(parsed, "config", DEFAULT_CONFIG_PATH),
    inventoryPath: getFlag(parsed, "inventory", DEFAULT_INVENTORY_PATH),
    surfaceCatalogPath: getFlag(parsed, "surfaces", DEFAULT_SURFACES_PATH),
    fidelityPolicyPath: getFlag(parsed, "fidelity", DEFAULT_FIDELITY_POLICY_PATH),
  });

  const impact = analyzeImpact(repoRoot, model, changedFiles);
  console.log(JSON.stringify(impact, null, 2));
}

function commandExportVitestWorkspace(parsed: ParsedArgs): void {
  const repoRoot = resolveRoot(parsed);
  const configPath = getFlag(parsed, "config", DEFAULT_CONFIG_PATH) ?? DEFAULT_CONFIG_PATH;
  const outputPath = path.resolve(
    repoRoot,
    getFlag(parsed, "out", "vitest.runtime.workspace.ts") ?? "vitest.runtime.workspace.ts",
  );
  const aliases = Object.fromEntries(
    getFlagValues(parsed, "alias").map((entry) => {
      const [key, value] = entry.split("=", 2);
      if (!key || !value) {
        throw new Error(`Invalid alias value: ${entry}. Expected KEY=PATH.`);
      }
      return [key, value];
    }),
  );

  const controlPlane = loadControlPlane(repoRoot, configPath);
  const contents = generateVitestWorkspace(controlPlane, {
    aliases,
  });

  writeTextFile(outputPath, contents);
  console.log(path.relative(repoRoot, outputPath));
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const [command, subcommand] = parsed._;

  switch (command) {
    case "init":
      commandInit(parsed);
      return;
    case "inventory":
      if (subcommand === "scan") {
        commandInventoryScan(parsed);
        return;
      }
      break;
    case "surfaces":
      if (subcommand === "derive") {
        commandSurfaceDerive(parsed);
        return;
      }
      break;
    case "validate":
      validateAndMaybeReport(parsed, false);
      return;
    case "report":
      validateAndMaybeReport(parsed, true);
      return;
    case "impact":
      commandImpact(parsed);
      return;
    case "export":
      if (subcommand === "vitest-workspace") {
        commandExportVitestWorkspace(parsed);
        return;
      }
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      return;
    default:
      break;
  }

  printHelp();
  process.exitCode = 1;
}

main();
