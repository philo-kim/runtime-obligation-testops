import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeImpact,
  buildRuntimeAgentContract,
  deriveSurfaceCatalog,
  generateReviewBacklog,
  generateVitestWorkspace,
  initWorkspace,
  scanRuntimeInventory,
  validateControlPlane,
} from "../src/index.js";
import type {
  RuntimeDiscoveryPolicy,
  FidelityPolicy,
  RuntimeQualityPolicy,
  RuntimeControlPlane,
  RuntimeInventory,
} from "../src/index.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "rotops-"));
  tempDirs.push(tempDir);
  return tempDir;
}

function writeProjectFile(root: string, relativePath: string, contents: string): void {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents);
}

function makeInventory(): RuntimeInventory {
  return {
    version: "1.0.0",
    principle: "runtime-obligation-first",
    sourceKinds: ["request"],
    sources: [
      {
        id: "request-entry",
        description: "Request entrypoint",
        kind: "request",
        sourcePatterns: ["src/entry.ts"],
        events: ["A request enters the system."],
        expectedEvidence: ["response"],
        expectedOutcomeClasses: ["success"],
        surfaceHint: "request-boundary",
        minimumFidelity: "simulated",
      },
    ],
  };
}

function makeDiscoveryPolicy(): RuntimeDiscoveryPolicy {
  return {
    version: "1.0.0",
    principle: "runtime-obligation-first",
    candidateReviewMode: "error",
    codeFilePatterns: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"],
    sourceExtensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"],
    scopePatterns: ["**/*"],
    ignorePatterns: [],
    suppressions: [],
    sourceOverrides: [],
  };
}

function makeControlPlane(): RuntimeControlPlane {
  return {
    version: "1.0.0",
    principle: "runtime-obligation-first",
    evidenceKinds: ["response", "state_transition"],
    fidelityLevels: [
      "isolated",
      "simulated",
      "contract",
      "real-dependency",
      "full-system",
    ],
    surfaces: [
      {
        id: "request-boundary",
        description: "Request surface",
        sourcePatterns: ["src/entry.ts"],
        testPatterns: ["test/entry.test.ts"],
        execution: {
          runner: "vitest",
          environment: "node",
          setupFiles: ["test/setup.ts"],
          include: ["test/entry.test.ts"],
          testTimeout: 5000,
        },
      },
    ],
    obligations: [
      {
        id: "request-entry.success",
        surface: "request-boundary",
        sourcePatterns: ["src/entry.ts"],
        event: "A request enters the system.",
        outcomes: ["A response is produced successfully."],
        outcomeClasses: ["success"],
        evidence: ["response"],
        fidelity: "simulated",
        ownerTests: ["test/entry.test.ts"],
      },
    ],
  };
}

function makeQualityPolicy(): RuntimeQualityPolicy {
  return {
    version: "1.0.0",
    principle: "runtime-obligation-first",
    defaultInventorySourceRule: {
      maxExpandedFiles: 2,
      level: "error",
    },
    defaultObligationRule: {
      maxExpandedFiles: 2,
      maxInventorySources: 1,
      level: "error",
    },
    surfacePolicies: [],
    inventorySourcePolicies: [],
    obligationPolicies: [],
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop() as string, { recursive: true, force: true });
  }
});

