import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { ErrorObject } from "ajv";
import type {
  FidelityPolicy,
  RuntimeDiscoveryPolicy,
  RuntimeControlPlane,
  RuntimeInventory,
  RuntimeQualityPolicy,
  RuntimeRetrospectiveLog,
  RuntimeSelfCheckPolicy,
  RuntimeSurfaceCatalog,
} from "./types.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default as new (options: Record<string, unknown>) => {
  compile: (schema: Record<string, unknown>) => {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

export type SchemaName =
  | "runtime-control-plane"
  | "runtime-inventory"
  | "runtime-surfaces"
  | "fidelity-policy"
  | "runtime-quality-policy"
  | "runtime-discovery-policy"
  | "runtime-self-check-policy"
  | "runtime-retrospective";

function schemaPath(schemaName: SchemaName): string {
  return path.join(packageRoot, "schema", `${schemaName}.schema.json`);
}

export function getSchemaPath(schemaName: SchemaName = "runtime-control-plane"): string {
  return schemaPath(schemaName);
}

export function readSchema(schemaName: SchemaName = "runtime-control-plane"): Record<string, unknown> {
  return JSON.parse(readFileSync(schemaPath(schemaName), "utf8")) as Record<string, unknown>;
}

function validateShape(
  value: unknown,
  schemaName: SchemaName,
): string[] {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readSchema(schemaName));
  const valid = validate(value);

  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map((error: ErrorObject) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? "is invalid"}`.trim();
  });
}

export function validateControlPlaneShape(controlPlane: RuntimeControlPlane): string[] {
  return validateShape(controlPlane, "runtime-control-plane");
}

export function validateInventoryShape(inventory: RuntimeInventory): string[] {
  return validateShape(inventory, "runtime-inventory");
}

export function validateSurfaceCatalogShape(surfaceCatalog: RuntimeSurfaceCatalog): string[] {
  return validateShape(surfaceCatalog, "runtime-surfaces");
}

export function validateFidelityPolicyShape(fidelityPolicy: FidelityPolicy): string[] {
  return validateShape(fidelityPolicy, "fidelity-policy");
}

export function validateQualityPolicyShape(qualityPolicy: RuntimeQualityPolicy): string[] {
  return validateShape(qualityPolicy, "runtime-quality-policy");
}

export function validateDiscoveryPolicyShape(discoveryPolicy: RuntimeDiscoveryPolicy): string[] {
  return validateShape(discoveryPolicy, "runtime-discovery-policy");
}

export function validateSelfCheckPolicyShape(selfCheckPolicy: RuntimeSelfCheckPolicy): string[] {
  return validateShape(selfCheckPolicy, "runtime-self-check-policy");
}

export function validateRetrospectiveShape(retrospective: RuntimeRetrospectiveLog): string[] {
  return validateShape(retrospective, "runtime-retrospective");
}
