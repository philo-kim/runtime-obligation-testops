import { expandPatterns } from "./fs-utils.js";
import type { RuntimeInventory, RuntimeInventorySource } from "./types.js";

interface DetectionRule {
  id: string;
  description: string;
  kind: string;
  patterns: string[];
  events: string[];
  expectedEvidence: string[];
  expectedOutcomeClasses: string[];
  surfaceHint: string;
  minimumFidelity: string;
}

const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
];

const DETECTION_RULES: DetectionRule[] = [
  {
    id: "auth-access",
    description: "Authentication, authorization, and protected route/session boundaries.",
    kind: "auth",
    patterns: ["**/middleware.*", "**/*auth*.*", "**/*session*.*"],
    events: [
      "An access-controlled request or session bootstrap reaches the system boundary.",
    ],
    expectedEvidence: ["response", "redirect"],
    expectedOutcomeClasses: ["success", "auth_denied", "failure"],
    surfaceHint: "auth-access",
    minimumFidelity: "simulated",
  },
  {
    id: "request-boundary",
    description: "HTTP, webhook, controller, and other explicit request entrypoints.",
    kind: "request",
    patterns: [
      "**/api/**/route.*",
      "**/routes/**/*.*",
      "**/controllers/**/*.*",
      "**/*handler*.*",
      "**/webhooks/**/*.*",
    ],
    events: ["An external request is accepted and handled."],
    expectedEvidence: ["response"],
    expectedOutcomeClasses: ["success", "validation_error", "failure"],
    surfaceHint: "request-boundary",
    minimumFidelity: "simulated",
  },
  {
    id: "app-bootstrap",
    description: "Application bootstrap and provider/context initialization.",
    kind: "bootstrap",
    patterns: [
      "**/providers.*",
      "**/*context*.*",
      "**/app/**/layout.*",
      "**/app/**/page.*",
    ],
    events: ["The application bootstraps visible runtime state."],
    expectedEvidence: ["state_transition", "derived_view"],
    expectedOutcomeClasses: ["success", "failure"],
    surfaceHint: "app-bootstrap",
    minimumFidelity: "simulated",
  },
  {
    id: "background-execution",
    description: "Queue, worker, cron, or scheduled execution entrypoints.",
    kind: "background",
    patterns: [
      "**/workers/**/*.*",
      "**/jobs/**/*.*",
      "**/queues/**/*.*",
      "**/cron/**/*.*",
      "**/*scheduler*.*",
    ],
    events: ["A deferred or scheduled job is accepted for background processing."],
    expectedEvidence: ["job_enqueue", "job_process", "storage_write"],
    expectedOutcomeClasses: ["success", "retry", "skipped", "failure"],
    surfaceHint: "background-execution",
    minimumFidelity: "real-dependency",
  },
  {
    id: "persistence-semantics",
    description: "Persistent state boundaries, repositories, and ORM integration.",
    kind: "persistence",
    patterns: [
      "**/db/**/*.*",
      "**/prisma.*",
      "**/*repository*.*",
      "**/*model*.*",
      "**/*store*.*",
    ],
    events: ["Persistent state is written, deduplicated, or read back."],
    expectedEvidence: ["storage_write", "storage_read"],
    expectedOutcomeClasses: ["success", "duplicate", "failure"],
    surfaceHint: "persistence-semantics",
    minimumFidelity: "real-dependency",
  },
  {
    id: "external-contracts",
    description: "Provider adapters and upstream API/SDK integrations.",
    kind: "external",
    patterns: [
      "**/*client*.*",
      "**/*api.*",
      "**/*connector*.*",
      "**/*adapter*.*",
      "**/*provider*.*",
    ],
    events: ["The system calls or interprets an external provider contract."],
    expectedEvidence: ["external_call", "response"],
    expectedOutcomeClasses: ["success", "provider_failure", "schema_drift"],
    surfaceHint: "external-contracts",
    minimumFidelity: "contract",
  },
];

export function scanRuntimeInventory(repoRoot: string): RuntimeInventory {
  const sources: RuntimeInventorySource[] = [];

  for (const rule of DETECTION_RULES) {
    const matches = expandPatterns(repoRoot, rule.patterns, DEFAULT_IGNORE_PATTERNS);
    if (matches.length === 0) {
      continue;
    }

    sources.push({
      id: rule.id,
      description: rule.description,
      kind: rule.kind,
      sourcePatterns: matches,
      events: rule.events,
      expectedEvidence: rule.expectedEvidence,
      expectedOutcomeClasses: rule.expectedOutcomeClasses,
      surfaceHint: rule.surfaceHint,
      minimumFidelity: rule.minimumFidelity,
    });
  }

  return {
    $schema: "./runtime-inventory.schema.json",
    version: "1.0.0",
    principle: "automated testing is managed against the full set of runtime obligations",
    sourceKinds: [...new Set(sources.map((source) => source.kind))].sort(),
    sources,
  };
}
