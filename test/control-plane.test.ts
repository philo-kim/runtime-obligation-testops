import os from "node:os";
import path from "node:path";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { generateVitestWorkspace, initWorkspace, validateControlPlane } from "../src/index.js";
import type { RuntimeControlPlane } from "../src/index.js";

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

function makeBaseControlPlane(): RuntimeControlPlane {
  return {
    version: "1.0.0",
    principle: "automated testing is managed against the full set of runtime obligations",
    evidenceKinds: ["response", "state_transition"],
    fidelityLevels: ["simulated", "contract"],
    surfaces: [
      {
        id: "entry",
        description: "Runtime entry surface",
        sourcePatterns: ["src/**/*.ts"],
        testPatterns: ["test/**/*.test.ts"],
      },
    ],
    obligations: [
      {
        id: "entry.success",
        surface: "entry",
        sourcePatterns: ["src/entry.ts"],
        event: "A request enters the system.",
        outcomes: ["A response is produced."],
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
  it("passes when runtime sources, annotations, and owner tests line up", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(
      root,
      "test/entry.test.ts",
      "// runtime-obligations: entry.success\nexport const testFile = true;\n",
    );

    const summary = validateControlPlane(makeBaseControlPlane(), root);

    expect(summary.issues).toEqual([]);
  });

  it("reports uncovered sources, orphan tests, and missing annotations", () => {
    const root = makeTempDir();
    writeProjectFile(root, "src/entry.ts", "export const entry = true;\n");
    writeProjectFile(root, "src/uncovered.ts", "export const uncovered = true;\n");
    writeProjectFile(root, "test/entry.test.ts", "export const testFile = true;\n");
    writeProjectFile(
      root,
      "test/orphan.test.ts",
      "// runtime-obligations: entry.other\nexport const orphan = true;\n",
    );

    const summary = validateControlPlane(makeBaseControlPlane(), root);
    const messages = summary.issues.map((issue) => issue.message);

    expect(messages).toContain(
      "Owner test test/entry.test.ts is missing a runtime-obligations annotation",
    );
    expect(messages).toContain(
      "Surface entry has an uncovered runtime source: src/uncovered.ts",
    );
    expect(messages).toContain(
      "Surface entry has an unreferenced owner test: test/orphan.test.ts",
    );
  });
});

describe("generateVitestWorkspace", () => {
  it("renders a vitest workspace from runner-tagged surfaces", () => {
    const controlPlane: RuntimeControlPlane = {
      ...makeBaseControlPlane(),
      surfaces: [
        {
          id: "entry",
          description: "Runtime entry surface",
          sourcePatterns: ["src/**/*.ts"],
          testPatterns: ["test/**/*.test.ts"],
          execution: {
            runner: "vitest",
            environment: "node",
            setupFiles: ["test/setup.ts"],
            include: ["test/**/*.test.ts"],
            testTimeout: 5000,
          },
        },
      ],
    };

    const output = generateVitestWorkspace(controlPlane, {
      aliases: {
        "@": "./src",
      },
    });

    expect(output).toContain('name: "entry"');
    expect(output).toContain('environment: "node"');
    expect(output).toContain('path.resolve(process.cwd(), "./src")');
  });
});

describe("initWorkspace", () => {
  it("writes starter files for a vitest project", () => {
    const root = makeTempDir();
    const result = initWorkspace(root, "vitest");

    expect(result.written.length).toBeGreaterThan(0);
    expect(existsSync(path.join(root, "testops", "runtime-control-plane.json"))).toBe(true);
    expect(existsSync(path.join(root, "testops", "runtime-control-plane.schema.json"))).toBe(true);
    expect(existsSync(path.join(root, ".github", "workflows", "testops-control.yml"))).toBe(true);
    expect(existsSync(path.join(root, "vitest.runtime.workspace.ts"))).toBe(true);
  });
});
