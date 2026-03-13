import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  DEFAULT_CONFIG_PATH,
  DEFAULT_DISCOVERY_POLICY_PATH,
  DEFAULT_FIDELITY_POLICY_PATH,
  DEFAULT_INVENTORY_PATH,
  DEFAULT_QUALITY_POLICY_PATH,
  DEFAULT_RETROSPECTIVE_PATH,
  DEFAULT_SELF_CHECK_POLICY_PATH,
  DEFAULT_SURFACES_PATH,
} from "./constants.js";
import type {
  RuntimeDiscoveryPolicy,
  FidelityPolicy,
  ProjectModel,
  RuntimeControlPlane,
  RuntimeInventory,
  RuntimeQualityPolicy,
  RuntimeRetrospectiveLog,
  RuntimeSelfCheckPolicy,
  RuntimeSurfaceCatalog,
} from "./types.js";

export interface ProjectPathOptions {
  controlPlanePath?: string;
  inventoryPath?: string;
  surfaceCatalogPath?: string;
  fidelityPolicyPath?: string;
  qualityPolicyPath?: string;
  discoveryPolicyPath?: string;
  selfCheckPolicyPath?: string;
  retrospectiveLogPath?: string;
}

export interface ResolvedProjectPaths {
  controlPlanePath: string;
  inventoryPath: string;
  surfaceCatalogPath: string;
  fidelityPolicyPath: string;
  qualityPolicyPath: string;
  discoveryPolicyPath: string;
  selfCheckPolicyPath: string;
  retrospectiveLogPath: string;
}

function resolvePath(root: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function resolveProjectPaths(
  repoRoot: string,
  options: ProjectPathOptions = {},
): ResolvedProjectPaths {
  return {
    controlPlanePath: resolvePath(
      repoRoot,
      options.controlPlanePath ?? DEFAULT_CONFIG_PATH,
    ),
    inventoryPath: resolvePath(
      repoRoot,
      options.inventoryPath ?? DEFAULT_INVENTORY_PATH,
    ),
    surfaceCatalogPath: resolvePath(
      repoRoot,
      options.surfaceCatalogPath ?? DEFAULT_SURFACES_PATH,
    ),
    fidelityPolicyPath: resolvePath(
      repoRoot,
      options.fidelityPolicyPath ?? DEFAULT_FIDELITY_POLICY_PATH,
    ),
    qualityPolicyPath: resolvePath(
      repoRoot,
      options.qualityPolicyPath ?? DEFAULT_QUALITY_POLICY_PATH,
    ),
    discoveryPolicyPath: resolvePath(
      repoRoot,
      options.discoveryPolicyPath ?? DEFAULT_DISCOVERY_POLICY_PATH,
    ),
    selfCheckPolicyPath: resolvePath(
      repoRoot,
      options.selfCheckPolicyPath ?? DEFAULT_SELF_CHECK_POLICY_PATH,
    ),
    retrospectiveLogPath: resolvePath(
      repoRoot,
      options.retrospectiveLogPath ?? DEFAULT_RETROSPECTIVE_PATH,
    ),
  };
}

export function loadProjectModel(
  repoRoot: string,
  options: ProjectPathOptions = {},
): ProjectModel {
  const paths = resolveProjectPaths(repoRoot, options);
  const controlPlane = readJsonFile<RuntimeControlPlane>(paths.controlPlanePath);

  const inventory = existsSync(paths.inventoryPath)
    ? readJsonFile<RuntimeInventory>(paths.inventoryPath)
    : undefined;
  const surfaceCatalog = existsSync(paths.surfaceCatalogPath)
    ? readJsonFile<RuntimeSurfaceCatalog>(paths.surfaceCatalogPath)
    : undefined;
  const fidelityPolicy = existsSync(paths.fidelityPolicyPath)
    ? readJsonFile<FidelityPolicy>(paths.fidelityPolicyPath)
    : undefined;
  const qualityPolicy = existsSync(paths.qualityPolicyPath)
    ? readJsonFile<RuntimeQualityPolicy>(paths.qualityPolicyPath)
    : undefined;
  const discoveryPolicy = existsSync(paths.discoveryPolicyPath)
    ? readJsonFile<RuntimeDiscoveryPolicy>(paths.discoveryPolicyPath)
    : undefined;
  const selfCheckPolicy = existsSync(paths.selfCheckPolicyPath)
    ? readJsonFile<RuntimeSelfCheckPolicy>(paths.selfCheckPolicyPath)
    : undefined;
  const retrospectiveLog = existsSync(paths.retrospectiveLogPath)
    ? readJsonFile<RuntimeRetrospectiveLog>(paths.retrospectiveLogPath)
    : undefined;

  return {
    controlPlane,
    inventory,
    surfaceCatalog,
    fidelityPolicy,
    qualityPolicy,
    discoveryPolicy,
    selfCheckPolicy,
    retrospectiveLog,
  };
}