describe("validateControlPlane", () => {
  it("passes when inventory, surfaces, obligations, and annotations line up", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const inventory = makeInventory();
    const surfaceCatalog = deriveSurfaceCatalog(inventory);
    const summary = validateControlPlane(makeControlPlane(), root, {
      inventory,
      surfaceCatalog,
      discoveryPolicy: makeDiscoveryPolicy(),
    });

    expect(summary.issues).toEqual([]);
  });

  it("accepts behavior units as the primary reviewed proof model", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const inventory = makeInventory();
    const surfaceCatalog = deriveSurfaceCatalog(inventory);
    const controlPlane = {
      ...makeControlPlane(),
      obligations: undefined,
      behaviors: makeControlPlane().obligations.map((behavior) => ({
        ...behavior,
        implementationStatus: "implemented" as const,
        inventorySourceIds: ["request-entry"],
      })),
    };

    const summary = validateControlPlane(controlPlane, root, {
      inventory,
      surfaceCatalog,
      discoveryPolicy: makeDiscoveryPolicy(),
    });

    expect(summary.issues).toEqual([]);
    expect(summary.behaviorUnits).toBe(1);
    expect(summary.incompleteBehaviorUnits).toBe(0);
  });

  it("reports completeness and fidelity regressions", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const inventory: RuntimeInventory = {
      ...makeInventory(),
      sources: [
        {
          ...makeInventory().sources[0],
          expectedOutcomeClasses: ["success", "failure"],
          minimumFidelity: "real-dependency",
        },
      ],
    };
    const fidelityPolicy: FidelityPolicy = {
      version: "1.0.0",
      principle: "runtime-obligation-first",
      fidelityLevels: [
        "isolated",
        "simulated",
        "contract",
        "real-dependency",
        "full-system",
      ],
      defaultMinimumFidelity: "simulated",
      surfacePolicies: [],
      inventorySourcePolicies: [],
      obligationPolicies: [],
    };
    const summary = validateControlPlane(makeControlPlane(), root, {
      inventory,
      surfaceCatalog: deriveSurfaceCatalog(inventory),
      fidelityPolicy,
      discoveryPolicy: makeDiscoveryPolicy(),
    });
    const messages = summary.issues.map((issue) => issue.message);

    expect(messages).toContain(
      "Inventory source request-entry is missing required outcome class failure",
    );
    expect(messages).toContain(
      "Obligation request-entry.success has fidelity simulated, below required minimum real-dependency",
    );
  });

  it("reports reviewed-model quality regressions when sources or obligations are too coarse", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/pages/alerts.tsx", "export const alerts = true;\n");
    writeProjectFile(root, "src/pages/reviews.tsx", "export const reviews = true;\n");
    writeProjectFile(root, "src/pages/metadata.tsx", "export const metadata = true;\n");
    writeProjectFile(
      root,
      "test/pages.test.ts",
      "// runtime-obligations: client.pages\nexport const testFile = true;\n",
    );

    const inventory: RuntimeInventory = {
      version: "1.0.0",
      principle: "runtime-obligation-first",
      sourceKinds: ["ui-state"],
      sources: [
        {
          id: "client-pages",
          description: "Multiple client pages",
          kind: "ui-state",
          sourcePatterns: ["src/pages/*.tsx"],
          events: ["A user enters a dashboard page."],
          expectedEvidence: ["state_transition"],
          expectedOutcomeClasses: ["success"],
          surfaceHint: "client-state",
          minimumFidelity: "simulated",
        },
      ],
    };

    const controlPlane: RuntimeControlPlane = {
      version: "1.0.0",
      principle: "runtime-obligation-first",
      evidenceKinds: ["state_transition"],
      fidelityLevels: [
        "isolated",
        "simulated",
        "contract",
        "real-dependency",
        "full-system",
      ],
      surfaces: [
        {
          id: "client-state",
          description: "Client state transitions",
          sourcePatterns: ["src/pages/*.tsx"],
          testPatterns: ["test/pages.test.ts"],
        },
      ],
      obligations: [
        {
          id: "client.pages",
          surface: "client-state",
          sourcePatterns: ["src/pages/*.tsx"],
          event: "A user enters a dashboard page.",
          outcomes: ["The page renders successfully."],
          outcomeClasses: ["success"],
          evidence: ["state_transition"],
          fidelity: "simulated",
          ownerTests: ["test/pages.test.ts"],
        },
      ],
    };

    const summary = validateControlPlane(controlPlane, root, {
      inventory,
      surfaceCatalog: deriveSurfaceCatalog(inventory),
      qualityPolicy: makeQualityPolicy(),
    });
    const messages = summary.issues.map((issue) => issue.message);

    expect(messages).toContain(
      "Inventory source client-pages resolves 3 files, above the allowed maximum 2",
    );
    expect(messages).toContain(
      "Obligation client.pages resolves 3 files, above the allowed maximum 2",
    );
  });

  it("fails when discovered runtime files are not declared in the inventory", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/lib/prisma.ts", "export const prisma = true;\n");
    writeProjectFile(root, "prisma/schema.prisma", "model Example { id String @id }\n");
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const summary = validateControlPlane(makeControlPlane(), root, {
      inventory: makeInventory(),
      surfaceCatalog: deriveSurfaceCatalog(makeInventory()),
      discoveryPolicy: makeDiscoveryPolicy(),
    });

    expect(summary.issues.map((issue) => issue.message)).toContain(
      "Discovered runtime file src/lib/prisma.ts is not represented in the declared inventory",
    );
  });

  it("downgrades discovered-vs-reviewed drift to a warning when candidate review mode is advisory", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/lib/prisma.ts", "export const prisma = true;\n");
    writeProjectFile(root, "prisma/schema.prisma", "model Example { id String @id }\n");
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const summary = validateControlPlane(makeControlPlane(), root, {
      inventory: makeInventory(),
      surfaceCatalog: deriveSurfaceCatalog(makeInventory()),
      discoveryPolicy: {
        ...makeDiscoveryPolicy(),
        candidateReviewMode: "warning",
      },
    });

    expect(summary.issues).toContainEqual({
      level: "warning",
      message: "Discovered runtime file src/lib/prisma.ts is not represented in the declared inventory",
    });
  });

  it("fails when discovery policy overrides reference unknown runtime source ids", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const summary = validateControlPlane(makeControlPlane(), root, {
      inventory: makeInventory(),
      surfaceCatalog: deriveSurfaceCatalog(makeInventory()),
      discoveryPolicy: {
        ...makeDiscoveryPolicy(),
        sourceOverrides: [
          {
            sourceId: "unknown-runtime-source",
            includePatterns: ["lib/**/*.dart"],
            mode: "replace",
          },
        ],
      },
    });

    expect(summary.issues).toContainEqual({
      level: "error",
      message: "Discovery policy source override references unknown runtime source unknown-runtime-source",
    });
  });
});

