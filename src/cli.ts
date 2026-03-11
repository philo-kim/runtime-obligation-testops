#!/usr/bin/env node
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_REPORT_JSON_PATH,
  DEFAULT_REPORT_MD_PATH,
} from "./constants.js";
import { relativeToRoot, writeTextFile } from "./fs-utils.js";
import { initWorkspace } from "./init.js";
import { writeReports } from "./report.js";
import { generateVitestWorkspace } from "./adapters/vitest.js";
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

function loadControlPlane(repoRoot: string, configPath: string): RuntimeControlPlane {
  const absoluteConfigPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(repoRoot, configPath);

  return JSON.parse(readFileSync(absoluteConfigPath, "utf8")) as RuntimeControlPlane;
}

function printHelp(): void {
  console.log("runtime-obligation-testops");
  console.log("");
  console.log("Commands:");
  console.log("  rotops init [--preset vitest] [--force]");
  console.log("  rotops validate [--config path] [--root path] [--allow-missing-annotations]");
  console.log("  rotops report [--config path] [--root path] [--allow-missing-annotations]");
  console.log("  rotops export vitest-workspace [--config path] [--root path] [--out path] [--alias @=./src]");
}

function commandInit(parsed: ParsedArgs): void {
  const targetDir = path.resolve(getFlag(parsed, "root", process.cwd()) ?? process.cwd());
  const preset = (getFlag(parsed, "preset", "base") ?? "base") as "base" | "vitest";
  const result = initWorkspace(targetDir, preset, hasFlag(parsed, "force"));

  for (const written of result.written) {
    console.log(`written ${relativeToRoot(targetDir, written)}`);
  }

  for (const skipped of result.skipped) {
    console.log(`skipped ${relativeToRoot(targetDir, skipped)}`);
  }
}

function validateAndMaybeReport(parsed: ParsedArgs, reportOnly: boolean): void {
  const repoRoot = path.resolve(getFlag(parsed, "root", process.cwd()) ?? process.cwd());
  const configPath = getFlag(parsed, "config", DEFAULT_CONFIG_PATH) ?? DEFAULT_CONFIG_PATH;
  const controlPlane = loadControlPlane(repoRoot, configPath);
  const summary = validateControlPlane(controlPlane, repoRoot, {
    requireAnnotations: !hasFlag(parsed, "allow-missing-annotations"),
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
    console.log(relativeToRoot(repoRoot, reports.jsonPath));
    console.log(relativeToRoot(repoRoot, reports.mdPath));
  }

  if (summary.issues.some((issue) => issue.level === "error")) {
    process.exitCode = 1;
  }
}

function commandExportVitestWorkspace(parsed: ParsedArgs): void {
  const repoRoot = path.resolve(getFlag(parsed, "root", process.cwd()) ?? process.cwd());
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
  console.log(relativeToRoot(repoRoot, outputPath));
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const [command, subcommand] = parsed._;

  switch (command) {
    case "init":
      commandInit(parsed);
      return;
    case "validate":
      validateAndMaybeReport(parsed, false);
      return;
    case "report":
      validateAndMaybeReport(parsed, true);
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
