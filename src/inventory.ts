import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { expandPatterns, relativeToRoot, toPosix } from "./fs-utils.js";
import type {
  RuntimeDiscoveryPolicy,
  RuntimeDiscoverySourceOverride,
  RuntimeInventory,
  RuntimeInventorySource,
} from "./types.js";

interface DetectionRule {
  id: string;
  description: string;
  kind: string;
  patterns?: string[];
  events: string[];
  expectedEvidence: string[];
  expectedOutcomeClasses: string[];
  surfaceHint: string;
  minimumFidelity: string;
}

const DEFAULT_IGNORE_PATTERNS = [
  "**/*.d.ts",
  "**/*.test.*",
  "**/*.spec.*",
  "**/__tests__/**",
  "**/test/**",
  "**/tests/**",
  "**/node_modules/**",
  "**/.git/**",
  "**/.github/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
];

const NON_TEST_IGNORE_PATTERNS = [
  "**/*.d.ts",
  "**/node_modules/**",
  "**/.git/**",
  "**/.github/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
];

const DEFAULT_CODE_FILE_PATTERNS = ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"];
const PROPERTY_TEST_PATTERNS = ["**/property/**/*.test.*", "**/*.property.test.*"];
const DEFAULT_SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

const DETECTION_RULES: DetectionRule[] = [
  {
    id: "auth-access",
    description: "Authentication, authorization, and protected route/session boundaries.",
    kind: "auth",
    patterns: ["**/middleware.*", "**/auth.ts", "**/auth/**/*.*", "**/*session*.*"],
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
      "**/prisma.*",
      "**/prisma/schema.prisma",
      "**/persistence/**/*.*",
      "**/repositories/**/*.*",
      "**/*repository*.*",
      "**/dao/**/*.*",
    ],
    events: ["Persistent state is written, deduplicated, or read back."],
    expectedEvidence: ["storage_write", "storage_read"],
    expectedOutcomeClasses: ["success", "duplicate", "failure"],
    surfaceHint: "persistence-semantics",
    minimumFidelity: "real-dependency",
  },
  {
    id: "client-state",
    description: "User-visible pages and stateful client-side transitions.",
    kind: "ui-state",
    events: ["A user-visible client surface transitions through runtime state."],
    expectedEvidence: ["state_transition", "derived_view"],
    expectedOutcomeClasses: ["success", "failure"],
    surfaceHint: "client-state",
    minimumFidelity: "simulated",
  },
  {
    id: "external-contracts",
    description: "Provider adapters and upstream API/SDK integrations.",
    kind: "external",
    events: ["The system calls or interprets an external provider contract."],
    expectedEvidence: ["external_call", "response"],
    expectedOutcomeClasses: ["success", "provider_failure", "schema_drift"],
    surfaceHint: "external-contracts",
    minimumFidelity: "contract",
  },
  {
    id: "workflow-orchestration",
    description: "Cross-step use cases and service-level orchestration inside the product boundary.",
    kind: "workflow",
    events: ["A product workflow coordinates multiple runtime steps to complete one use case."],
    expectedEvidence: ["response", "storage_write", "derived_view"],
    expectedOutcomeClasses: ["success", "failure"],
    surfaceHint: "workflow-orchestration",
    minimumFidelity: "simulated",
  },
  {
    id: "runtime-invariants",
    description: "Wide input-domain invariants inferred from property-style verification targets.",
    kind: "invariant",
    events: ["A runtime invariant is exercised over a broad input domain."],
    expectedEvidence: ["response", "derived_view"],
    expectedOutcomeClasses: ["success", "failure"],
    surfaceHint: "runtime-invariants",
    minimumFidelity: "isolated",
  },
];

