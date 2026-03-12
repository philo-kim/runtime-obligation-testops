import type { RuntimeBehaviorUnit, RuntimeControlPlane } from "./types.js";

export function getBehaviorUnits(controlPlane: RuntimeControlPlane): RuntimeBehaviorUnit[] {
  if (controlPlane.behaviors && controlPlane.behaviors.length > 0) {
    return controlPlane.behaviors;
  }

  return controlPlane.obligations ?? [];
}

export function behaviorOwnerTests(behavior: RuntimeBehaviorUnit): string[] {
  return behavior.ownerTests ?? [];
}

export function behaviorImplementationStatus(behavior: RuntimeBehaviorUnit): string {
  return behavior.implementationStatus ?? (behaviorOwnerTests(behavior).length > 0 ? "implemented" : "missing");
}
