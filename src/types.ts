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

export type RuntimeBehaviorImplementationStatus = "implemented" | "partial" | "missing";

export interface RuntimeBehaviorUnit {
  id: string;
  surface: string;
  sourcePatterns: string[];
  inventorySourceIds?: string[];
  event: string;
  outcomes: string[];
  outcomeClasses?: string[];
  evidence: string[];
  fidelity: string;
  ownerTests?: string[];
  implementationStatus?: RuntimeBehaviorImplementationStatus;
}

export type Obligation = RuntimeBehaviorUnit;

export interface RuntimeControlPlane {
  $schema?: string;
  version: string;
  principle: string;
  evidenceKinds: string[];
  fidelityLevels: string[];
  surfaces: Surface[];
  obligations?: RuntimeBehaviorUnit[];
  behaviors?: RuntimeBehaviorUnit[];
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

export interface InventorySourceQualityRule {
  maxExpandedFiles?: number;
  level?: "error" | "warning";
}

export interface ObligationQualityRule {
  maxExpandedFiles?: number;
  maxInventorySources?: number;
  level?: "error" | "warning";
}

export interface SurfaceQualityPolicy {
  surfaceId: string;
  inventorySourceRule?: InventorySourceQualityRule;
  obligationRule?: ObligationQualityRule;
}

export interface InventorySourceQualityPolicy extends InventorySourceQualityRule {
  inventorySourceId: string;
}

export interface ObligationQualityPolicy extends ObligationQualityRule {
  obligationId: string;
}

export interface RuntimeQualityPolicy {
  $schema?: string;
  version: string;
  principle: string;
  defaultInventorySourceRule?: InventorySourceQualityRule;
  defaultObligationRule?: ObligationQualityRule;
  surfacePolicies?: SurfaceQualityPolicy[];
  inventorySourcePolicies?: InventorySourceQualityPolicy[];
  obligationPolicies?: ObligationQualityPolicy[];
}

export interface RuntimeDiscoverySuppression {
  filePatterns: string[];
  reason: string;
}

export type RuntimeDiscoveryCandidateReviewMode = "error" | "warning" | "off";

export type RuntimeDiscoverySourceOverrideMode = "merge" | "replace";

export interface RuntimeDiscoverySourceOverride {
  sourceId: string;
  includePatterns?: string[];
  excludePatterns?: string[];
  mode?: RuntimeDiscoverySourceOverrideMode;
}

export interface RuntimeDiscoveryPolicy {
  $schema?: string;
  version: string;
  principle: string;
  candidateReviewMode?: RuntimeDiscoveryCandidateReviewMode;
  codeFilePatterns?: string[];
  sourceExtensions?: string[];
  scopePatterns?: string[];
  ignorePatterns?: string[];
  suppressions?: RuntimeDiscoverySuppression[];
  sourceOverrides?: RuntimeDiscoverySourceOverride[];
}

export interface ProjectModel {
  controlPlane: RuntimeControlPlane;
  inventory?: RuntimeInventory;
  surfaceCatalog?: RuntimeSurfaceCatalog;
  fidelityPolicy?: FidelityPolicy;
  qualityPolicy?: RuntimeQualityPolicy;
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
  behaviors: number;
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
  discoveryScopePatterns?: string[];
  behaviorUnits: number;
  incompleteBehaviorUnits: number;
  surfaceSummaries: SurfaceSummary[];
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  requireAnnotations?: boolean;
  inventory?: RuntimeInventory;
  surfaceCatalog?: RuntimeSurfaceCatalog;
  fidelityPolicy?: FidelityPolicy;
  qualityPolicy?: RuntimeQualityPolicy;
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
  impactedBehaviors: string[];
  impactedObligations: string[];
  impactedOwnerTests: string[];
}

export type ReviewSuggestedAction = "accept" | "suppress" | "review";

export interface ReviewCandidate {
  file: string;
  sourceIds: string[];
  sourceKinds: string[];
  surfaceHints: string[];
  minimumFidelity: string[];
  suggestedAction: ReviewSuggestedAction;
  reasons: string[];
}

export interface ReviewBacklog {
  principle: string;
  version: string;
  discoveryScopePatterns?: string[];
  discoveredSources: number;
  discoveredFiles: number;
  declaredInventoryFiles: number;
  unresolvedCandidates: number;
  candidates: ReviewCandidate[];
}

export interface RuntimeActorRole {
  id: string;
  responsibility: string;
  authority: string;
}

export interface RuntimeGovernanceSignal {
  id: string;
  meaning: string;
  primary: boolean;
  blocking: boolean;
}

export interface ArtifactPathMap {
  controlPlanePath: string;
  inventoryPath: string;
  surfaceCatalogPath: string;
  fidelityPolicyPath: string;
  qualityPolicyPath: string;
  discoveryPolicyPath: string;
}

export type AgentCommandId = "review" | "impact" | "validate";

export interface AgentCommand {
  id: AgentCommandId;
  command: string;
  purpose: string;
  blocking: boolean;
}

export interface RuntimeAgentContract {
  principle: string;
  version: string;
  systemIdentity: string;
  operatingModel: string;
  reviewedDecisionMeaning: string;
  actorRoles: RuntimeActorRole[];
  governanceSignals: RuntimeGovernanceSignal[];
  artifactPaths: ArtifactPathMap;
  readOrder: string[];
  mandatoryLoop: string[];
  requiredCommands: AgentCommand[];
}
