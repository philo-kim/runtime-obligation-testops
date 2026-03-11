import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  analyzeImpact,
  deriveSurfaceCatalog,
  generateVitestWorkspace,
  initWorkspace,
  scanRuntimeInventory,
  validateControlPlane,
} from "../src/index.js";
import type {
  FidelityPolicy,
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
    principle: "runtime obligations",
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

function makeControlPlane(): RuntimeControlPlane {
  return {
    version: "1.0.0",
    principle: "runtime obligations",
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
    });

    expect(summary.issues).toEqual([]);
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
      principle: "runtime obligations",
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
    });
    const messages = summary.issues.map((issue) => issue.message);

    expect(messages).toContain(
      "Inventory source request-entry is missing required outcome class failure",
    );
    expect(messages).toContain(
      "Obligation request-entry.success has fidelity simulated, below required minimum real-dependency",
    );
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
    expect(existsSync(path.join(root, "testops", "runtime-control-plane.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-inventory.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-surfaces.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "fidelity-policy.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, ".github", "workflows", "testops-control.yml"))).toBe(true);
    expect(existsSync(path.join(root, "vitest.runtime.workspace.ts"))).toBe(true);
  });
});
