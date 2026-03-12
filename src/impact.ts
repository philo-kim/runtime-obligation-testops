import { behaviorOwnerTests, getBehaviorUnits } from "./behaviors.js";
import { expandPatterns, toPosix } from "./fs-utils.js";
import type {
  ImpactAnalysis,
  ProjectModel,
  RuntimeInventorySource,
  RuntimeSurfaceDefinition,
} from "./types.js";

function asSet(values: string[]): Set<string> {
  return new Set(values.map((value) => toPosix(value)));
}

function sourceMatchesChangedFiles(
  repoRoot: string,
  sourcePatterns: string[],
  changedFiles: string[],
): boolean {
  const files = asSet(expandPatterns(repoRoot, sourcePatterns));
  return changedFiles.some((file) => files.has(toPosix(file)));
}

function impactedInventorySources(
  repoRoot: string,
  changedFiles: string[],
  sources: RuntimeInventorySource[],
): RuntimeInventorySource[] {
  return sources.filter((source) =>
    sourceMatchesChangedFiles(repoRoot, source.sourcePatterns, changedFiles),
  );
}

function impactedSurfaceIds(
  inventorySources: RuntimeInventorySource[],
  surfaces: RuntimeSurfaceDefinition[],
): string[] {
  const sourceIdSet = new Set(inventorySources.map((source) => source.id));
  return surfaces
    .filter((surface) =>
      surface.inventorySourceIds.some((sourceId) => sourceIdSet.has(sourceId)),
    )
    .map((surface) => surface.id)
    .sort();
}

export function analyzeImpact(
  repoRoot: string,
  model: ProjectModel,
  changedFiles: string[],
): ImpactAnalysis {
  const normalizedChangedFiles = [...new Set(changedFiles.map((file) => toPosix(file)))].sort();
  const inventorySources = model.inventory
    ? impactedInventorySources(repoRoot, normalizedChangedFiles, model.inventory.sources)
    : [];
  const derivedSurfaceIds = model.surfaceCatalog
    ? impactedSurfaceIds(inventorySources, model.surfaceCatalog.surfaces)
    : [];
  const changedByBehavior = getBehaviorUnits(model.controlPlane).filter((behavior) =>
    sourceMatchesChangedFiles(repoRoot, behavior.sourcePatterns, normalizedChangedFiles),
  );
  const behaviorIds = [...new Set(changedByBehavior.map((behavior) => behavior.id))].sort();
  const ownerTests = [...new Set(changedByBehavior.flatMap((behavior) => behaviorOwnerTests(behavior)))].sort();
  const surfaceIds = [
    ...new Set([
      ...derivedSurfaceIds,
      ...changedByBehavior.map((behavior) => behavior.surface),
    ]),
  ].sort();

  return {
    changedFiles: normalizedChangedFiles,
    impactedInventorySources: inventorySources.map((source) => source.id).sort(),
    impactedSurfaces: surfaceIds,
    impactedBehaviors: behaviorIds,
    impactedObligations: behaviorIds,
    impactedOwnerTests: ownerTests,
  };
}