describe("deriveSurfaceCatalog", () => {
  it("derives runtime surfaces from inventory source hints", () => {
    const catalog = deriveSurfaceCatalog(makeInventory());

    expect(catalog.surfaces).toHaveLength(1);
    expect(catalog.surfaces[0].id).toBe("request-boundary");
    expect(catalog.surfaces[0].inventorySourceIds).toEqual(["request-entry"]);
  });
});

describe("analyzeImpact", () => {
  it("maps changed runtime files to inventory sources, surfaces, obligations, and tests", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const inventory = makeInventory();
    const impact = analyzeImpact(
      root,
      {
        controlPlane: makeControlPlane(),
        inventory,
        surfaceCatalog: deriveSurfaceCatalog(inventory),
      },
      ["src/entry.ts"],
    );

    expect(impact.impactedInventorySources).toEqual(["request-entry"]);
    expect(impact.impactedSurfaces).toEqual(["request-boundary"]);
    expect(impact.impactedObligations).toEqual(["request-entry.success"]);
    expect(impact.impactedOwnerTests).toEqual(["test/entry.test.ts"]);
  });
});

describe("generateVitestWorkspace", () => {
  it("renders a vitest workspace from runner-tagged surfaces", () => {
    const output = generateVitestWorkspace(makeControlPlane(), {
      aliases: {
        "@": "./src",
      },
    });

    expect(output).toContain('name: "request-boundary"');
    expect(output).toContain('environment: "node"');
    expect(output).toContain('path.resolve(process.cwd(), "./src")');
  });
});

