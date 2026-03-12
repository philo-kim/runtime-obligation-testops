import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { behaviorImplementationStatus, behaviorOwnerTests, getBehaviorUnits } from "./behaviors.js";
import { obligationMeetsFidelity, resolveMinimumFidelity, maxFidelity } from "./fidelity.js";
import { expandPatterns, parseRuntimeObligationsAnnotation } from "./fs-utils.js";
import { getDiscoveryRuleIds, scanRuntimeInventory } from "./inventory.js";
import { getInventoryBehaviors } from "./inventory-behaviors.js";
import {
  validateControlPlaneShape,
  validateDiscoveryPolicyShape,
  validateFidelityPolicyShape,
  validateInventoryShape,
  validateQualityPolicyShape,
  validateSurfaceCatalogShape,
} from "./schema.js";
import type {
  InventorySourceQualityRule,
  BehaviorQualityRule,
  RuntimeControlPlane,
  RuntimeDiscoveryPolicy,
  RuntimeBehaviorUnit,
  RuntimeInventory,
  RuntimeInventoryBehavior,
  RuntimeInventorySource,
  RuntimeQualityPolicy,
  RuntimeSurfaceCatalog,
  RuntimeSurfaceDefinition,
  Surface,
  SurfaceSummary,
  ValidationIssue,
  ValidationOptions,
  ValidationSummary,
} from "./types.js";

function pushSchemaIssues(issues: ValidationIssue[], prefix: string, values: string[]): void {
  for (const value of values) {
    issues.push({
      level: "error",
      message: `${prefix}: ${value}`,
    });
  }
}

function ensureMatchingPrinciple(
  issues: ValidationIssue[],
  label: string,
  expected: string | undefined,
  actual: string | undefined,
): void {
  if (!expected || !actual || expected === actual) {
    return;
  }

  issues.push({
    level: "error",
    message: `${label} principle ${JSON.stringify(actual)} does not match control-plane principle ${JSON.stringify(expected)}`,
  });
}

function uniqueIdIssues(
  issues: ValidationIssue[],
  label: string,
  values: string[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push({
        level: "error",
        message: `Duplicate ${label}: ${value}`,
      });
    }
    seen.add(value);
  }
}

function validateDiscoveryPolicySemantics(
  issues: ValidationIssue[],
  discoveryPolicy?: RuntimeDiscoveryPolicy,
): void {
  if (!discoveryPolicy?.sourceOverrides?.length) {
    return;
  }

  const knownSourceIds = new Set(getDiscoveryRuleIds());
  const seen = new Set<string>();

  for (const override of discoveryPolicy.sourceOverrides) {
    if (!knownSourceIds.has(override.sourceId)) {
      issues.push({
        level: "error",
        message: `Discovery policy source override references unknown runtime source ${override.sourceId}`,
      });
    }

    if (seen.has(override.sourceId)) {
      issues.push({
        level: "error",
        message: `Discovery policy defines multiple overrides for runtime source ${override.sourceId}`,
      });
    }
    seen.add(override.sourceId);

    if (override.mode === "replace" && (!override.includePatterns || override.includePatterns.length === 0)) {
      issues.push({
        level: "warning",
        message: `Discovery policy override for ${override.sourceId} uses replace mode without includePatterns`,
      });
    }
  }
}

function validateQualityPolicySemantics(
  issues: ValidationIssue[],
  controlPlane: RuntimeControlPlane,
  inventory: RuntimeInventory | undefined,
  qualityPolicy?: RuntimeQualityPolicy,
): void {
  if (!qualityPolicy) {
    return;
  }

  const knownSurfaceIds = new Set(controlPlane.surfaces.map((surface) => surface.id));
  const knownInventorySourceIds = new Set(inventory?.sources.map((source) => source.id) ?? []);
  const knownObligationIds = new Set(getBehaviorUnits(controlPlane).map((behavior) => behavior.id));

  const seenSurfaceIds = new Set<string>();
  for (const surfacePolicy of qualityPolicy.surfacePolicies ?? []) {
    if (!knownSurfaceIds.has(surfacePolicy.surfaceId)) {
      issues.push({
        level: "error",
        message: `Quality policy references unknown surface ${surfacePolicy.surfaceId}`,
      });
    }
    if (seenSurfaceIds.has(surfacePolicy.surfaceId)) {
      issues.push({
        level: "error",
        message: `Quality policy defines multiple surface policies for ${surfacePolicy.surfaceId}`,
      });
    }
    seenSurfaceIds.add(surfacePolicy.surfaceId);

    if (!surfacePolicy.inventorySourceRule && !surfacePolicy.behaviorRule && !surfacePolicy.obligationRule) {
      issues.push({
        level: "warning",
        message: `Quality policy surface ${surfacePolicy.surfaceId} does not define any quality rules`,
      });
    }
  }

  const seenInventorySourceIds = new Set<string>();
  for (const sourcePolicy of qualityPolicy.inventorySourcePolicies ?? []) {
    if (!knownInventorySourceIds.has(sourcePolicy.inventorySourceId)) {
      issues.push({
        level: "error",
        message: `Quality policy references unknown inventory source ${sourcePolicy.inventorySourceId}`,
      });
    }
    if (seenInventorySourceIds.has(sourcePolicy.inventorySourceId)) {
      issues.push({
        level: "error",
        message: `Quality policy defines multiple inventory-source policies for ${sourcePolicy.inventorySourceId}`,
      });
    }
    seenInventorySourceIds.add(sourcePolicy.inventorySourceId);
  }

  const normalizedBehaviorPolicies = [
    ...(qualityPolicy.behaviorPolicies ?? []),
    ...((qualityPolicy.obligationPolicies ?? []).map((policy) => ({
      ...policy,
      behaviorId: policy.behaviorId ?? policy.obligationId,
    }))),
  ];

  const seenBehaviorIds = new Set<string>();
  for (const behaviorPolicy of normalizedBehaviorPolicies) {
    if (!behaviorPolicy.behaviorId) {
      issues.push({
        level: "error",
        message: "Quality policy defines a behavior policy without a behaviorId",
      });
      continue;
    }
    if (!knownObligationIds.has(behaviorPolicy.behaviorId)) {
      issues.push({
        level: "error",
        message: `Quality policy references unknown behavior ${behaviorPolicy.behaviorId}`,
      });
    }
    if (seenBehaviorIds.has(behaviorPolicy.behaviorId)) {
      issues.push({
        level: "error",
        message: `Quality policy defines multiple behavior policies for ${behaviorPolicy.behaviorId}`,
      });
    }
    seenBehaviorIds.add(behaviorPolicy.behaviorId);
  }
}

