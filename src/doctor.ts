import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { ArtifactPathMap, RuntimeDoctorIssue, RuntimeDoctorSummary } from "./types.js";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface PackageLockShape {
  packages?: Record<
    string,
    {
      version?: string;
      resolved?: string;
    }
  >;
}

function readJson<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function findRequestedPackageSpec(repoRoot: string): string | undefined {
  const packageJson = readJson<PackageJsonShape>(path.join(repoRoot, "package.json"));
  return (
    packageJson?.dependencies?.["runtime-obligation-testops"] ??
    packageJson?.devDependencies?.["runtime-obligation-testops"]
  );
}

function findLockfileEntry(repoRoot: string): { version?: string; resolved?: string } | undefined {
  const packageLock = readJson<PackageLockShape>(path.join(repoRoot, "package-lock.json"));
  return packageLock?.packages?.["node_modules/runtime-obligation-testops"];
}

function extractRequestedGitRef(spec: string | undefined): string | undefined {
  if (!spec) {
    return undefined;
  }

  const hashIndex = spec.lastIndexOf("#");
  if (hashIndex === -1) {
    return undefined;
  }

  return spec.slice(hashIndex + 1);
}

function relativeOrSelf(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath) || ".";
}

export function runDoctor(
  repoRoot: string,
  artifactPaths: ArtifactPathMap,
): RuntimeDoctorSummary {
  const issues: RuntimeDoctorIssue[] = [];
  const requestedPackageSpec = findRequestedPackageSpec(repoRoot);
  const lockfileEntry = findLockfileEntry(repoRoot);
  const installedPackagePath = path.join(repoRoot, "node_modules", "runtime-obligation-testops", "package.json");
  const installedPackage = readJson<{ version?: string }>(installedPackagePath);

  const artifactCandidates = [
    artifactPaths.controlPlanePath,
    artifactPaths.inventoryPath,
    artifactPaths.surfaceCatalogPath,
    artifactPaths.fidelityPolicyPath,
    artifactPaths.qualityPolicyPath,
    artifactPaths.discoveryPolicyPath,
    artifactPaths.selfCheckPolicyPath,
    artifactPaths.retrospectiveLogPath,
  ].filter((filePath): filePath is string => Boolean(filePath));

  for (const relativePath of artifactCandidates) {
    const absolutePath = path.isAbsolute(relativePath)
      ? relativePath
      : path.join(repoRoot, relativePath);
    if (!existsSync(absolutePath)) {
      issues.push({
        level: "error",
        code: "missing-artifact",
        message: `Required runtime artifact ${relativeOrSelf(repoRoot, absolutePath)} does not exist.`,
      });
    }
  }

  if (!requestedPackageSpec) {
    issues.push({
      level: "warning",
      code: "missing-package-spec",
      message: "package.json does not declare runtime-obligation-testops as a dependency or devDependency.",
    });
  }

  if (!lockfileEntry) {
    issues.push({
      level: "warning",
      code: "missing-lockfile-entry",
      message: "package-lock.json does not contain a node_modules/runtime-obligation-testops entry.",
    });
  }

  if (!installedPackage) {
    issues.push({
      level: "error",
      code: "missing-installed-package",
      message: "node_modules/runtime-obligation-testops is not installed in this repository.",
    });
  }

  if (requestedPackageSpec && lockfileEntry?.resolved) {
    const requestedGitRef = extractRequestedGitRef(requestedPackageSpec);
    if (requestedGitRef && !lockfileEntry.resolved.includes(requestedGitRef)) {
      issues.push({
        level: "error",
        code: "package-ref-mismatch",
        message: `package-lock.json resolves runtime-obligation-testops to ${lockfileEntry.resolved}, which does not match the requested ref ${requestedGitRef}.`,
      });
    }
  }

  if (lockfileEntry?.version && installedPackage?.version && lockfileEntry.version !== installedPackage.version) {
    issues.push({
      level: "error",
      code: "package-version-mismatch",
      message: `Installed runtime-obligation-testops version ${installedPackage.version} does not match package-lock.json version ${lockfileEntry.version}.`,
    });
  }

  return {
    requestedPackageSpec,
    lockfilePackageSpec: lockfileEntry?.resolved ?? lockfileEntry?.version,
    installedPackageVersion: installedPackage?.version,
    installedPackagePath: existsSync(installedPackagePath)
      ? relativeOrSelf(repoRoot, installedPackagePath)
      : undefined,
    controlArtifactsChecked: artifactCandidates.length,
    issues,
  };
}

export function renderDoctorMarkdown(summary: RuntimeDoctorSummary): string {
  const lines: string[] = [];
  lines.push("# Runtime Doctor Report");
  lines.push("");
  lines.push("This report verifies that the local repository is actually wired to the reviewed runtime-completeness system it claims to use.");
  lines.push("");
  lines.push(`- Requested Package Spec: ${summary.requestedPackageSpec ?? "(missing)"}`);
  lines.push(`- Lockfile Package Spec: ${summary.lockfilePackageSpec ?? "(missing)"}`);
  lines.push(`- Installed Package Version: ${summary.installedPackageVersion ?? "(missing)"}`);
  lines.push(`- Installed Package Path: ${summary.installedPackagePath ?? "(missing)"}`);
  lines.push(`- Control Artifacts Checked: ${summary.controlArtifactsChecked}`);
  lines.push(`- Issues: ${summary.issues.length}`);
  lines.push("");

  if (summary.issues.length === 0) {
    lines.push("## Status");
    lines.push("");
    lines.push("- No wiring or installation issues were found.");
    return lines.join("\n");
  }

  lines.push("## Issues");
  lines.push("");
  for (const issue of summary.issues) {
    lines.push(`- [${issue.level}] ${issue.message}`);
  }

  return lines.join("\n");
}

export function printDoctorSummary(summary: RuntimeDoctorSummary): void {
  console.log("Runtime doctor 1.0.0");
  console.log(`- requested package spec: ${summary.requestedPackageSpec ?? "(missing)"}`);
  console.log(`- lockfile package spec: ${summary.lockfilePackageSpec ?? "(missing)"}`);
  console.log(`- installed package version: ${summary.installedPackageVersion ?? "(missing)"}`);
  console.log(`- control artifacts checked: ${summary.controlArtifactsChecked}`);
  console.log(`- doctor issues: ${summary.issues.length}`);

  if (summary.issues.length > 0) {
    console.log("");
    for (const issue of summary.issues.slice(0, 20)) {
      console.log(`- [${issue.level}] ${issue.message}`);
    }
    if (summary.issues.length > 20) {
      console.log(`- ... ${summary.issues.length - 20} more issues`);
    }
  }
}