export function getDiscoveryRuleIds(): string[] {
  return DETECTION_RULES.map((rule) => rule.id);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function discoveryIgnores(options?: {
  ignorePatterns?: string[];
  discoveryPolicy?: RuntimeDiscoveryPolicy;
}): string[] {
  return [
    ...DEFAULT_IGNORE_PATTERNS,
    ...(options?.ignorePatterns ?? []),
    ...(options?.discoveryPolicy?.ignorePatterns ?? []),
    ...(options?.discoveryPolicy?.suppressions ?? []).flatMap(
      (suppression) => suppression.filePatterns,
    ),
  ];
}

function nonTestDiscoveryIgnores(options?: {
  ignorePatterns?: string[];
  discoveryPolicy?: RuntimeDiscoveryPolicy;
}): string[] {
  return [
    ...NON_TEST_IGNORE_PATTERNS,
    ...((options?.ignorePatterns ?? []).filter((pattern) => !/test|spec/.test(pattern))),
    ...((options?.discoveryPolicy?.ignorePatterns ?? []).filter((pattern) => !/test|spec/.test(pattern))),
    ...((options?.discoveryPolicy?.suppressions ?? [])
      .flatMap((suppression) => suppression.filePatterns)
      .filter((pattern) => !/test|spec/.test(pattern))),
  ];
}

function makeSource(rule: DetectionRule, matches: string[]): RuntimeInventorySource | undefined {
  if (matches.length === 0) {
    return undefined;
  }

  return {
    id: rule.id,
    description: rule.description,
    kind: rule.kind,
    sourcePatterns: unique(matches),
    events: rule.events,
    expectedEvidence: rule.expectedEvidence,
    expectedOutcomeClasses: rule.expectedOutcomeClasses,
    surfaceHint: rule.surfaceHint,
    minimumFidelity: rule.minimumFidelity,
  };
}

function resolveCodeFilePatterns(options?: {
  discoveryPolicy?: RuntimeDiscoveryPolicy;
}): string[] {
  return options?.discoveryPolicy?.codeFilePatterns?.length
    ? options.discoveryPolicy.codeFilePatterns
    : DEFAULT_CODE_FILE_PATTERNS;
}

function resolveSourceExtensions(options?: {
  discoveryPolicy?: RuntimeDiscoveryPolicy;
}): string[] {
  return options?.discoveryPolicy?.sourceExtensions?.length
    ? options.discoveryPolicy.sourceExtensions
    : DEFAULT_SOURCE_EXTENSIONS;
}

function expandCodeFiles(
  repoRoot: string,
  ignorePatterns: string[],
  options?: {
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): string[] {
  return unique(
    fg.sync(resolveCodeFilePatterns(options), {
      cwd: repoRoot,
      ignore: ignorePatterns,
      dot: true,
      onlyFiles: true,
      unique: true,
    }).map((match) => toPosix(match)),
  );
}

function readSource(repoRoot: string, filePath: string): string {
  return readFileSync(path.join(repoRoot, filePath), "utf8");
}

function hasUseClientDirective(source: string): boolean {
  return /^\s*["']use client["'];/m.test(source);
}

function hasClientStateSignals(source: string): boolean {
  return /\b(useState|useReducer|useTransition|useOptimistic|useActionState|useDeferredValue|useFormState|startTransition)\b/.test(
    source,
  );
}

function hasJsxRenderSignals(source: string): boolean {
  return /return\s*\(\s*<|<\w[\w.-]*/s.test(source);
}

function hasExternalSignals(source: string): boolean {
  return /\b(fetch|axios|XMLHttpRequest|undici|got)\s*\(|@anthropic-ai\/sdk|google-play-scraper|nodemailer|\banthropic\b/i.test(
    source,
  );
}

function isLikelyClientStateFile(filePath: string, source: string): boolean {
  const normalized = toPosix(filePath);
  if (/\/(app\/.*\/page|pages\/|screens\/|views\/)/.test(normalized)) {
    return true;
  }

  if (!/(^|\/)(app|components)\//.test(normalized)) {
    return false;
  }

  return hasUseClientDirective(source) && (hasClientStateSignals(source) || hasJsxRenderSignals(source));
}

function isLikelyExternalFile(filePath: string, source: string): boolean {
  const normalized = toPosix(filePath);

  if (/\/app\/api\//.test(normalized) || /\/controllers?\//.test(normalized) || /\/routes\//.test(normalized)) {
    return false;
  }

  if (hasUseClientDirective(source)) {
    return false;
  }

  if (
    /\b(client|adapter|connector|collector|scraper|gateway)\b/i.test(path.basename(normalized))
  ) {
    return true;
  }

  if (!/(^|\/)(src\/)?(server|services|lib)\//.test(normalized)) {
    return false;
  }

  return hasExternalSignals(source);
}

function isLikelyWorkflowFile(filePath: string): boolean {
  const normalized = toPosix(filePath);
  return /(^|\/)(services|usecases|workflows)\//.test(normalized) || /service|workflow|orchestr/i.test(path.basename(normalized));
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const staticImportPattern = /\bfrom\s+["']([^"']+)["']/g;
  const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;

  let match: RegExpExecArray | null;
  while ((match = staticImportPattern.exec(source)) !== null) {
    specifiers.add(match[1]);
  }
  while ((match = dynamicImportPattern.exec(source)) !== null) {
    specifiers.add(match[1]);
  }

  return [...specifiers];
}

function resolveImportTarget(
  repoRoot: string,
  importer: string,
  specifier: string,
  sourceExtensions: string[],
): string | undefined {
  let basePath: string | undefined;

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    basePath = path.resolve(path.dirname(path.join(repoRoot, importer)), specifier);
  } else if (specifier.startsWith("@/")) {
    basePath = path.join(repoRoot, "src", specifier.slice(2));
  } else if (specifier.startsWith("src/")) {
    basePath = path.join(repoRoot, specifier);
  }

  if (!basePath) {
    return undefined;
  }

  const candidates = [
    basePath,
    ...sourceExtensions.map((extension) => `${basePath}${extension}`),
    ...sourceExtensions.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && lstatSync(candidate).isFile()) {
      return relativeToRoot(repoRoot, candidate);
    }
  }

  return undefined;
}

function sourceOverrideFor(
  discoveryPolicy: RuntimeDiscoveryPolicy | undefined,
  sourceId: string,
): RuntimeDiscoverySourceOverride | undefined {
  return discoveryPolicy?.sourceOverrides?.find((override) => override.sourceId === sourceId);
}

function applySourceOverride(
  repoRoot: string,
  baseMatches: string[],
  ignorePatterns: string[],
  override?: RuntimeDiscoverySourceOverride,
): string[] {
  if (!override) {
    return unique(baseMatches);
  }

  const overrideExcludes = override.excludePatterns ?? [];
  const includeMatches =
    override.includePatterns && override.includePatterns.length > 0
      ? expandPatterns(repoRoot, override.includePatterns, [...ignorePatterns, ...overrideExcludes])
      : [];
  const excludeMatches =
    overrideExcludes.length > 0 ? expandPatterns(repoRoot, overrideExcludes, ignorePatterns) : [];
  const excluded = new Set(excludeMatches);
  const candidateMatches =
    override.mode === "replace"
      ? includeMatches
      : unique([...baseMatches, ...includeMatches]);

  return candidateMatches.filter((filePath) => !excluded.has(filePath));
}

function detectClientStateSources(
  repoRoot: string,
  ignorePatterns: string[],
  claimedFiles: Set<string>,
  options?: {
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): string[] {
  const codeFiles = expandCodeFiles(repoRoot, ignorePatterns, options);
  const matches = codeFiles.filter((filePath) => {
    if (claimedFiles.has(filePath)) {
      return false;
    }

    const source = readSource(repoRoot, filePath);
    return isLikelyClientStateFile(filePath, source);
  });

  return applySourceOverride(
    repoRoot,
    unique(matches),
    ignorePatterns,
    sourceOverrideFor(options?.discoveryPolicy, "client-state"),
  );
}

function detectExternalSources(
  repoRoot: string,
  ignorePatterns: string[],
  claimedFiles: Set<string>,
  options?: {
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): string[] {
  const codeFiles = expandCodeFiles(repoRoot, ignorePatterns, options);
  const matches = codeFiles.filter((filePath) => {
    if (claimedFiles.has(filePath)) {
      return false;
    }

    const source = readSource(repoRoot, filePath);
    return isLikelyExternalFile(filePath, source);
  });

  return applySourceOverride(
    repoRoot,
    unique(matches),
    ignorePatterns,
    sourceOverrideFor(options?.discoveryPolicy, "external-contracts"),
  );
}

function detectWorkflowSources(
  repoRoot: string,
  ignorePatterns: string[],
  claimedFiles: Set<string>,
  options?: {
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): string[] {
  const matches = expandPatterns(
    repoRoot,
    [
      "**/services/**/*.*",
      "**/*service*.*",
      "**/usecases/**/*.*",
      "**/workflows/**/*.*",
      "**/*orchestr*.*",
    ],
    ignorePatterns,
  ).filter((filePath) => !claimedFiles.has(filePath) && isLikelyWorkflowFile(filePath));

  return applySourceOverride(
    repoRoot,
    unique(matches),
    ignorePatterns,
    sourceOverrideFor(options?.discoveryPolicy, "workflow-orchestration"),
  );
}

function detectInvariantSources(
  repoRoot: string,
  options?: {
    ignorePatterns?: string[];
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): string[] {
  const sourceExtensions = resolveSourceExtensions(options);
  const propertyTests = unique(
    fg.sync(PROPERTY_TEST_PATTERNS, {
      cwd: repoRoot,
      ignore: nonTestDiscoveryIgnores(options),
      dot: true,
      onlyFiles: true,
      unique: true,
    }).map((match) => toPosix(match)),
  );

  const imports = new Set<string>();
  for (const propertyTest of propertyTests) {
    const source = readSource(repoRoot, propertyTest);
    if (!/\bfast-check\b/.test(source)) {
      continue;
    }

    for (const specifier of extractImportSpecifiers(source)) {
      const resolved = resolveImportTarget(repoRoot, propertyTest, specifier, sourceExtensions);
      if (!resolved || /(^|\/)(test|tests)\//.test(resolved)) {
        continue;
      }
      imports.add(resolved);
    }
  }

  return applySourceOverride(
    repoRoot,
    unique([...imports]),
    discoveryIgnores(options),
    sourceOverrideFor(options?.discoveryPolicy, "runtime-invariants"),
  );
}

export function scanRuntimeInventory(
  repoRoot: string,
  options?: {
    ignorePatterns?: string[];
    discoveryPolicy?: RuntimeDiscoveryPolicy;
  },
): RuntimeInventory {
  const sources: RuntimeInventorySource[] = [];
  const ignorePatterns = discoveryIgnores(options);
  const claimedFiles = new Set<string>();

  for (const rule of DETECTION_RULES) {
    if (!rule.patterns) {
      continue;
    }

    const matches = applySourceOverride(
      repoRoot,
      expandPatterns(repoRoot, rule.patterns, ignorePatterns),
      ignorePatterns,
      sourceOverrideFor(options?.discoveryPolicy, rule.id),
    );
    const source = makeSource(rule, matches);
    if (!source) {
      continue;
    }

    sources.push(source);
    for (const filePath of source.sourcePatterns) {
      claimedFiles.add(filePath);
    }
  }

  const clientStateRule = DETECTION_RULES.find((rule) => rule.id === "client-state");
  const clientStateMatches = detectClientStateSources(repoRoot, ignorePatterns, claimedFiles, options);
  if (clientStateRule) {
    const source = makeSource(clientStateRule, clientStateMatches);
    if (source) {
      sources.push(source);
      for (const filePath of source.sourcePatterns) {
        claimedFiles.add(filePath);
      }
    }
  }

  const externalRule = DETECTION_RULES.find((rule) => rule.id === "external-contracts");
  const externalMatches = detectExternalSources(repoRoot, ignorePatterns, claimedFiles, options);
  if (externalRule) {
    const source = makeSource(externalRule, externalMatches);
    if (source) {
      sources.push(source);
      for (const filePath of source.sourcePatterns) {
        claimedFiles.add(filePath);
      }
    }
  }

  const workflowRule = DETECTION_RULES.find((rule) => rule.id === "workflow-orchestration");
  const workflowMatches = detectWorkflowSources(repoRoot, ignorePatterns, claimedFiles, options);
  if (workflowRule) {
    const source = makeSource(workflowRule, workflowMatches);
    if (source) {
      sources.push(source);
      for (const filePath of source.sourcePatterns) {
        claimedFiles.add(filePath);
      }
    }
  }

  const invariantRule = DETECTION_RULES.find((rule) => rule.id === "runtime-invariants");
  const invariantMatches = detectInvariantSources(repoRoot, options);
  if (invariantRule) {
    const source = makeSource(invariantRule, invariantMatches);
    if (source) {
      sources.push(source);
    }
  }

  return {
    $schema: "./runtime-inventory.schema.json",
    version: "1.0.0",
    principle: "runtime-obligation-first",
    sourceKinds: [...new Set(sources.map((source) => source.kind))].sort(),
    sources: sources.sort((left, right) => left.id.localeCompare(right.id)),
  };
}