function mergeDefined<T extends object>(...rules: Array<T | undefined>): T | undefined {
  const merged = Object.assign({}, ...rules.filter(Boolean));
  return Object.keys(merged).length > 0 ? (merged as T) : undefined;
}

function resolveInventorySourceQualityRule(
  qualityPolicy: RuntimeQualityPolicy | undefined,
  surfaceId: string | undefined,
  inventorySourceId: string,
): InventorySourceQualityRule | undefined {
  const surfaceRule = qualityPolicy?.surfacePolicies?.find(
    (policy) => policy.surfaceId === surfaceId,
  )?.inventorySourceRule;
  const sourceRule = qualityPolicy?.inventorySourcePolicies?.find(
    (policy) => policy.inventorySourceId === inventorySourceId,
  );

  return mergeDefined(
    qualityPolicy?.defaultInventorySourceRule,
    surfaceRule,
    sourceRule,
  );
}

function resolveBehaviorQualityRule(
  qualityPolicy: RuntimeQualityPolicy | undefined,
  surfaceId: string,
  behaviorId: string,
): BehaviorQualityRule | undefined {
  const surfaceRule = qualityPolicy?.surfacePolicies?.find(
    (policy) => policy.surfaceId === surfaceId,
  );
  const normalizedBehaviorPolicies = [
    ...(qualityPolicy?.behaviorPolicies ?? []),
    ...((qualityPolicy?.obligationPolicies ?? []).map((policy) => ({
      ...policy,
      behaviorId: policy.behaviorId ?? policy.obligationId,
    }))),
  ];
  const behaviorRule = normalizedBehaviorPolicies.find(
    (policy) => policy.behaviorId === behaviorId,
  );

  return mergeDefined(
    qualityPolicy?.defaultBehaviorRule,
    qualityPolicy?.defaultObligationRule,
    surfaceRule?.behaviorRule,
    surfaceRule?.obligationRule,
    behaviorRule,
  );
}

function mapFilesById<T extends { id: string; sourcePatterns: string[] }>(
  repoRoot: string,
  items: T[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const item of items) {
    result.set(item.id, expandPatterns(repoRoot, item.sourcePatterns));
  }
  return result;
}

function union(values: string[][]): string[] {
  return [...new Set(values.flat())].sort();
}

function groupInventorySourcesByFile(
  inventory: RuntimeInventory,
  repoRoot: string,
): {
  filesById: Map<string, string[]>;
  sourcesByFile: Map<string, RuntimeInventorySource[]>;
} {
  const filesById = mapFilesById(repoRoot, inventory.sources);
  const sourcesByFile = new Map<string, RuntimeInventorySource[]>();

  for (const source of inventory.sources) {
    for (const file of filesById.get(source.id) ?? []) {
      const bucket = sourcesByFile.get(file) ?? [];
      bucket.push(source);
      sourcesByFile.set(file, bucket);
    }
  }

  return { filesById, sourcesByFile };
}

function discoveryPolicyIgnores(discoveryPolicy?: RuntimeDiscoveryPolicy): string[] {
  return [
    ...(discoveryPolicy?.ignorePatterns ?? []),
    ...(discoveryPolicy?.suppressions ?? []).flatMap((suppression) => suppression.filePatterns),
  ];
}

function discoveredCandidateIssueLevel(
  discoveryPolicy?: RuntimeDiscoveryPolicy,
): "error" | "warning" | undefined {
  switch (discoveryPolicy?.candidateReviewMode) {
    case "off":
      return undefined;
    case "warning":
      return "warning";
    default:
      return "error";
  }
}