describe("scanRuntimeInventory", () => {
  it("detects common runtime entrypoint categories", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/middleware.ts", "export const middleware = true;\n");
    writeProjectFile(root, "src/app/api/ping/route.ts", "export const GET = true;\n");
    writeProjectFile(root, "src/workers/index.ts", "export const worker = true;\n");

    const inventory = scanRuntimeInventory(root);
    const ids = inventory.sources.map((source) => source.id).sort();

    expect(ids).toEqual(["auth-access", "background-execution", "request-boundary"]);
  });

  it("ignores test files by default", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/lib/prisma.ts", "export const prisma = true;\n");
    writeProjectFile(root, "src/test/prisma.unit.test.ts", "export const ignored = true;\n");

    const inventory = scanRuntimeInventory(root);
    const persistence = inventory.sources.find((source) => source.id === "persistence-semantics");

    expect(persistence?.sourcePatterns).toEqual(["src/lib/prisma.ts"]);
  });

  it("detects client-state, workflow, external contracts, and runtime invariants from runtime signals", () => {
    const root = makeTempDir();
    writeProjectFile(
      root,
      "src/app/login/page.tsx",
      `"use client";\nimport { useState } from "react";\nexport default function LoginPage() { const [open] = useState(false); return <button>{String(open)}</button>; }\n`,
    );
    writeProjectFile(
      root,
      "src/components/layout/header.tsx",
      `"use client";\nimport { useTransition } from "react";\nexport function Header() { const [, startTransition] = useTransition(); return <button onClick={() => startTransition(() => undefined)}>menu</button>; }\n`,
    );
    writeProjectFile(
      root,
      "src/server/services/google-play-service.ts",
      `export async function fetchGooglePlay() { return fetch("https://play.example.com"); }\n`,
    );
    writeProjectFile(
      root,
      "src/server/services/ranking-service.ts",
      "export async function calculateRanks() { return [{ rank: 1 }]; }\n",
    );
    writeProjectFile(root, "src/lib/utils.ts", "export function clamp(value: number) { return value; }\n");
    writeProjectFile(
      root,
      "src/test/property/utils.property.test.ts",
      `import { describe, it, expect } from "vitest";\nimport fc from "fast-check";\nimport { clamp } from "@/lib/utils";\ndescribe("property", () => { it("uses clamp", () => { expect(clamp(1)).toBe(1); fc.assert(fc.property(fc.integer(), (value) => typeof clamp(value) === "number")); }); });\n`,
    );

    const inventory = scanRuntimeInventory(root);
    const ids = inventory.sources.map((source) => source.id).sort();
    const clientState = inventory.sources.find((source) => source.id === "client-state");
    const workflow = inventory.sources.find((source) => source.id === "workflow-orchestration");
    const external = inventory.sources.find((source) => source.id === "external-contracts");
    const invariants = inventory.sources.find((source) => source.id === "runtime-invariants");

    expect(ids).toContain("client-state");
    expect(ids).toContain("workflow-orchestration");
    expect(ids).toContain("external-contracts");
    expect(ids).toContain("runtime-invariants");
    expect(clientState?.sourcePatterns).toEqual([
      "src/app/login/page.tsx",
      "src/components/layout/header.tsx",
    ]);
    expect(workflow?.sourcePatterns).toEqual(["src/server/services/ranking-service.ts"]);
    expect(external?.sourcePatterns).toEqual(["src/server/services/google-play-service.ts"]);
    expect(invariants?.sourcePatterns).toEqual(["src/lib/utils.ts"]);
  });

  it("supports repo-local source overrides and custom code patterns for non-JS projects", () => {
    const root = makeTempDir();
    writeProjectFile(
      root,
      "lib/presentation/auth/auth_viewmodel.dart",
      "class AuthViewModel { bool loading = false; }\n",
    );
    writeProjectFile(
      root,
      "lib/core/startup/startup_coordinator.dart",
      "class StartupCoordinator { Future<void> run() async {} }\n",
    );
    writeProjectFile(
      root,
      "lib/data/network/api_client.dart",
      "class ApiClient { Future<void> get() async {} }\n",
    );
    writeProjectFile(
      root,
      ".fvm/flutter_sdk/lib/src/ignored.dart",
      "class Ignored {}\n",
    );
    writeProjectFile(
      root,
      "docs/archive/legacy.tsx",
      `"use client"; export default function Legacy() { return <div />; }\n`,
    );

    const inventory = scanRuntimeInventory(root, {
      discoveryPolicy: {
        version: "1.0.0",
        principle: "runtime-obligation-first",
        candidateReviewMode: "warning",
        codeFilePatterns: ["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,dart}"],
        sourceExtensions: [
          ".ts",
          ".tsx",
          ".js",
          ".jsx",
          ".mts",
          ".cts",
          ".mjs",
          ".cjs",
          ".dart",
        ],
        ignorePatterns: ["**/.fvm/**", "**/ios/.symlinks/**"],
        suppressions: [],
        sourceOverrides: [
          {
            sourceId: "client-state",
            mode: "replace",
            includePatterns: ["lib/presentation/**/*.dart"],
          },
          {
            sourceId: "workflow-orchestration",
            mode: "replace",
            includePatterns: ["lib/core/**/*.dart"],
          },
          {
            sourceId: "external-contracts",
            mode: "replace",
            includePatterns: ["lib/data/**/*.dart"],
          },
        ],
      },
    });

    const clientState = inventory.sources.find((source) => source.id === "client-state");
    const workflow = inventory.sources.find((source) => source.id === "workflow-orchestration");
    const external = inventory.sources.find((source) => source.id === "external-contracts");

    expect(clientState?.sourcePatterns).toEqual(["lib/presentation/auth/auth_viewmodel.dart"]);
    expect(workflow?.sourcePatterns).toEqual(["lib/core/startup/startup_coordinator.dart"]);
    expect(external?.sourcePatterns).toEqual(["lib/data/network/api_client.dart"]);
    expect(inventory.sources.flatMap((source) => source.sourcePatterns)).not.toContain(
      ".fvm/flutter_sdk/lib/src/ignored.dart",
    );
    expect(inventory.sources.flatMap((source) => source.sourcePatterns)).not.toContain(
      "docs/archive/legacy.tsx",
    );
  });

  it("supports staged adoption by scoping discovery to a managed slice", () => {
    const root = makeTempDir();
    writeProjectFile(root, "lib/presentation/auth/auth_viewmodel.dart", "class AuthViewModel {}\n");
    writeProjectFile(root, "lib/presentation/feed/feed_viewmodel.dart", "class FeedViewModel {}\n");

    const inventory = scanRuntimeInventory(root, {
      discoveryPolicy: {
        version: "1.0.0",
        principle: "runtime-obligation-first",
        candidateReviewMode: "warning",
        codeFilePatterns: ["**/*.dart"],
        sourceExtensions: [".dart"],
        scopePatterns: ["lib/presentation/auth/**/*.dart"],
        ignorePatterns: [],
        suppressions: [],
        sourceOverrides: [
          {
            sourceId: "client-state",
            mode: "replace",
            includePatterns: ["lib/presentation/**/*.dart"],
          },
        ],
      },
    });

    expect(inventory.sources).toHaveLength(2);
    expect(inventory.sources.map((source) => source.id)).toEqual(["auth-access", "client-state"]);
    expect(inventory.sources[0].sourcePatterns).toEqual(["lib/presentation/auth/auth_viewmodel.dart"]);
    expect(inventory.sources[1].sourcePatterns).toEqual(["lib/presentation/auth/auth_viewmodel.dart"]);
  });
});

