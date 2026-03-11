import { expandPatterns } from "./fs-utils.js";
import { scanRuntimeInventory } from "./inventory.js";
import type {
  ProjectModel,
  ReviewBacklog,
  ReviewCandidate,
  ReviewSuggestedAction,
  RuntimeInventory,
  RuntimeInventorySource,
} from "./types.js";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function mapFilesBySource(
  repoRoot: string,
  inventory: RuntimeInventory,
): Map<string, string[]> {
  const filesBySource = new Map<string, string[]>();
  for (const source of inventory.sources) {
    filesBySource.set(source.id, expandPatterns(repoRoot, source.sourcePatterns));
  }
  return filesBySource;
}

function groupSourcesByFile(
  repoRoot: string,
  inventory: RuntimeInventory,
): Map<string, RuntimeInventorySource[]> {
  const grouped = new Map<string, RuntimeInventorySource[]>();
  const filesBySource = mapFilesBySource(repoRoot, inventory);

  for (const source of inventory.sources) {
    for (const file of filesBySource.get(source.id) ?? []) {
      const bucket = grouped.get(file) ?? [];
      bucket.push(source);
      grouped.set(file, bucket);
    }
  }

  return grouped;
}

function candidateSuggestion(file: string): {
  suggestedAction: ReviewSuggestedAction;
  reasons: string[];
} {
  const suppressPattern =
    /(^|\/)(docs?|archive|archives|examples|storybook|stories|widgetbook|vendor|vendors|third_party|generated|\.fvm|\.dart_tool|ios\/\.symlinks)(\/|$)/;

  if (suppressPattern.test(file)) {
    return {
      suggestedAction: "suppress",
      reasons: ["Path shape looks like docs, generated code, vendored code, or tooling output."],
    };
  }

  return {
    suggestedAction: "accept",
    reasons: ["Path shape looks like a product runtime file and should usually be reviewed into inventory."],
  };
}

export function generateReviewBacklog(
  repoRoot: string,
  model: ProjectModel,
): ReviewBacklog {
  const discoveredInventory = scanRuntimeInventory(repoRoot, {
    discoveryPolicy: model.discoveryPolicy,
  });

  const discoveredByFile = groupSourcesByFile(repoRoot, discoveredInventory);
  const declaredInventory = model.inventory;
  const declaredFiles = new Set<string>(
    declaredInventory ? [...groupSourcesByFile(repoRoot, declaredInventory).keys()] : [],
  );

  const candidates: ReviewCandidate[] = [];

  for (const [file, sources] of discoveredByFile.entries()) {
    if (declaredFiles.has(file)) {
      continue;
    }

    const suggestion = candidateSuggestion(file);
    candidates.push({
      file,
      sourceIds: unique(sources.map((source) => source.id)),
      sourceKinds: unique(sources.map((source) => source.kind)),
      surfaceHints: unique(sources.map((source) => source.surfaceHint).filter(Boolean) as string[]),
      minimumFidelity: unique(sources.map((source) => source.minimumFidelity).filter(Boolean) as string[]),
      suggestedAction: suggestion.suggestedAction,
      reasons: suggestion.reasons,
    });
  }

  return {
    principle: model.controlPlane.principle,
    version: model.controlPlane.version,
    discoveryScopePatterns: model.discoveryPolicy?.scopePatterns,
    discoveredSources: discoveredInventory.sources.length,
    discoveredFiles: discoveredByFile.size,
    declaredInventoryFiles: declaredFiles.size,
    unresolvedCandidates: candidates.length,
    candidates: candidates.sort((left, right) => left.file.localeCompare(right.file)),
  };
}

export function renderReviewMarkdown(backlog: ReviewBacklog): string {
  const lines: string[] = [];
  lines.push("# Runtime Review Backlog");
  lines.push("");
  lines.push(`- Principle: ${backlog.principle}`);
  lines.push(`- Version: ${backlog.version}`);
  lines.push(`- Discovered Sources: ${backlog.discoveredSources}`);
  lines.push(`- Discovered Files: ${backlog.discoveredFiles}`);
  lines.push(`- Declared Inventory Files: ${backlog.declaredInventoryFiles}`);
  lines.push(`- Unresolved Candidates: ${backlog.unresolvedCandidates}`);
  if (backlog.discoveryScopePatterns?.length) {
    lines.push(`- Discovery Scope: ${backlog.discoveryScopePatterns.join(", ")}`);
  }
  lines.push("");

  if (backlog.candidates.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- No unresolved discovered candidates remain.");
    return lines.join("\n");
  }

  lines.push("| File | Source IDs | Surface Hints | Suggested Action |");
  lines.push("|---|---|---|---|");
  for (const candidate of backlog.candidates) {
    lines.push(
      `| ${candidate.file} | ${candidate.sourceIds.join(", ")} | ${candidate.surfaceHints.join(", ")} | ${candidate.suggestedAction} |`,
    );
  }
  lines.push("");
  lines.push("## Candidate Notes");
  lines.push("");
  for (const candidate of backlog.candidates) {
    lines.push(`- ${candidate.file}: ${candidate.reasons.join(" ")}`);
  }

  return lines.join("\n");
}
