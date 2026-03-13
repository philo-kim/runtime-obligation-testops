import type {
  ProjectModel,
  RetrospectiveRootCause,
  RuntimeRetrospectiveIssue,
  RuntimeRetrospectiveLog,
  RuntimeRetrospectiveSummary,
} from "./types.js";

function getBehaviorIds(model: ProjectModel): Set<string> {
  return new Set((model.controlPlane.behaviors ?? model.controlPlane.obligations ?? []).map((behavior) => behavior.id));
}

function getInventoryBehaviorIds(model: ProjectModel): Set<string> {
  return new Set((model.inventory?.behaviors ?? []).map((behavior) => behavior.id));
}

export function analyzeRetrospective(model: ProjectModel): RuntimeRetrospectiveSummary {
  const retrospective = model.retrospectiveLog ?? {
    version: model.controlPlane.version,
    principle: model.controlPlane.principle,
    entries: [],
  } satisfies RuntimeRetrospectiveLog;

  const issues: RuntimeRetrospectiveIssue[] = [];
  const behaviorIds = getBehaviorIds(model);
  const inventoryBehaviorIds = getInventoryBehaviorIds(model);
  const recurring = new Map<RetrospectiveRootCause, number>();
  let openEntries = 0;
  let hardenedEntries = 0;
  let closedEntries = 0;

  for (const entry of retrospective.entries) {
    if (entry.status === "open") {
      openEntries += 1;
      issues.push({
        level: "error",
        entryId: entry.id,
        message: `Retrospective entry ${entry.id} is still open. Runtime escape paths should remain open only while the fix is actively in progress.`,
      });
    } else if (entry.status === "hardened") {
      hardenedEntries += 1;
    } else {
      closedEntries += 1;
    }

    if (!entry.actions || entry.actions.length === 0) {
      issues.push({
        level: "warning",
        entryId: entry.id,
        message: `Retrospective entry ${entry.id} has no recorded hardening actions. Capture how the miss feeds back into discovery, reviewed behaviors, tests, or policy.`,
      });
    }

    for (const inventoryBehaviorId of entry.inventoryBehaviorIds ?? []) {
      if (!inventoryBehaviorIds.has(inventoryBehaviorId)) {
        issues.push({
          level: "error",
          entryId: entry.id,
          message: `Retrospective entry ${entry.id} references unknown inventory behavior ${inventoryBehaviorId}.`,
        });
      }
    }

    for (const behaviorId of entry.behaviorUnitIds ?? []) {
      if (!behaviorIds.has(behaviorId)) {
        issues.push({
          level: "error",
          entryId: entry.id,
          message: `Retrospective entry ${entry.id} references unknown behavior unit ${behaviorId}.`,
        });
      }
    }

    for (const rootCause of entry.rootCauses) {
      recurring.set(rootCause, (recurring.get(rootCause) ?? 0) + 1);
    }
  }

  const recurringRootCauses = [...recurring.entries()]
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .map(([rootCause, count]) => ({ rootCause, count }));

  for (const recurringRootCause of recurringRootCauses) {
    issues.push({
      level: "warning",
      message: `Root cause ${recurringRootCause.rootCause} has recurred ${recurringRootCause.count} times. Promote this pattern into a stronger reviewed-model rule or self-check.`,
    });
  }

  return {
    principle: retrospective.principle,
    version: retrospective.version,
    entries: retrospective.entries.length,
    openEntries,
    hardenedEntries,
    closedEntries,
    recurringRootCauses,
    issues,
  };
}

export function renderRetrospectiveMarkdown(summary: RuntimeRetrospectiveSummary): string {
  const lines: string[] = [];
  lines.push("# Runtime Retrospective Report");
  lines.push("");
  lines.push("This report tracks escaped runtime misses and whether they have been hardened back into the reviewed behavior system.");
  lines.push("");
  lines.push(`- Version: ${summary.version}`);
  lines.push(`- Principle: ${summary.principle}`);
  lines.push(`- Entries: ${summary.entries}`);
  lines.push(`- Open Entries: ${summary.openEntries}`);
  lines.push(`- Hardened Entries: ${summary.hardenedEntries}`);
  lines.push(`- Closed Entries: ${summary.closedEntries}`);
  lines.push(`- Issues: ${summary.issues.length}`);
  lines.push("");

  if (summary.recurringRootCauses.length > 0) {
    lines.push("## Recurring Root Causes");
    lines.push("");
    for (const rootCause of summary.recurringRootCauses) {
      lines.push(`- ${rootCause.rootCause}: ${rootCause.count}`);
    }
    lines.push("");
  }

  if (summary.issues.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- No unresolved retrospective issues remain.");
    return lines.join("\n");
  }

  lines.push("## Issues");
  lines.push("");
  for (const issue of summary.issues) {
    lines.push(`- [${issue.level}] ${issue.message}`);
  }

  return lines.join("\n");
}

export function printRetrospectiveSummary(summary: RuntimeRetrospectiveSummary): void {
  console.log(`Runtime retrospective ${summary.version}`);
  console.log(`- entries: ${summary.entries}`);
  console.log(`- open entries: ${summary.openEntries}`);
  console.log(`- hardened entries: ${summary.hardenedEntries}`);
  console.log(`- closed entries: ${summary.closedEntries}`);
  console.log(`- retrospective issues: ${summary.issues.length}`);

  if (summary.recurringRootCauses.length > 0) {
    console.log(`- recurring root causes: ${summary.recurringRootCauses.map((rootCause) => `${rootCause.rootCause}=${rootCause.count}`).join(", ")}`);
  }

  if (summary.issues.length > 0) {
    console.log("");
    for (const issue of summary.issues.slice(0, 20)) {
      console.log(`- [${issue.level}] ${issue.message}`);
    }
    if (summary.issues.length > 20) {
      console.log(`- ... ${summary.issues.length - 20} more issues`);
    }
  }
}