describe("generateReviewBacklog", () => {
  it("produces a candidate backlog with suggested actions", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(root, "src/lib/prisma.ts", "export const prisma = true;\n");
    writeProjectFile(root, "prisma/schema.prisma", "model Example { id String @id }\n");
    writeProjectFile(root, "docs/archive/auth.ts", "export const archivedAuth = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: request-entry.success\nexport const testFile = true;\n",
    );

    const inventory = makeInventory();
    const backlog = generateReviewBacklog(root, {
      controlPlane: makeControlPlane(),
      inventory,
      surfaceCatalog: deriveSurfaceCatalog(inventory),
      discoveryPolicy: {
        ...makeDiscoveryPolicy(),
        codeFilePatterns: ["**/*.{ts,tsx,prisma}"],
        scopePatterns: ["src/**/*", "prisma/schema.prisma", "docs/archive/**/*.ts"],
      },
    });

    expect(backlog.unresolvedCandidates).toBe(3);
    expect(backlog.candidates).toContainEqual(
      expect.objectContaining({
        file: "src/lib/prisma.ts",
        suggestedAction: "accept",
      }),
    );
    expect(backlog.candidates).toContainEqual(
      expect.objectContaining({
        file: "docs/archive/auth.ts",
        suggestedAction: "suppress",
      }),
    );
  });
});

