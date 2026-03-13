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
  inventoryBehaviorIds?: string[];
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

export interface RuntimeInventoryBehavior {
  id: string;
  sourceId: string;
  event: string;
  expectedEvidence?: string[];
  expectedOutcomeClasses?: string[];
  minimumFidelity?: string;
}

export interface RuntimeInventory {
  $schema?: string;
  version: string;
  principle: string;
  sourceKinds: string[];
  sources: RuntimeInventorySource[];
  behaviors?: RuntimeInventoryBehavior[];
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

export interface BehaviorFidelityPolicy extends FidelityPolicyRule {
  behaviorId?: string;
  obligationId?: string;
}

export type ObligationFidelityPolicy = BehaviorFidelityPolicy;

export interface FidelityPolicy {
  $schema?: string;
  version: string;
  principle: string;
  fidelityLevels: string[];
  defaultMinimumFidelity?: string;
  surfacePolicies?: SurfaceFidelityPolicy[];
  inventorySourcePolicies?: InventorySourceFidelityPolicy[];
  behaviorPolicies?: BehaviorFidelityPolicy[];
  obligationPolicies?: ObligationFidelityPolicy[];
}

export interface InventorySourceQualityRule {
  maxExpandedFiles?: number;
  level?: "error" | "warning";
}

export interface BehaviorQualityRule {
  maxExpandedFiles?: number;
  maxInventorySources?: number;
  maxInventoryBehaviors?: number;
  level?: "error" | "warning";
}

export type ObligationQualityRule = BehaviorQualityRule;

export interface SurfaceQualityPolicy {
  surfaceId: string;
  inventorySourceRule?: InventorySourceQualityRule;
  behaviorRule?: BehaviorQualityRule;
  obligationRule?: ObligationQualityRule;
}

export interface InventorySourceQualityPolicy extends InventorySourceQualityRule {
  inventorySourceId: string;
}

export interface BehaviorQualityPolicy extends BehaviorQualityRule {
  behaviorId?: string;
  obligationId?: string;
}

export type ObligationQualityPolicy = BehaviorQualityPolicy;

export interface RuntimeQualityPolicy {
  $schema?: string;
  version: string;
  principle: string;
  defaultInventorySourceRule?: InventorySourceQualityRule;
  defaultBehaviorRule?: BehaviorQualityRule;
  defaultObligationRule?: ObligationQualityRule;
  surfacePolicies?: SurfaceQualityPolicy[];
  inventorySourcePolicies?: InventorySourceQualityPolicy[];
  behaviorPolicies?: BehaviorQualityPolicy[];
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
  selfCheckPolicy?: RuntimeSelfCheckPolicy;
  retrospectiveLog?: RuntimeRetrospectiveLog;
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
  inventoryBehaviors: number;
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
  inventoryBehaviors?: number;
  behaviorUnits: number;
  incompleteBehaviorUnits: number;
  uncoveredInventoryBehaviors: number;
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
  impactedInventoryBehaviors: string[];
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

export interface RiskyKindFidelityRule {
  kindPattern: string;
  minimumFidelity: string;
  level?: "error" | "warning";
}

export interface KindBehaviorExpectationRule {
  kindPattern: string;
  requiredOutcomeClasses?: string[];
  requiredEvidence?: string[];
  level?: "error" | "warning";
}

export interface FidelityOwnerTestRule {
  minimumFidelity: string;
  requireOwnerTestPatterns: string[];
  kindPattern?: string;
  level?: "error" | "warning";
}

export interface RuntimeSelfCheckPolicy {
  $schema?: string;
  version: string;
  principle: string;
  requireExplicitInventoryBehaviors?: boolean;
  requireExplicitBehaviorMappings?: boolean;
  maxBehaviorsPerOwnerTest?: number;
  maxOwnerTestsPerBehavior?: number;
  riskyKindMinimumFidelity?: RiskyKindFidelityRule[];
  kindExpectationRules?: KindBehaviorExpectationRule[];
  fidelityOwnerTestRules?: FidelityOwnerTestRule[];
}

export interface SelfCheckIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  inventoryBehaviorId?: string;
  behaviorId?: string;
  ownerTest?: string;
}

export interface SelfCheckSummary {
  principle: string;
  version: string;
  explicitInventoryBehaviors: boolean;
  inventoryBehaviors: number;
  behaviorUnits: number;
  ownerTests: number;
  issues: SelfCheckIssue[];
}

export type RetrospectiveDetectedBy =
  | "qa"
  | "production"
  | "support"
  | "developer"
  | "agent"
  | "test-failure";

export type RetrospectiveStatus = "open" | "hardened" | "closed";

export type RetrospectiveRootCause =
  | "missing-reviewed-behavior"
  | "coarse-behavior-unit"
  | "weak-evidence"
  | "weak-fidelity"
  | "missing-owner-test"
  | "scanner-blind-spot"
  | "suppression-mistake"
  | "state-transition-gap"
  | "persistence-gap"
  | "background-gap";

export interface RuntimeRetrospectiveEntry {
  id: string;
  title: string;
  summary: string;
  detectedBy: RetrospectiveDetectedBy;
  status: RetrospectiveStatus;
  rootCauses: RetrospectiveRootCause[];
  inventoryBehaviorIds?: string[];
  behaviorUnitIds?: string[];
  actions?: string[];
}

export interface RuntimeRetrospectiveLog {
  $schema?: string;
  version: string;
  principle: string;
  entries: RuntimeRetrospectiveEntry[];
}

export interface RuntimeRetrospectiveRecurringCause {
  rootCause: RetrospectiveRootCause;
  count: number;
}

export interface RuntimeRetrospectiveIssue {
  level: "error" | "warning";
  entryId?: string;
  message: string;
}

export interface RuntimeRetrospectiveSummary {
  principle: string;
  version: string;
  entries: number;
  openEntries: number;
  hardenedEntries: number;
  closedEntries: number;
  recurringRootCauses: RuntimeRetrospectiveRecurringCause[];
  issues: RuntimeRetrospectiveIssue[];
}

export interface RuntimeDoctorIssue {
  level: "error" | "warning";
  code: string;
  message: string;
}

export interface RuntimeDoctorSummary {
  requestedPackageSpec?: string;
  lockfilePackageSpec?: string;
  installedPackageVersion?: string;
  installedPackagePath?: string;
  controlArtifactsChecked: number;
  issues: RuntimeDoctorIssue[];
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
  selfCheckPolicyPath?: string;
  retrospectiveLogPath?: string;
}

export type AgentCommandId =
  | "review"
  | "impact"
  | "self-check"
  | "retro"
  | "doctor"
  | "validate";

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
