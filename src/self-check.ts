import { getInventoryBehaviors } from "./inventory-behaviors.js";
import type {
  ProjectModel,
  RiskyKindFidelityRule,
  RuntimeBehaviorUnit,
  RuntimeInventory,
  RuntimeInventoryBehavior,
  SelfCheckIssue,
  SelfCheckSummary,
} from "./types.js";

function getBehaviorUnits(model: ProjectModel): RuntimeBehaviorUnit[] {
  return model.controlPlane.behaviors ?? model.controlPlane.obligations ?? [];
}

function getFidelityRank(model: ProjectModel, fidelity: string): number {
  return model.controlPlane.fidelityLevels.indexOf(fidelity);
}

function sourceKindsForBehavior(
  behavior: RuntimeBehaviorUnit,
  inventory: RuntimeInventory | undefined,
  inventoryBehaviors: RuntimeInventoryBehavior[],
): string[] {
  if (!inventory) {
    return [];
  }

  const sourceById = new Map(inventory.sources.map((source) => [source.id, source]));
  const kinds = new Set<string>();

  for (const inventoryBehaviorId of behavior.inventoryBehaviorIds ?? []) {
    const inventoryBehavior = inventoryBehaviors.find((candidate) => candidate.id === inventoryBehaviorId);
    const source = inventoryBehavior ? sourceById.get(inventoryBehavior.sourceId) : undefined;
    if (source?.kind) {
      kinds.add(source.kind);
    }
  }

  for (const sourceId of behavior.inventorySourceIds ?? []) {
    const source = sourceById.get(sourceId);
    if (source?.kind) {
      kinds.add(source.kind);
    }
  }

  return [...kinds];
}

function maybeAddRiskyKindFidelityIssue(
  issues: SelfCheckIssue[],
  model: ProjectModel,
  behavior: RuntimeBehaviorUnit,
  kinds: string[],
  rule: RiskyKindFidelityRule,
): void {
  let regex: RegExp;

  try {
    regex = new RegExp(rule.kindPattern);
  } catch {
    issues.push({
      level: "warning",
      code: "invalid-risky-kind-pattern",
      message: `Self-check rule kindPattern ${rule.kindPattern} is not a valid regular expression.`,
      behaviorId: behavior.id,
    });
    return;
  }

  if (!kinds.some((kind) => regex.test(kind))) {
    return;
  }

  if (getFidelityRank(model, behavior.fidelity) >= getFidelityRank(model, rule.minimumFidelity)) {
    return;
  }

  issues.push({
    level: rule.level ?? "warning",
    code: "risky-kind-fidelity",
    message: `Behavior ${behavior.id} is backed by source kinds [${kinds.join(", ")}] but only proves fidelity ${behavior.fidelity}; self-check rule requires at least ${rule.minimumFidelity}.`,
    behaviorId: behavior.id,
  });
}

