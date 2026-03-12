import type {
  RuntimeInventoryBehavior,
  FidelityPolicy,
  RuntimeControlPlane,
  RuntimeBehaviorUnit,
  RuntimeInventorySource,
  RuntimeSurfaceDefinition,
} from "./types.js";

const DEFAULT_FIDELITY_ORDER = [
  "isolated",
  "simulated",
  "contract",
  "real-dependency",
  "full-system",
];

function fidelityOrder(levels?: string[]): string[] {
  return levels && levels.length > 0 ? levels : DEFAULT_FIDELITY_ORDER;
}

function fidelityIndex(level: string, levels?: string[]): number {
  const order = fidelityOrder(levels);
  const index = order.indexOf(level);
  return index === -1 ? order.length : index;
}

export function compareFidelity(
  left: string,
  right: string,
  levels?: string[],
): number {
  return fidelityIndex(left, levels) - fidelityIndex(right, levels);
}

export function maxFidelity(
  values: Array<string | undefined>,
  levels?: string[],
): string | undefined {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) {
    return undefined;
  }

  return filtered.reduce((current, candidate) =>
    compareFidelity(candidate, current, levels) > 0 ? candidate : current,
  );
}

export function obligationMeetsFidelity(
  actual: string,
  minimum: string,
  levels?: string[],
): boolean {
  return compareFidelity(actual, minimum, levels) >= 0;
}

export function resolveMinimumFidelity(args: {
  controlPlane: RuntimeControlPlane;
  obligation: RuntimeBehaviorUnit;
  surface?: RuntimeSurfaceDefinition;
  inventorySources?: RuntimeInventorySource[];
  inventoryBehaviors?: RuntimeInventoryBehavior[];
  fidelityPolicy?: FidelityPolicy;
}): string | undefined {
  const {
    controlPlane,
    obligation,
    surface,
    inventorySources = [],
    inventoryBehaviors = [],
    fidelityPolicy,
  } = args;
  const levels =
    fidelityPolicy?.fidelityLevels.length
      ? fidelityPolicy.fidelityLevels
      : controlPlane.fidelityLevels;

  const surfacePolicy = fidelityPolicy?.surfacePolicies?.find(
    (policy) => policy.surfaceId === obligation.surface,
  );
  const behaviorPolicy = [
    ...(fidelityPolicy?.behaviorPolicies ?? []),
    ...((fidelityPolicy?.obligationPolicies ?? []).map((policy) => ({
      ...policy,
      behaviorId: policy.behaviorId ?? policy.obligationId,
    }))),
  ].find((policy) => policy.behaviorId === obligation.id);

  const inventoryPolicies = inventorySources
    .map((source) =>
      fidelityPolicy?.inventorySourcePolicies?.find(
        (policy) => policy.inventorySourceId === source.id,
      ),
    )
    .filter(Boolean);

  return maxFidelity(
    [
      fidelityPolicy?.defaultMinimumFidelity,
      surface?.minimumFidelity,
      surfacePolicy?.minimumFidelity,
      ...inventorySources.map((source) => source.minimumFidelity),
      ...inventoryBehaviors.map((behavior) => behavior.minimumFidelity),
      ...inventoryPolicies.map((policy) => policy?.minimumFidelity),
      behaviorPolicy?.minimumFidelity,
    ],
    levels,
  );
}
