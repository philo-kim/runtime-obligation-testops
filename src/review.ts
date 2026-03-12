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
    reasons: ["Path shape looks like a product runtime file and should usually receive a reviewed runtime decision instead of being ignored implicitly."],
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
  lines.push("# Reviewed Runtime Decision Backlog");
  lines.push("");
  lines.push("This backlog is the semantic review queue for the runtime governance system.");
  lines.push("AI, repo-local policy, and CI should do most of the mechanical work before a reviewer is asked to approve meaning.");
  lines.push("");
  lines.push(`- Principle: ${backlog.principle}`);
  lines.push(`- Version: ${backlog.version}`);
  lines.push(`- Discovered Sources: ${backlog.discoveredSources}`);
  lines.push(`- Discovered Files: ${backlog.discoveredFiles}`);
  lines.push(`- Declared Inventory Files: ${backlog.declaredInventoryFiles}`);
  lines.push(`- Reviewed Decisions Required: ${backlog.unresolvedCandidates}`);
  if (backlog.discoveryScopePatterns?.length) {
    lines.push(`- Discovery Scope: ${backlog.discoveryScopePatterns.join(", ")}`);
  }
  lines.push("");

  if (backlog.candidates.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- No unresolved reviewed runtime decisions remain.");
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

export function printReviewSummary(backlog: ReviewBacklog): void {
  console.log(`Reviewed runtime decision backlog ${backlog.version}`);
  console.log("- governance model: AI + repo-local policy + CI maintain the reviewed runtime model");
  console.log("- reviewer role: approve semantic decisions when acceptance, suppression, fidelity, or granularity is non-obvious");
  console.log(`- discovered sources: ${backlog.discoveredSources}`);
  console.log(`- discovered files: ${backlog.discoveredFiles}`);
  console.log(`- declared inventory files: ${backlog.declaredInventoryFiles}`);
  console.log(`- reviewed decisions required: ${backlog.unresolvedCandidates}`);
  if (backlog.discoveryScopePatterns?.length) {
    console.log(`- discovery scope: ${backlog.discoveryScopePatterns.join(", ")}`);
  }

  if (backlog.candidates.length > 0) {
    console.log("");
    for (const candidate of backlog.candidates.slice(0, 20)) {
      console.log(
        `- ${candidate.file}: action=${candidate.suggestedAction}, sources=${candidate.sourceIds.join(", ")}`,
      );
    }
    if (backlog.candidates.length > 20) {
      console.log(`- ... ${backlog.candidates.length - 20} more candidates`);
    }
  }
}
