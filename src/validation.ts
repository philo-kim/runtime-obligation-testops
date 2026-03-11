import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { expandPatterns, parseRuntimeObligationsAnnotation } from "./fs-utils.js";
import { validateControlPlaneShape } from "./schema.js";
import type {
  RuntimeControlPlane,
  Surface,
  SurfaceSummary,
  ValidationIssue,
  ValidationOptions,
  ValidationSummary,
} from "./types.js";

function surfaceById(
  controlPlane: RuntimeControlPlane,
  id: string,
): Surface | undefined {
  return controlPlane.surfaces.find((surface) => surface.id === id);
}

export function validateControlPlane(
  controlPlane: RuntimeControlPlane,
  repoRoot: string,
  options: ValidationOptions = {},
): ValidationSummary {
  const issues: ValidationIssue[] = [];
  const surfaceIdSet = new Set<string>();
  const obligationIdSet = new Set<string>();
  const requireAnnotations = options.requireAnnotations ?? true;

  for (const schemaIssue of validateControlPlaneShape(controlPlane)) {
    issues.push({
      level: "error",
      message: `Schema violation: ${schemaIssue}`,
    });
  }

  if (controlPlane.surfaces.length === 0) {
    issues.push({
      level: "error",
      message: "The control plane does not define any runtime surfaces",
    });
  }

  if (controlPlane.obligations.length === 0) {
    issues.push({
      level: "error",
      message: "The control plane does not define any runtime obligations",
    });
  }

  for (const surface of controlPlane.surfaces) {
    if (surfaceIdSet.has(surface.id)) {
      issues.push({
        level: "error",
        message: `Duplicate surface id: ${surface.id}`,
      });
    }
    surfaceIdSet.add(surface.id);
  }

  for (const obligation of controlPlane.obligations) {
    if (obligationIdSet.has(obligation.id)) {
      issues.push({
        level: "error",
        message: `Duplicate obligation id: ${obligation.id}`,
      });
    }
    obligationIdSet.add(obligation.id);
  }

  const surfaceSources = new Map<string, string[]>();
  const surfaceTests = new Map<string, string[]>();
  const obligationSources = new Map<string, string[]>();
  const referencedTestsBySurface = new Map<string, Set<string>>();
  const cachedTestSources = new Map<string, string>();

  for (const surface of controlPlane.surfaces) {
    const sources = expandPatterns(
      repoRoot,
      surface.sourcePatterns,
      surface.sourceIgnorePatterns ?? [],
    );
    const tests = expandPatterns(
      repoRoot,
      surface.testPatterns,
      surface.testIgnorePatterns ?? [],
    );

    surfaceSources.set(surface.id, sources);
    surfaceTests.set(surface.id, tests);

    if (sources.length === 0) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} did not resolve any runtime sources`,
      });
    }

    if (tests.length === 0) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} did not resolve any owner tests`,
      });
    }
  }

  for (const obligation of controlPlane.obligations) {
    const surface = surfaceById(controlPlane, obligation.surface);

    if (!surface) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} references unknown surface ${obligation.surface}`,
      });
      continue;
    }

    if (!obligation.event.trim()) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} is missing an event description`,
      });
    }

    if (obligation.outcomes.length === 0) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} has no outcomes`,
      });
    }

    if (obligation.evidence.length === 0) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} has no observable evidence`,
      });
    }

    for (const evidence of obligation.evidence) {
      if (!controlPlane.evidenceKinds.includes(evidence)) {
        issues.push({
          level: "error",
          message: `Obligation ${obligation.id} uses unsupported evidence kind ${evidence}`,
        });
      }
    }

    if (!controlPlane.fidelityLevels.includes(obligation.fidelity)) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} uses unsupported fidelity ${obligation.fidelity}`,
      });
    }

    const sources = expandPatterns(
      repoRoot,
      obligation.sourcePatterns,
      surface.sourceIgnorePatterns ?? [],
    );

    obligationSources.set(obligation.id, sources);

    if (sources.length === 0) {
      issues.push({
        level: "error",
        message: `Obligation ${obligation.id} did not resolve any runtime sources`,
      });
    }

    for (const ownerTest of obligation.ownerTests) {
      const absoluteOwnerTest = path.join(repoRoot, ownerTest);
      if (!existsSync(absoluteOwnerTest)) {
        issues.push({
          level: "error",
          message: `Obligation ${obligation.id} references missing owner test ${ownerTest}`,
        });
        continue;
      }

      const knownSurfaceTests = surfaceTests.get(surface.id) ?? [];
      if (!knownSurfaceTests.includes(ownerTest)) {
        issues.push({
          level: "error",
          message: `Obligation ${obligation.id} references ${ownerTest}, which is not registered under surface ${surface.id}`,
        });
      }

      if (!referencedTestsBySurface.has(surface.id)) {
        referencedTestsBySurface.set(surface.id, new Set<string>());
      }
      referencedTestsBySurface.get(surface.id)?.add(ownerTest);

      if (!cachedTestSources.has(ownerTest)) {
        cachedTestSources.set(ownerTest, readFileSync(absoluteOwnerTest, "utf8"));
      }

      const annotatedIds = parseRuntimeObligationsAnnotation(
        cachedTestSources.get(ownerTest) ?? "",
      );

      if (requireAnnotations && annotatedIds.length === 0) {
        issues.push({
          level: "error",
          message: `Owner test ${ownerTest} is missing a runtime-obligations annotation`,
        });
      }

      if (annotatedIds.length > 0 && !annotatedIds.includes(obligation.id)) {
        issues.push({
          level: "error",
          message: `Test ${ownerTest} has runtime-obligations annotation but does not include ${obligation.id}`,
        });
      }
    }
  }

  const surfaceSummaries: SurfaceSummary[] = controlPlane.surfaces.map((surface) => {
    const sources = surfaceSources.get(surface.id) ?? [];
    const tests = surfaceTests.get(surface.id) ?? [];
    const obligations = controlPlane.obligations.filter(
      (obligation) => obligation.surface === surface.id,
    );
    const coveredSources = new Set<string>();

    for (const obligation of obligations) {
      for (const source of obligationSources.get(obligation.id) ?? []) {
        coveredSources.add(source);
      }
    }

    const uncoveredSources = sources.filter((source) => !coveredSources.has(source));
    for (const source of uncoveredSources) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} has an uncovered runtime source: ${source}`,
      });
    }

    const referencedTests = referencedTestsBySurface.get(surface.id) ?? new Set<string>();
    const unreferencedTests = tests.filter((testFile) => !referencedTests.has(testFile));
    for (const testFile of unreferencedTests) {
      issues.push({
        level: "error",
        message: `Surface ${surface.id} has an unreferenced owner test: ${testFile}`,
      });
    }

    return {
      id: surface.id,
      sources: sources.length,
      tests: tests.length,
      obligations: obligations.length,
      uncoveredSources,
      unreferencedTests,
    };
  });

  return {
    principle: controlPlane.principle,
    version: controlPlane.version,
    surfaceSummaries,
    issues,
  };
}

export function printSummary(summary: ValidationSummary): void {
  console.log(`Runtime control plane ${summary.version}`);

  for (const surface of summary.surfaceSummaries) {
    console.log(
      `- ${surface.id}: sources=${surface.sources}, tests=${surface.tests}, obligations=${surface.obligations}, uncovered=${surface.uncoveredSources.length}, unreferencedTests=${surface.unreferencedTests.length}`,
    );
  }

  if (summary.issues.length === 0) {
    return;
  }

  console.log("");
  for (const issue of summary.issues) {
    console.log(`[${issue.level}] ${issue.message}`);
  }
}
