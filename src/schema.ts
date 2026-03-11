import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { ErrorObject } from "ajv";
import type { RuntimeControlPlane } from "./types.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(packageRoot, "schema", "runtime-control-plane.schema.json");
const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default as new (options: Record<string, unknown>) => {
  compile: (schema: Record<string, unknown>) => {
    (data: unknown): boolean;
    errors?: ErrorObject[] | null;
  };
};

export function getSchemaPath(): string {
  return schemaPath;
}

export function readSchema(): Record<string, unknown> {
  return JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
}

export function validateControlPlaneShape(controlPlane: RuntimeControlPlane): string[] {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(readSchema());
  const valid = validate(controlPlane);

  if (valid) {
    return [];
  }

  return (validate.errors ?? []).map((error: ErrorObject) => {
    const location = error.instancePath || "/";
    return `${location} ${error.message ?? "is invalid"}`.trim();
  });
}