function overlap(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function parseOutcomeClasses(behavior: RuntimeBehaviorUnit): string[] {
  if (behavior.outcomeClasses && behavior.outcomeClasses.length > 0) {
    return [...new Set(behavior.outcomeClasses)].sort();
  }

  const classes = new Set<string>();

  for (const outcome of behavior.outcomes) {
    const normalized = outcome.toLowerCase();
    if (
      /\bsuccess\b|\bcontinue\b|\bprocessed\b|\bcreated\b|\bloaded\b|\brendered\b|\baccepted\b|\battached\b/.test(
        normalized,
      )
    ) {
      classes.add("success");
    }
    if (/\bredirect\b/.test(normalized)) {
      classes.add("redirect");
    }
    if (/\binvalid\b|\bvalidation\b|\bmissing\b|\bbad request\b/.test(normalized)) {
      classes.add("validation_error");
    }
    if (/\bunauthenticated\b|\bunauthorized\b|\bforbidden\b|\bauth\b/.test(normalized)) {
      classes.add("auth_denied");
    }
    if (/\bnot found\b|\babsent\b|\bno app\b/.test(normalized)) {
      classes.add("not_found");
    }
    if (/\bduplicate\b|\bidempotent\b|\balready\b|\bexactly once\b/.test(normalized)) {
      classes.add("duplicate");
    }
    if (/\btimeout\b|\btimed out\b/.test(normalized)) {
      classes.add("timeout");
    }
    if (/\bretry\b|\bre-enqueue\b/.test(normalized)) {
      classes.add("retry");
    }
    if (/\bskip\b|\bskipped\b|\bno changes\b/.test(normalized)) {
      classes.add("skipped");
    }
    if (/\bpartial\b/.test(normalized)) {
      classes.add("partial");
    }
    if (/\bfail\b|\berror\b|\breject\b/.test(normalized)) {
      classes.add("failure");
    }
    if (/\bprovider\b|\bupstream\b|\brate limit\b/.test(normalized)) {
      classes.add("provider_failure");
    }
    if (/\bschema\b|\bshape\b|\bdrift\b|\bparse\b/.test(normalized)) {
      classes.add("schema_drift");
    }
  }

  return [...classes].sort();
}

function surfaceById(
  controlPlane: RuntimeControlPlane,
  id: string,
): Surface | undefined {
  return controlPlane.surfaces.find((surface) => surface.id === id);
}

function inventorySourceById(
  inventory: RuntimeInventory | undefined,
  id: string,
): RuntimeInventorySource | undefined {
  return inventory?.sources.find((source) => source.id === id);
}

function catalogSurfaceById(
  surfaceCatalog: RuntimeSurfaceCatalog | undefined,
  id: string,
): RuntimeSurfaceDefinition | undefined {
  return surfaceCatalog?.surfaces.find((surface) => surface.id === id);
}

function inventoryBehaviorById(
  behaviors: RuntimeInventoryBehavior[],
  id: string,
): RuntimeInventoryBehavior | undefined {
  return behaviors.find((behavior) => behavior.id === id);
}

function behaviorMatchesInventoryBehavior(
  behaviorUnit: RuntimeBehaviorUnit,
  inventoryBehavior: RuntimeInventoryBehavior,
  tracedInventorySources: RuntimeInventorySource[],
): boolean {
  if (behaviorUnit.inventoryBehaviorIds?.length) {
    return behaviorUnit.inventoryBehaviorIds.includes(inventoryBehavior.id);
  }

  const tracedSourceIds = new Set(tracedInventorySources.map((source) => source.id));
  if (!tracedSourceIds.has(inventoryBehavior.sourceId)) {
    return false;
  }

  return behaviorUnit.event.trim() === inventoryBehavior.event.trim();
}

export function validateControlPlane(
  controlPlane: RuntimeControlPlane,
  repoRoot: string,
  options: ValidationOptions = {},
): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const requireAnnotations = options.requireAnnotations ?? true;
  const inventory = options.inventory;
  const surfaceCatalog = options.surfaceCatalog;
  const fidelityPolicy = options.fidelityPolicy;
  const qualityPolicy = options.qualityPolicy;
  const discoveryPolicy = options.discoveryPolicy;
  const discoveredInventoryCandidate =
    options.discoveredInventory ??
    (discoveryPolicy
      ? scanRuntimeInventory(repoRoot, {
          discoveryPolicy,
        })
      : undefined);
  const discoveredInventory =
    discoveredInventoryCandidate && discoveredInventoryCandidate.sources.length > 0
      ? discoveredInventoryCandidate
      : undefined;

  pushSchemaIssues(issues, "Schema violation", validateControlPlaneShape(controlPlane));
  if (inventory) {
    pushSchemaIssues(issues, "Inventory schema violation", validateInventoryShape(inventory));
  }
  if (surfaceCatalog) {
    pushSchemaIssues(
      issues,
      "Surface catalog schema violation",
      validateSurfaceCatalogShape(surfaceCatalog),
    );
  }
  if (fidelityPolicy) {
    pushSchemaIssues(
      issues,
      "Fidelity policy schema violation",
      validateFidelityPolicyShape(fidelityPolicy),
    );
  }
  if (qualityPolicy) {
    pushSchemaIssues(
      issues,
      "Quality policy schema violation",
      validateQualityPolicyShape(qualityPolicy),
    );
  }
  if (discoveryPolicy) {
    pushSchemaIssues(
      issues,
      "Discovery policy schema violation",
      validateDiscoveryPolicyShape(discoveryPolicy),
    );
    validateDiscoveryPolicySemantics(issues, discoveryPolicy);
  }
  if (discoveredInventory) {
    pushSchemaIssues(
      issues,
      "Discovered inventory schema violation",
      validateInventoryShape(discoveredInventory),
    );
  }

  ensureMatchingPrinciple(
    issues,
    "Inventory",
    controlPlane.principle,
    inventory?.principle,
  );
  ensureMatchingPrinciple(
    issues,
    "Surface catalog",
    controlPlane.principle,
    surfaceCatalog?.principle,
  );
  ensureMatchingPrinciple(
    issues,
    "Fidelity policy",
    controlPlane.principle,
    fidelityPolicy?.principle,
  );
  ensureMatchingPrinciple(
    issues,
    "Quality policy",
    controlPlane.principle,
    qualityPolicy?.principle,
  );
  ensureMatchingPrinciple(
    issues,
    "Discovery policy",
    controlPlane.principle,
    discoveryPolicy?.principle,
  );
  ensureMatchingPrinciple(
    issues,
    "Discovered inventory",
    controlPlane.principle,
    discoveredInventory?.principle,
  );

  const behaviorUnits = getBehaviorUnits(controlPlane);
  const inventoryBehaviors = getInventoryBehaviors(inventory);
  const inventoryHasExplicitBehaviors = Boolean(inventory?.behaviors?.length);

  uniqueIdIssues(
    issues,
    "surface id",
    controlPlane.surfaces.map((surface) => surface.id),
  );
  uniqueIdIssues(
    issues,
    "behavior id",
    behaviorUnits.map((behavior) => behavior.id),
  );
  uniqueIdIssues(
    issues,
    "inventory source id",
    inventory?.sources.map((source) => source.id) ?? [],
  );
  uniqueIdIssues(
    issues,
    "inventory behavior id",
    inventoryBehaviors.map((behavior) => behavior.id),
  );
  uniqueIdIssues(
    issues,
    "catalog surface id",
    surfaceCatalog?.surfaces.map((surface) => surface.id) ?? [],
  );
  uniqueIdIssues(
    issues,
    "discovered inventory source id",
    discoveredInventory?.sources.map((source) => source.id) ?? [],
  );

  validateQualityPolicySemantics(issues, controlPlane, inventory, qualityPolicy);

  if (controlPlane.surfaces.length === 0) {
    issues.push({
      level: "error",
      message: "The control plane does not define any runtime surfaces",
    });
  }

  if (behaviorUnits.length === 0) {
    issues.push({
      level: "error",
      message: "The control plane does not define any runtime behavior units",
    });
  }

  if (inventory) {
    for (const inventoryBehavior of inventoryBehaviors) {
      if (!inventorySourceById(inventory, inventoryBehavior.sourceId)) {
        issues.push({
          level: "error",
          message: `Inventory behavior ${inventoryBehavior.id} references unknown inventory source ${inventoryBehavior.sourceId}`,
        });
      }
    }
  }

  const surfaceSources = new Map<string, string[]>();
  const surfaceTests = new Map<string, string[]>();
  const referencedTestsBySurface = new Map<string, Set<string>>();
  const cachedTestSources = new Map<string, string>();

  for (const surface of controlPlane.surfaces) {
    const sources = expandPatterns(
      repoRoot,
      surface.sourcePatterns,
      surface.sourceIgnorePatterns ?? [],
    );
    const tests = expandPatterns(
      repoRoot,
      surface.testPatterns,
      surface.testIgnorePatterns ?? [],
    );

    surfaceSources.set(surface.id, sources);
    surfaceTests.set(surface.id, tests);

    if (sources.length === 0) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} did not resolve any runtime sources`,
      });
    }

    if (tests.length === 0) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} did not resolve any owner tests`,
      });
    }
  }

  const inventoryFilesById = inventory ? mapFilesById(repoRoot, inventory.sources) : new Map();
  const discoveredInventoryGrouped = discoveredInventory
    ? groupInventorySourcesByFile(discoveredInventory, repoRoot)
    : undefined;
  const sourceToSurfaceMap = new Map<string, string>();

  if (surfaceCatalog) {
    for (const surface of surfaceCatalog.surfaces) {
      if (!surfaceById(controlPlane, surface.id)) {
        issues.push({
          level: "error",
          message: `Catalog surface ${surface.id} does not exist in the control plane`,
        });
      }

      if (surface.inventorySourceIds.length === 0) {
        issues.push({
          level: "error",
          message: `Catalog surface ${surface.id} does not map any inventory sources`,
        });
      }

      for (const sourceId of surface.inventorySourceIds) {
        const source = inventorySourceById(inventory, sourceId);
        if (!source) {
          issues.push({
            level: "error",
            message: `Catalog surface ${surface.id} references unknown inventory source ${sourceId}`,
          });
          continue;
        }

        if (sourceToSurfaceMap.has(sourceId)) {
          issues.push({
            level: "error",
            message: `Inventory source ${sourceId} is assigned to multiple catalog surfaces`,
          });
          continue;
        }

        sourceToSurfaceMap.set(sourceId, surface.id);
      }
    }

    for (const surface of controlPlane.surfaces) {
      if (!catalogSurfaceById(surfaceCatalog, surface.id)) {
        issues.push({
          level: "error",
          message: `Control-plane surface ${surface.id} is missing from the surface catalog`,
        });
      }
    }
  }

  if (inventory && surfaceCatalog) {
    for (const source of inventory.sources) {
      if (!sourceToSurfaceMap.has(source.id)) {
        issues.push({
          level: "error",
          message: `Inventory source ${source.id} is not assigned to any surface`,
        });
      }
    }
  }

  if (inventory && discoveredInventoryGrouped) {
    const declaredInventoryFiles = new Set(union([...inventoryFilesById.values()]));
    const issueLevel = discoveredCandidateIssueLevel(discoveryPolicy);

    for (const file of discoveredInventoryGrouped.sourcesByFile.keys()) {
      if (!declaredInventoryFiles.has(file)) {
        if (!issueLevel) {
          continue;
        }
        issues.push({
          level: issueLevel,
          message: `Discovered runtime file ${file} is not represented in the declared inventory`,
        });
      }
    }
  }

  const obligationSources = new Map<string, string[]>();
  const obligationInventorySources = new Map<string, RuntimeInventorySource[]>();
  const obligationInventoryBehaviors = new Map<string, RuntimeInventoryBehavior[]>();
  const outcomesByBehavior = new Map<string, string[]>();
  let incompleteBehaviorUnits = 0;
  let uncoveredInventoryBehaviors = 0;

  for (const obligation of behaviorUnits) {
    const surface = surfaceById(controlPlane, obligation.surface);

    if (!surface) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} references unknown surface ${obligation.surface}`,
      });
      continue;
    }

    if (!obligation.event.trim()) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} is missing an event description`,
      });
    }

    if (obligation.outcomes.length === 0) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} has no outcomes`,
      });
    }

    if (obligation.evidence.length === 0) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} has no observable evidence`,
      });
    }

    for (const evidence of obligation.evidence) {
      if (!controlPlane.evidenceKinds.includes(evidence)) {
        issues.push({
          level: "error",
          message: `Behavior ${obligation.id} uses unsupported evidence kind ${evidence}`,
        });
      }
    }

    if (!controlPlane.fidelityLevels.includes(obligation.fidelity)) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} uses unsupported fidelity ${obligation.fidelity}`,
      });
    }

    const implementationStatus = behaviorImplementationStatus(obligation);
    if (implementationStatus !== "implemented") {
      incompleteBehaviorUnits += 1;
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} is marked ${implementationStatus} and is not fully implemented`,
      });
    }

    const sources = expandPatterns(
      repoRoot,
      obligation.sourcePatterns,
      surface.sourceIgnorePatterns ?? [],
    );
    obligationSources.set(obligation.id, sources);

    if (sources.length === 0) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} did not resolve any runtime sources`,
      });
    }

    const matchedInventorySources = inventory
      ? obligation.inventorySourceIds && obligation.inventorySourceIds.length > 0
        ? obligation.inventorySourceIds
            .map((sourceId) => inventorySourceById(inventory, sourceId))
            .filter((source): source is RuntimeInventorySource => Boolean(source))
        : inventory.sources.filter((source) => {
            if (overlap(sources, inventoryFilesById.get(source.id) ?? []).length === 0) {
              return false;
            }

            if (!surfaceCatalog) {
              return true;
            }

            return sourceToSurfaceMap.get(source.id) === obligation.surface;
          })
      : [];
    obligationInventorySources.set(obligation.id, matchedInventorySources);

    if (inventory && obligation.inventorySourceIds?.length) {
      for (const sourceId of obligation.inventorySourceIds) {
        if (!inventorySourceById(inventory, sourceId)) {
          issues.push({
            level: "error",
            message: `Behavior ${obligation.id} references unknown inventory source ${sourceId}`,
          });
        }
      }
    }

    if (inventory && matchedInventorySources.length === 0) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} is not traceable to any inventory source`,
      });
    }

    const matchedInventoryBehaviors = inventory
      ? inventoryBehaviors.filter((inventoryBehavior) =>
          behaviorMatchesInventoryBehavior(
            obligation,
            inventoryBehavior,
            matchedInventorySources,
          ))
      : [];
    obligationInventoryBehaviors.set(obligation.id, matchedInventoryBehaviors);

    if (inventory && obligation.inventoryBehaviorIds?.length) {
      for (const behaviorId of obligation.inventoryBehaviorIds) {
        if (!inventoryBehaviorById(inventoryBehaviors, behaviorId)) {
          issues.push({
            level: "error",
            message: `Behavior ${obligation.id} references unknown inventory behavior ${behaviorId}`,
          });
        }
      }
    }

    outcomesByBehavior.set(obligation.id, parseOutcomeClasses(obligation));

    const minimumFidelity = resolveMinimumFidelity({
      controlPlane,
      obligation,
      surface: catalogSurfaceById(surfaceCatalog, obligation.surface),
      inventorySources: matchedInventorySources,
      inventoryBehaviors: matchedInventoryBehaviors,
      fidelityPolicy,
    });

    if (
      minimumFidelity &&
      !obligationMeetsFidelity(
        obligation.fidelity,
        minimumFidelity,
        fidelityPolicy?.fidelityLevels.length
          ? fidelityPolicy.fidelityLevels
          : controlPlane.fidelityLevels,
      )
    ) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} has fidelity ${obligation.fidelity}, below required minimum ${minimumFidelity}`,
      });
    }

    const ownerTests = behaviorOwnerTests(obligation);
    if (ownerTests.length === 0) {
      issues.push({
        level: "error",
        message: `Behavior ${obligation.id} does not declare any owner tests`,
      });
    }

    for (const ownerTest of ownerTests) {
      const absoluteOwnerTest = path.join(repoRoot, ownerTest);
      if (!existsSync(absoluteOwnerTest)) {
        issues.push({
          level: "error",
          message: `Behavior ${obligation.id} references missing owner test ${ownerTest}`,
        });
        continue;
      }

      const knownSurfaceTests = surfaceTests.get(surface.id) ?? [];
      if (!knownSurfaceTests.includes(ownerTest)) {
        issues.push({
          level: "error",
          message: `Behavior ${obligation.id} references ${ownerTest}, which is not registered under surface ${surface.id}`,
        });
      }

      if (!referencedTestsBySurface.has(surface.id)) {
        referencedTestsBySurface.set(surface.id, new Set<string>());
      }
      referencedTestsBySurface.get(surface.id)?.add(ownerTest);

      if (!cachedTestSources.has(ownerTest)) {
        cachedTestSources.set(ownerTest, readFileSync(absoluteOwnerTest, "utf8"));
      }

      const annotatedIds = parseRuntimeObligationsAnnotation(
        cachedTestSources.get(ownerTest) ?? "",
      );

      if (requireAnnotations && annotatedIds.length === 0) {
        issues.push({
          level: "error",
          message: `Owner test ${ownerTest} is missing a runtime-behaviors annotation`,
        });
      }

      if (annotatedIds.length > 0 && !annotatedIds.includes(obligation.id)) {
        issues.push({
          level: "error",
          message: `Test ${ownerTest} has runtime-behaviors annotation but does not include ${obligation.id}`,
        });
      }
    }
  }

  if (inventory && surfaceCatalog) {
    for (const source of inventory.sources) {
      const surfaceId = sourceToSurfaceMap.get(source.id);
      if (!surfaceId) {
        continue;
      }

      const catalogSurface = catalogSurfaceById(surfaceCatalog, surfaceId);
      const obligations = behaviorUnits.filter((obligation) =>
        obligationInventorySources
          .get(obligation.id)
          ?.some((matchedSource) => matchedSource.id === source.id),
      );

      if (obligations.length === 0) {
        issues.push({
          level: "error",
          message: `Inventory source ${source.id} does not have any owning behavior units`,
        });
        continue;
      }

      const observedEvidence = union(obligations.map((obligation) => obligation.evidence));
      const expectedEvidence = union([
        source.expectedEvidence ?? [],
        catalogSurface?.requiredEvidence ?? [],
      ]);

      for (const evidence of expectedEvidence) {
        if (!observedEvidence.includes(evidence)) {
          issues.push({
            level: "error",
            message: `Inventory source ${source.id} is missing required evidence ${evidence}`,
          });
        }
      }

      const observedOutcomeClasses = union(
        obligations.map((obligation) => outcomesByBehavior.get(obligation.id) ?? []),
      );
      const expectedOutcomeClasses = union([
        source.expectedOutcomeClasses ?? [],
        catalogSurface?.requiredOutcomeClasses ?? [],
      ]);

      for (const outcomeClass of expectedOutcomeClasses) {
        if (!observedOutcomeClasses.includes(outcomeClass)) {
          issues.push({
            level: "error",
            message: `Inventory source ${source.id} is missing required outcome class ${outcomeClass}`,
          });
        }
      }

      const inventorySourceQualityRule = resolveInventorySourceQualityRule(
        qualityPolicy,
        surfaceId,
        source.id,
      );
      const resolvedFiles = inventoryFilesById.get(source.id)?.length ?? 0;
      if (
        inventorySourceQualityRule?.maxExpandedFiles !== undefined &&
        resolvedFiles > inventorySourceQualityRule.maxExpandedFiles
      ) {
        issues.push({
          level: inventorySourceQualityRule.level ?? "error",
          message: `Inventory source ${source.id} resolves ${resolvedFiles} files, above the allowed maximum ${inventorySourceQualityRule.maxExpandedFiles}`,
        });
      }
    }
  }

  if (inventory) {
    for (const inventoryBehavior of inventoryBehaviors) {
      const source = inventorySourceById(inventory, inventoryBehavior.sourceId);
      if (!source) {
        continue;
      }

      const surfaceId = sourceToSurfaceMap.get(source.id);
      const catalogSurface = surfaceId ? catalogSurfaceById(surfaceCatalog, surfaceId) : undefined;
      const implementingBehaviors = behaviorUnits.filter((behavior) =>
        obligationInventoryBehaviors
          .get(behavior.id)
          ?.some((matchedBehavior) => matchedBehavior.id === inventoryBehavior.id),
      );

      if (implementingBehaviors.length === 0) {
        uncoveredInventoryBehaviors += 1;
        issues.push({
          level: "error",
          message: `Inventory behavior ${inventoryBehavior.id} does not have any implementing behavior units`,
        });
        continue;
      }

      const observedEvidence = union(implementingBehaviors.map((behavior) => behavior.evidence));
      const expectedEvidence = union([
        ...(inventoryHasExplicitBehaviors ? [] : [source.expectedEvidence ?? []]),
        inventoryBehavior.expectedEvidence ?? [],
        catalogSurface?.requiredEvidence ?? [],
      ]);

      for (const evidence of expectedEvidence) {
        if (!observedEvidence.includes(evidence)) {
          issues.push({
            level: "error",
            message: `Inventory behavior ${inventoryBehavior.id} is missing required evidence ${evidence}`,
          });
        }
      }

      const observedOutcomeClasses = union(
        implementingBehaviors.map((behavior) => outcomesByBehavior.get(behavior.id) ?? []),
      );
      const expectedOutcomeClasses = union([
        ...(inventoryHasExplicitBehaviors ? [] : [source.expectedOutcomeClasses ?? []]),
        inventoryBehavior.expectedOutcomeClasses ?? [],
        catalogSurface?.requiredOutcomeClasses ?? [],
      ]);

      for (const outcomeClass of expectedOutcomeClasses) {
        if (!observedOutcomeClasses.includes(outcomeClass)) {
          issues.push({
            level: "error",
            message: `Inventory behavior ${inventoryBehavior.id} is missing required outcome class ${outcomeClass}`,
          });
        }
      }

      const minimumBehaviorFidelity = maxFidelity(
        [
          ...(inventoryHasExplicitBehaviors ? [] : [source.minimumFidelity]),
          inventoryBehavior.minimumFidelity,
          catalogSurface?.minimumFidelity,
        ],
        fidelityPolicy?.fidelityLevels.length
          ? fidelityPolicy.fidelityLevels
          : controlPlane.fidelityLevels,
      );

      if (
        minimumBehaviorFidelity &&
        !implementingBehaviors.some((behavior) =>
          obligationMeetsFidelity(
            behavior.fidelity,
            minimumBehaviorFidelity,
            fidelityPolicy?.fidelityLevels.length
              ? fidelityPolicy.fidelityLevels
              : controlPlane.fidelityLevels,
          ))
      ) {
        issues.push({
          level: "error",
          message: `Inventory behavior ${inventoryBehavior.id} does not have any implementing behavior unit at minimum fidelity ${minimumBehaviorFidelity}`,
        });
      }
    }
  }

  for (const obligation of behaviorUnits) {
    const obligationQualityRule = resolveBehaviorQualityRule(
      qualityPolicy,
      obligation.surface,
      obligation.id,
    );

    if (!obligationQualityRule) {
      continue;
    }

    const resolvedFiles = obligationSources.get(obligation.id)?.length ?? 0;
    if (
      obligationQualityRule.maxExpandedFiles !== undefined &&
      resolvedFiles > obligationQualityRule.maxExpandedFiles
    ) {
      issues.push({
        level: obligationQualityRule.level ?? "error",
        message: `Behavior ${obligation.id} resolves ${resolvedFiles} files, above the allowed maximum ${obligationQualityRule.maxExpandedFiles}`,
      });
    }

    const tracedInventorySources = obligationInventorySources.get(obligation.id)?.length ?? 0;
    if (
      obligationQualityRule.maxInventorySources !== undefined &&
      tracedInventorySources > obligationQualityRule.maxInventorySources
    ) {
      issues.push({
        level: obligationQualityRule.level ?? "error",
        message: `Behavior ${obligation.id} spans ${tracedInventorySources} inventory sources, above the allowed maximum ${obligationQualityRule.maxInventorySources}`,
      });
    }

    const tracedInventoryBehaviors = obligationInventoryBehaviors.get(obligation.id)?.length ?? 0;
    if (
      obligationQualityRule.maxInventoryBehaviors !== undefined &&
      tracedInventoryBehaviors > obligationQualityRule.maxInventoryBehaviors
    ) {
      issues.push({
        level: obligationQualityRule.level ?? "error",
        message: `Behavior ${obligation.id} spans ${tracedInventoryBehaviors} inventory behaviors, above the allowed maximum ${obligationQualityRule.maxInventoryBehaviors}`,
      });
    }
  }

  const surfaceSummaries: SurfaceSummary[] = controlPlane.surfaces.map((surface) => {
    const sources = surfaceSources.get(surface.id) ?? [];
    const tests = surfaceTests.get(surface.id) ?? [];
    const obligations = behaviorUnits.filter(
      (obligation) => obligation.surface === surface.id,
    );
    const coveredSources = new Set<string>();

    for (const obligation of obligations) {
      for (const source of obligationSources.get(obligation.id) ?? []) {
        coveredSources.add(source);
      }
    }

    const uncoveredSources = sources.filter((source) => !coveredSources.has(source));
    for (const source of uncoveredSources) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} has an uncovered runtime source: ${source}`,
      });
    }

    const referencedTests = referencedTestsBySurface.get(surface.id) ?? new Set<string>();
    const unreferencedTests = tests.filter((testFile) => !referencedTests.has(testFile));
    for (const testFile of unreferencedTests) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} has an unreferenced owner test: ${testFile}`,
      });
    }

    if (inventory && surfaceCatalog) {
      const catalogSurface = catalogSurfaceById(surfaceCatalog, surface.id);
      const expectedSourceFiles = catalogSurface
        ? union(
            catalogSurface.inventorySourceIds.map(
              (sourceId) => inventoryFilesById.get(sourceId) ?? [],
            ),
          )
        : [];

      const missingFromSurface = expectedSourceFiles.filter((file) => !sources.includes(file));
      const extraInSurface = sources.filter((file) => !expectedSourceFiles.includes(file));

      for (const file of missingFromSurface) {
        issues.push({
          level: "error",
          message: `Surface ${surface.id} is missing inventory-mapped source ${file}`,
        });
      }

      for (const file of extraInSurface) {
        issues.push({
          level: "error",
          message: `Surface ${surface.id} includes source ${file} that is not represented in the inventory`,
        });
      }
    }

    return {
      id: surface.id,
      sources: sources.length,
      tests: tests.length,
      obligations: obligations.length,
      behaviors: obligations.length,
      inventoryBehaviors: inventoryBehaviors.filter((behavior) => sourceToSurfaceMap.get(behavior.sourceId) === surface.id).length,
      uncoveredSources,
      unreferencedTests,
    };
  });

  return {
    principle: controlPlane.principle,
    version: controlPlane.version,
    inventorySources: inventory?.sources.length,
    derivedSurfaces: surfaceCatalog?.surfaces.length,
    discoveredSources: discoveredInventory?.sources.length,
    discoveredFiles: discoveredInventoryGrouped?.sourcesByFile.size,
    discoveryScopePatterns: discoveryPolicy?.scopePatterns,
    inventoryBehaviors: inventoryBehaviors.length || undefined,
    behaviorUnits: behaviorUnits.length,
    incompleteBehaviorUnits,
    uncoveredInventoryBehaviors,
    surfaceSummaries,
    issues,
  };
}

export function printSummary(summary: ValidationSummary): void {
  const errorCount = summary.issues.filter((issue) => issue.level === "error").length;
  const warningCount = summary.issues.filter((issue) => issue.level === "warning").length;
  const validationState = errorCount > 0
    ? "failing"
    : warningCount > 0
      ? "review-required"
      : "clean";

  console.log(`Runtime behavior validation summary ${summary.version}`);
  console.log(`- validation state: ${validationState}`);
  if (summary.inventorySources !== undefined) {
    console.log(`- inventory sources: ${summary.inventorySources}`);
  }
  if (summary.inventoryBehaviors !== undefined) {
    console.log(`- inventory behaviors: ${summary.inventoryBehaviors}`);
  }
  if (summary.derivedSurfaces !== undefined) {
    console.log(`- catalog surfaces: ${summary.derivedSurfaces}`);
  }
  if (summary.discoveredSources !== undefined) {
    console.log(`- discovered sources: ${summary.discoveredSources}`);
  }
  if (summary.discoveredFiles !== undefined) {
    console.log(`- discovered files: ${summary.discoveredFiles}`);
  }
  console.log(`- behavior units: ${summary.behaviorUnits}`);
  console.log(`- incomplete behavior units: ${summary.incompleteBehaviorUnits}`);
  console.log(`- uncovered inventory behaviors: ${summary.uncoveredInventoryBehaviors}`);
  if (summary.discoveryScopePatterns?.length) {
    console.log(`- discovery scope: ${summary.discoveryScopePatterns.join(", ")}`);
  }

  for (const surface of summary.surfaceSummaries) {
    console.log(
      `- ${surface.id}: sources=${surface.sources}, tests=${surface.tests}, inventoryBehaviors=${surface.inventoryBehaviors}, behaviorUnits=${surface.behaviors}, uncovered=${surface.uncoveredSources.length}, unreferencedTests=${surface.unreferencedTests.length}`,
    );
  }

  if (summary.issues.length === 0) {
    console.log("- validation issues: 0");
    return;
  }

  console.log(`- errors: ${errorCount}`);
  console.log(`- warnings: ${warningCount}`);
  console.log("");
  for (const issue of summary.issues) {
    console.log(`[${issue.level}] ${issue.message}`);
  }
}