export function runSelfCheck(model: ProjectModel): SelfCheckSummary {
  const issues: SelfCheckIssue[] = [];
  const inventory = model.inventory;
  const behaviorUnits = getBehaviorUnits(model);
  const explicitInventoryBehaviors = Boolean(inventory?.behaviors?.length);
  const inventoryBehaviors = inventory ? getInventoryBehaviors(inventory) : [];
  const selfCheckPolicy = model.selfCheckPolicy;

  if (!inventory) {
    issues.push({
      level: "error",
      code: "missing-inventory",
      message: "Reviewed runtime inventory is required for behavior self-check.",
    });
  }

  if (
    selfCheckPolicy?.requireExplicitInventoryBehaviors !== false &&
    inventory &&
    !explicitInventoryBehaviors
  ) {
    issues.push({
      level: "error",
      code: "implicit-inventory-behaviors",
      message: "Inventory behaviors are still synthesized from source events. Add explicit reviewed runtime behaviors so the denominator is reviewable instead of inferred.",
    });
  }

  const behaviorsByOwnerTest = new Map<string, number>();
  for (const behavior of behaviorUnits) {
    if (selfCheckPolicy?.requireExplicitBehaviorMappings !== false && (!behavior.inventoryBehaviorIds || behavior.inventoryBehaviorIds.length === 0)) {
      issues.push({
        level: "error",
        code: "implicit-behavior-mapping",
        message: `Behavior ${behavior.id} does not declare inventoryBehaviorIds and still relies on fallback matching.`,
        behaviorId: behavior.id,
      });
    }

    if (
      selfCheckPolicy?.maxOwnerTestsPerBehavior !== undefined &&
      (behavior.ownerTests?.length ?? 0) > selfCheckPolicy.maxOwnerTestsPerBehavior
    ) {
      issues.push({
        level: "warning",
        code: "too-many-owner-tests",
        message: `Behavior ${behavior.id} is owned by ${(behavior.ownerTests ?? []).length} tests, above the self-check limit ${selfCheckPolicy.maxOwnerTestsPerBehavior}. Recheck whether proof ownership is too diffuse.`,
        behaviorId: behavior.id,
      });
    }

    const kinds = sourceKindsForBehavior(behavior, inventory, inventoryBehaviors);
    for (const rule of selfCheckPolicy?.riskyKindMinimumFidelity ?? []) {
      maybeAddRiskyKindFidelityIssue(issues, model, behavior, kinds, rule);
    }

    for (const ownerTest of behavior.ownerTests ?? []) {
      behaviorsByOwnerTest.set(ownerTest, (behaviorsByOwnerTest.get(ownerTest) ?? 0) + 1);
    }
  }

  if (selfCheckPolicy?.maxBehaviorsPerOwnerTest !== undefined) {
    for (const [ownerTest, count] of behaviorsByOwnerTest.entries()) {
      if (count > selfCheckPolicy.maxBehaviorsPerOwnerTest) {
        issues.push({
          level: "warning",
          code: "owner-test-too-broad",
          message: `Owner test ${ownerTest} is mapped to ${count} behaviors, above the self-check limit ${selfCheckPolicy.maxBehaviorsPerOwnerTest}. Recheck whether multiple runtime behaviors are hiding behind a single proof file.`,
          ownerTest,
        });
      }
    }
  }

  return {
    principle: model.controlPlane.principle,
    version: model.controlPlane.version,
    explicitInventoryBehaviors,
    inventoryBehaviors: inventoryBehaviors.length,
    behaviorUnits: behaviorUnits.length,
    ownerTests: behaviorsByOwnerTest.size,
    issues,
  };
}

export function renderSelfCheckMarkdown(summary: SelfCheckSummary): string {
  const lines: string[] = [];
  lines.push("# Runtime Behavior Self-Check Report");
  lines.push("");
  lines.push("This report challenges the reviewed model itself instead of only checking declared consistency.");
  lines.push("");
  lines.push(`- Version: ${summary.version}`);
  lines.push(`- Principle: ${summary.principle}`);
  lines.push(`- Explicit Inventory Behaviors: ${summary.explicitInventoryBehaviors ? "yes" : "no"}`);
  lines.push(`- Inventory Behaviors: ${summary.inventoryBehaviors}`);
  lines.push(`- Behavior Units: ${summary.behaviorUnits}`);
  lines.push(`- Owner Tests: ${summary.ownerTests}`);
  lines.push(`- Issues: ${summary.issues.length}`);
  lines.push("");

  if (summary.issues.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- No self-check issues were found in the reviewed runtime behavior model.");
    return lines.join("\n");
  }

  lines.push("## Issues");
  lines.push("");
  for (const issue of summary.issues) {
    lines.push(`- [${issue.level}] ${issue.message}`);
  }

  return lines.join("\n");
}

export function printSelfCheckSummary(summary: SelfCheckSummary): void {
  console.log(`Runtime behavior self-check ${summary.version}`);
  console.log(`- explicit inventory behaviors: ${summary.explicitInventoryBehaviors ? "yes" : "no"}`);
  console.log(`- inventory behaviors: ${summary.inventoryBehaviors}`);
  console.log(`- behavior units: ${summary.behaviorUnits}`);
  console.log(`- owner tests: ${summary.ownerTests}`);
  console.log(`- self-check issues: ${summary.issues.length}`);

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
