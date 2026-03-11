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
  surfaceSummaries: SurfaceSummary[];
  issues: ValidationIssue[];
}

export interface ValidationOptions {
  requireAnnotations?: boolean;
}

export interface InitResult {
  written: string[];
  skipped: string[];
}
