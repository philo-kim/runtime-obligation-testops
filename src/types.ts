export interface ExecutionConfig {
  runner?: string;
  verifyCommand?: string;
  watchCommand?: string;
  environment?: string;
  setupFiles?: string[];
  include?: string[];
  exclude?: string[];
  testTimeout?: number;
  metadata?: Record<string, unknown>;
}

export interface Surface {
  id: string;
  description: string;
  sourcePatterns: string[];
  sourceIgnorePatterns?: string[];
  testPatterns: string[];
  testIgnorePatterns?: string[];
  execution?: ExecutionConfig;
}

export interface Obligation {
  id: string;
  surface: string;
  sourcePatterns: string[];
  event: string;
  outcomes: string[];
  outcomeClasses?: string[];
  evidence: string[];
  fidelity: string;
  ownerTests: string[];
}

export interface RuntimeControlPlane {
  $schema?: string;
  version: string;
  principle: string;
  evidenceKinds: string[];
  fidelityLevels: string[];
  surfaces: Surface[];
  obligations: Obligation[];
}

export interface RuntimeInventorySource {
  id: string;
  description: string;
  kind: string;
  sourcePatterns: string[];
  events: string[];
  expectedEvidence?: string[];
  expectedOutcomeClasses?: string[];
  surfaceHint?: string;
  minimumFidelity?: string;
}

export interface RuntimeInventory {
  $schema?: string;
  version: string;
  principle: string;
  sourceKinds: string[];
  sources: RuntimeInventorySource[];
}

export interface RuntimeSurfaceDefinition {
  id: string;
  description: string;
  inventorySourceIds: string[];
  requiredEvidence?: string[];
  requiredOutcomeClasses?: string[];
  minimumFidelity?: string;
}

export interface RuntimeSurfaceCatalog {
  $schema?: string;
  version: string;
  principle: string;
  surfaces: RuntimeSurfaceDefinition[];
}

export interface FidelityPolicyRule {
  minimumFidelity: string;
}

export interface SurfaceFidelityPolicy extends FidelityPolicyRule {
  surfaceId: string;
}

export interface InventorySourceFidelityPolicy extends FidelityPolicyRule {
  inventorySourceId: string;
}

export interface ObligationFidelityPolicy extends FidelityPolicyRule {
  obligationId: string;
}

export interface FidelityPolicy {
  $schema?: string;
  version: string;
  principle: string;
  fidelityLevels: string[];
  defaultMinimumFidelity?: string;
  surfacePolicies?: SurfaceFidelityPolicy[];
  inventorySourcePolicies?: InventorySourceFidelityPolicy[];
  obligationPolicies?: ObligationFidelityPolicy[];
}

export interface RuntimeDiscoverySuppression {
  filePatterns: string[];
  reason: string;
}

export interface RuntimeDiscoveryPolicy {
  $schema?: string;
  version: string;
  principle: string;
  ignorePatterns?: string[];
  suppressions?: RuntimeDiscoverySuppression[];
}

export interface ProjectModel {
  controlPlane: RuntimeControlPlane;
  inventory?: RuntimeInventory;
  surfaceCatalog?: RuntimeSurfaceCatalog;
  fidelityPolicy?: FidelityPolicy;
  discoveryPolicy?: RuntimeDiscoveryPolicy;
}

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface SurfaceSummary {
  id: string;
  sources: number;
  tests: number;
  obligations: number;
  uncoveredSources: string[];
  unreferencedTests: string[];
}

export interface ValidationSummary {
  principle: string;
  version: string;
  inventorySources?: number;
  derivedSurfaces?: number;
  discoveredSources?: number;
  discoveredFiles?: number;
  surfaceSummaries: SurfaceSummary[];
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  requireAnnotations?: boolean;
  inventory?: RuntimeInventory;
  surfaceCatalog?: RuntimeSurfaceCatalog;
  fidelityPolicy?: FidelityPolicy;
  discoveryPolicy?: RuntimeDiscoveryPolicy;
  discoveredInventory?: RuntimeInventory;
}

export interface InitResult {
  written: string[];
  skipped: string[];
}

export interface ImpactAnalysis {
  changedFiles: string[];
  impactedInventorySources: string[];
  impactedSurfaces: string[];
  impactedObligations: string[];
  impactedOwnerTests: string[];
}
