import type { RuntimeInventory, RuntimeInventoryBehavior } from "./types.js";

export function getInventoryBehaviors(
  inventory?: RuntimeInventory,
): RuntimeInventoryBehavior[] {
  if (!inventory) {
    return [];
  }

  if (inventory.behaviors && inventory.behaviors.length > 0) {
    return inventory.behaviors;
  }

  return inventory.sources.flatMap((source) =>
    source.events.map((event, index) => ({
      id: `${source.id}.event-${index + 1}`,
      sourceId: source.id,
      event,
      expectedEvidence: source.expectedEvidence,
      expectedOutcomeClasses: source.expectedOutcomeClasses,
      minimumFidelity: source.minimumFidelity,
    })),
  );
}
