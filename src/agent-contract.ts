import path from "node:path";
import type { AgentCommand, AgentCommandId, ArtifactPathMap, RuntimeAgentContract } from "./types.js";

function relativeArtifactPaths(
  repoRoot: string,
  artifactPaths: ArtifactPathMap,
): ArtifactPathMap {
  return {
    controlPlanePath: path.relative(repoRoot, artifactPaths.controlPlanePath) || ".",
    inventoryPath: path.relative(repoRoot, artifactPaths.inventoryPath) || ".",
    surfaceCatalogPath: path.relative(repoRoot, artifactPaths.surfaceCatalogPath) || ".",
    fidelityPolicyPath: path.relative(repoRoot, artifactPaths.fidelityPolicyPath) || ".",
    qualityPolicyPath: path.relative(repoRoot, artifactPaths.qualityPolicyPath) || ".",
    discoveryPolicyPath: path.relative(repoRoot, artifactPaths.discoveryPolicyPath) || ".",
  };
}

export function buildRuntimeAgentContract(
  repoRoot: string,
  options: {
    version: string;
    principle: string;
    artifactPaths: ArtifactPathMap;
    commandOverrides?: Partial<Record<AgentCommandId, string>>;
  },
): RuntimeAgentContract {
  const artifactPaths = relativeArtifactPaths(repoRoot, options.artifactPaths);
  const defaultCommands: AgentCommand[] = [
    {
      id: "review",
      command: "rotops review",
      purpose: "Show unresolved discovered candidates that still need reviewed-model decisions.",
      blocking: false,
    },
    {
      id: "impact",
      command: "rotops impact --changed <path>",
      purpose: "Map changed runtime files to inventory sources, surfaces, obligations, and owner tests.",
      blocking: false,
    },
    {
      id: "validate",
      command: "rotops validate",
      purpose: "Enforce completeness, traceability, and fidelity gates for the reviewed runtime model.",
      blocking: true,
    },
  ];

  return {
    principle: options.principle,
    version: options.version,
    artifactPaths,
    readOrder: [
      artifactPaths.discoveryPolicyPath,
      artifactPaths.inventoryPath,
      artifactPaths.surfaceCatalogPath,
      artifactPaths.controlPlanePath,
      artifactPaths.fidelityPolicyPath,
      artifactPaths.qualityPolicyPath,
      "AGENTS.md",
    ],
    mandatoryLoop: [
      "identify the changed runtime source",
      "run impact analysis or equivalent changed-file mapping",
      "compare discovered candidates against the reviewed model",
      "update repo-local discovery policy if the scanner is noisy or blind for this slice",
      "check whether reviewed-model granularity still satisfies runtime-quality-policy",
      "update inventory, surfaces, obligations, evidence, and owner tests as needed",
      "rerun validate before considering the change complete",
    ],
    requiredCommands: defaultCommands.map((command) => ({
      ...command,
      command: options.commandOverrides?.[command.id] ?? command.command,
    })),
  };
}
