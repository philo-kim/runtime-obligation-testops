import path from "node:path";
import { DEFAULT_REPORT_JSON_PATH, DEFAULT_REPORT_MD_PATH } from "./constants.js";
import { writeTextFile } from "./fs-utils.js";
import type { ValidationSummary } from "./types.js";

export function renderMarkdown(summary: ValidationSummary): string {
  const errorCount = summary.issues.filter((issue) => issue.level === "error").length;
  const warningCount = summary.issues.filter((issue) => issue.level === "warning").length;
  const lines: string[] = [];
  lines.push("# Runtime Control Plane Report");
  lines.push("");
  lines.push(`- Version: ${summary.version}`);
  lines.push(`- Principle: ${summary.principle}`);
  if (summary.inventorySources !== undefined) {
    lines.push(`- Inventory Sources: ${summary.inventorySources}`);
  }
  if (summary.derivedSurfaces !== undefined) {
    lines.push(`- Catalog Surfaces: ${summary.derivedSurfaces}`);
  }
  if (summary.discoveredSources !== undefined) {
    lines.push(`- Discovered Sources: ${summary.discoveredSources}`);
  }
  if (summary.discoveredFiles !== undefined) {
    lines.push(`- Discovered Files: ${summary.discoveredFiles}`);
  }
  if (summary.discoveryScopePatterns?.length) {
    lines.push(`- Discovery Scope: ${summary.discoveryScopePatterns.join(", ")}`);
  }
  lines.push(`- Errors: ${errorCount}`);
  lines.push(`- Warnings: ${warningCount}`);
  lines.push(`- Issues: ${summary.issues.length}`);
  lines.push("");
  lines.push("| Surface | Sources | Tests | Obligations | Uncovered | Unreferenced Tests |");
  lines.push("|---|---:|---:|---:|---:|---:|");

  for (const surface of summary.surfaceSummaries) {
    lines.push(
      `| ${surface.id} | ${surface.sources} | ${surface.tests} | ${surface.obligations} | ${surface.uncoveredSources.length} | ${surface.unreferencedTests.length} |`,
    );
  }

  lines.push("");

  if (summary.issues.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- All registered runtime sources are covered by obligations.");
    lines.push("- All registered owner tests are traceable back to obligations.");
    if (summary.discoveredFiles !== undefined) {
      lines.push("- Discovered runtime candidates reconcile with the declared inventory.");
    }
    return lines.join("\n");
  }

  lines.push("## Issues");
  lines.push("");

  for (const issue of summary.issues) {
    lines.push(`- [${issue.level}] ${issue.message}`);
  }

  return lines.join("\n");
}

export function writeReports(
  repoRoot: string,
  summary: ValidationSummary,
  reportJsonPath: string = DEFAULT_REPORT_JSON_PATH,
  reportMdPath: string = DEFAULT_REPORT_MD_PATH,
): { jsonPath: string; mdPath: string } {
  const absoluteJsonPath = path.join(repoRoot, reportJsonPath);
  const absoluteMdPath = path.join(repoRoot, reportMdPath);

  writeTextFile(absoluteJsonPath, JSON.stringify(summary, null, 2));
  writeTextFile(absoluteMdPath, renderMarkdown(summary));

  return {
    jsonPath: absoluteJsonPath,
    mdPath: absoluteMdPath,
  };
}