describe("buildRuntimeAgentContract", () => {
  it("exports a machine-readable agent workflow contract", () => {
    const root = makeTempDir();
    const contract = buildRuntimeAgentContract(root, {
      version: "1.0.0",
      principle: "runtime-obligation-first",
      artifactPaths: {
        controlPlanePath: path.join(root, "testops", "runtime-control-plane.json"),
        inventoryPath: path.join(root, "testops", "runtime-inventory.json"),
        surfaceCatalogPath: path.join(root, "testops", "runtime-surfaces.json"),
        fidelityPolicyPath: path.join(root, "testops", "fidelity-policy.json"),
        qualityPolicyPath: path.join(root, "testops", "runtime-quality-policy.json"),
        discoveryPolicyPath: path.join(root, "testops", "runtime-discovery-policy.json"),
      },
    });

    expect(contract.readOrder[0]).toBe("testops/runtime-discovery-policy.json");
    expect(contract.readOrder).toContain("testops/runtime-quality-policy.json");
    expect(contract.systemIdentity).toBe("runtime-governance-control-system");
    expect(contract.operatingModel).toContain("AI agents");
    expect(contract.reviewedDecisionMeaning).toContain("semantic treatment");
    expect(contract.actorRoles.map((role) => role.id)).toEqual([
      "discovery-engine",
      "repo-local-policy",
      "ai-agent",
      "reviewer",
      "ci-gate",
    ]);
    expect(contract.governanceSignals).toContainEqual(
      expect.objectContaining({
        id: "governance-validation",
        primary: true,
        blocking: true,
      }),
    );
    expect(contract.requiredCommands.map((command) => command.id)).toEqual([
      "review",
      "impact",
      "validate",
    ]);
    expect(contract.mandatoryLoop).toContain("rerun validate before considering the change complete");
  });

  it("supports repo-local command overrides for wrapped control workflows", () => {
    const root = makeTempDir();
    const contract = buildRuntimeAgentContract(root, {
      version: "1.0.0",
      principle: "runtime-obligation-first",
      artifactPaths: {
        controlPlanePath: path.join(root, "testing", "runtime-control-plane.json"),
        inventoryPath: path.join(root, "testing", "runtime-inventory.json"),
        surfaceCatalogPath: path.join(root, "testing", "runtime-surfaces.json"),
        fidelityPolicyPath: path.join(root, "testing", "fidelity-policy.json"),
        qualityPolicyPath: path.join(root, "testing", "runtime-quality-policy.json"),
        discoveryPolicyPath: path.join(root, "testing", "runtime-discovery-policy.json"),
      },
      commandOverrides: {
        review: "npm run test:review",
        impact: "npm run test:impact -- --changed <path>",
        validate: "npm run test:control",
      },
    });

    expect(contract.requiredCommands).toEqual([
      expect.objectContaining({
        id: "review",
        command: "npm run test:review",
      }),
      expect.objectContaining({
        id: "impact",
        command: "npm run test:impact -- --changed <path>",
      }),
      expect.objectContaining({
        id: "validate",
        command: "npm run test:control",
      }),
    ]);
  });
});

describe("initWorkspace", () => {
  it("writes starter files for a vitest project", () => {
    const root = makeTempDir();
    const result = initWorkspace(root, "vitest");

    expect(result.written.length).toBeGreaterThan(0);
    expect(existsSync(path.join(root, "testops", "runtime-control-plane.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-inventory.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-surfaces.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "fidelity-policy.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-quality-policy.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-discovery-policy.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-control-plane.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-inventory.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-surfaces.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "fidelity-policy.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-quality-policy.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-discovery-policy.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, ".github", "workflows", "testops-control.yml"))).toBe(true);
    expect(existsSync(path.join(root, "vitest.runtime.workspace.ts"))).toBe(true);
  });
});
