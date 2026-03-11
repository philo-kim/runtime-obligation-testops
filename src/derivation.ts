import { maxFidelity } from "./fidelity.js";
import type {
  RuntimeInventory,
  RuntimeInventorySource,
  RuntimeSurfaceCatalog,
  RuntimeSurfaceDefinition,
} from "./types.js";

interface SurfaceDefaults {
  id: string;
  description: string;
  requiredEvidence: string[];
  requiredOutcomeClasses: string[];
  minimumFidelity: string;
}

const DEFAULT_SURFACE_DEFAULTS: Record<string, SurfaceDefaults> = {
  auth: {
    id: "auth-access",
    description: "Authentication, authorization, and protected access guarantees.",
    requiredEvidence: ["response", "redirect"],
    requiredOutcomeClasses: ["success", "auth_denied", "failure"],
    minimumFidelity: "simulated",
  },
  request: {
    id: "request-boundary",
    description: "Externally reachable request handling and response contracts.",
    requiredEvidence: ["response"],
    requiredOutcomeClasses: ["success", "validation_error", "failure"],
    minimumFidelity: "simulated",
  },
  bootstrap: {
    id: "app-bootstrap",
    description: "Runtime bootstrap and first-load state initialization.",
    requiredEvidence: ["state_transition", "derived_view"],
    requiredOutcomeClasses: ["success", "failure"],
    minimumFidelity: "simulated",
  },
  "ui-state": {
    id: "client-state",
    description: "Client-side state transitions that users can observe.",
    requiredEvidence: ["state_transition", "derived_view"],
    requiredOutcomeClasses: ["success", "failure"],
    minimumFidelity: "simulated",
  },
  workflow: {
    id: "workflow-orchestration",
    description: "Cross-step use case orchestration inside the product boundary.",
    requiredEvidence: ["response", "storage_write", "derived_view"],
    requiredOutcomeClasses: ["success", "failure"],
    minimumFidelity: "simulated",
  },
  persistence: {
    id: "persistence-semantics",
    description: "Storage, read-after-write, deduplication, and idempotency guarantees.",
    requiredEvidence: ["storage_write", "storage_read"],
    requiredOutcomeClasses: ["success", "duplicate", "failure"],
    minimumFidelity: "real-dependency",
  },
  background: {
    id: "background-execution",
    description: "Deferred, scheduled, queued, or worker-driven processing.",
    requiredEvidence: ["job_enqueue", "job_process", "storage_write"],
    requiredOutcomeClasses: ["success", "retry", "skipped", "failure"],
    minimumFidelity: "real-dependency",
  },
  external: {
    id: "external-contracts",
    description: "Provider contracts, schema drift, and upstream failure handling.",
    requiredEvidence: ["external_call", "response"],
    requiredOutcomeClasses: ["success", "provider_failure", "schema_drift"],
    minimumFidelity: "contract",
  },
  invariant: {
    id: "runtime-invariants",
    description: "Runtime invariants that must hold across wide input domains.",
    requiredEvidence: ["response", "derived_view"],
    requiredOutcomeClasses: ["success", "failure"],
    minimumFidelity: "isolated",
  },
};

function normalizeSurfaceId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function defaultsForSource(source: RuntimeInventorySource): SurfaceDefaults {
  const hint = source.surfaceHint ? normalizeSurfaceId(source.surfaceHint) : "";
  if (hint && DEFAULT_SURFACE_DEFAULTS[hint]) {
    return DEFAULT_SURFACE_DEFAULTS[hint];
  }

  if (hint) {
    return {
      id: hint,
      description: `Derived runtime surface for ${source.surfaceHint}.`,
      requiredEvidence: source.expectedEvidence ?? [],
      requiredOutcomeClasses: source.expectedOutcomeClasses ?? [],
      minimumFidelity: source.minimumFidelity ?? "simulated",
    };
  }

  return (
    DEFAULT_SURFACE_DEFAULTS[source.kind] ?? {
      id: normalizeSurfaceId(source.kind),
      description: `Derived runtime surface for source kind ${source.kind}.`,
      requiredEvidence: source.expectedEvidence ?? [],
      requiredOutcomeClasses: source.expectedOutcomeClasses ?? [],
      minimumFidelity: source.minimumFidelity ?? "simulated",
    }
  );
}

export function deriveSurfaceCatalog(
  inventory: RuntimeInventory,
): RuntimeSurfaceCatalog {
  const grouped = new Map<string, RuntimeInventorySource[]>();

  for (const source of inventory.sources) {
    const defaults = defaultsForSource(source);
    const existing = grouped.get(defaults.id) ?? [];
    existing.push(source);
    grouped.set(defaults.id, existing);
  }

  const surfaces: RuntimeSurfaceDefinition[] = [...grouped.entries()]
    .map(([surfaceId, sources]) => {
      const defaults = defaultsForSource(sources[0]);

      return {
        id: surfaceId,
        description: defaults.description,
        inventorySourceIds: unique(sources.map((source) => source.id)).sort(),
        requiredEvidence: unique(
          sources.flatMap((source) => source.expectedEvidence ?? defaults.requiredEvidence),
        ).sort(),
        requiredOutcomeClasses: unique(
          sources.flatMap(
            (source) => source.expectedOutcomeClasses ?? defaults.requiredOutcomeClasses,
          ),
        ).sort(),
        minimumFidelity:
          maxFidelity(
            sources.map((source) => source.minimumFidelity ?? defaults.minimumFidelity),
            undefined,
          ) ?? defaults.minimumFidelity,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    $schema: "./runtime-surfaces.schema.json",
    version: inventory.version,
    principle: inventory.principle,
    surfaces,
  };
}
