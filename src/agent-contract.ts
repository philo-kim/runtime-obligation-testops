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
      purpose: "Show unresolved discovered runtime candidates that still need reviewed semantic decisions.",
      blocking: false,
    },
    {
      id: "impact",
      command: "rotops impact --changed <path>",
      purpose: "Map changed runtime files to reviewed inventory sources, surfaces, obligations, and owner tests.",
      blocking: false,
    },
    {
      id: "validate",
      command: "rotops validate",
      purpose: "Enforce completeness, traceability, fidelity, and granularity gates for the reviewed runtime model.",
      blocking: true,
    },
  ];

  return {
    principle: options.principle,
    version: options.version,
    systemIdentity: "runtime-governance-control-system",
    operatingModel:
      "AI agents, repo-local policy, and CI maintain the reviewed runtime model continuously; reviewed decisions are reserved for semantic approval, not routine bookkeeping.",
    reviewedDecisionMeaning:
      "Approve or reject the semantic treatment of discovered runtime candidates, denominator boundaries, obligation scope, evidence sufficiency, fidelity, and suppressions.",
    actorRoles: [
      {
        id: "discovery-engine",
        responsibility: "Propose runtime candidates and discovered-vs-reviewed drift signals.",
        authority: "candidate proposal only",
      },
      {
        id: "repo-local-policy",
        responsibility: "Shape discovery scope, suppressions, overrides, and staged adoption boundaries.",
        authority: "heuristic interpretation",
      },
      {
        id: "ai-agent",
        responsibility: "Update the reviewed model, owner tests, annotations, and governance artifacts as the default operator.",
        authority: "default runtime-governance operator",
      },
      {
        id: "reviewer",
        responsibility: "Approve semantic decisions when acceptance, suppression, fidelity, or granularity is non-obvious.",
        authority: "reviewed semantic approval",
      },
      {
        id: "ci-gate",
        responsibility: "Enforce governance gates so unresolved runtime drift or proof regressions do not merge silently.",
        authority: "merge enforcement",
      },
    ],
    governanceSignals: [
      {
        id: "review-backlog",
        meaning: "Discovered runtime candidates still need reviewed decisions.",
        primary: true,
        blocking: false,
      },
      {
        id: "impact-analysis",
        meaning: "Changed runtime files are mapped to reviewed model ownership and owner tests.",
        primary: true,
        blocking: false,
      },
      {
        id: "governance-validation",
        meaning: "The reviewed runtime model satisfies completeness, traceability, fidelity, and granularity rules.",
        primary: true,
        blocking: true,
      },
      {
        id: "code-coverage",
        meaning: "Secondary code-execution metric only; never a runtime-completeness claim.",
        primary: false,
        blocking: false,
      },
    ],
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
      "let AI update inventory, surfaces, obligations, evidence, annotations, and owner tests before asking for reviewed approval",
      "escalate only semantic approval decisions instead of manual bookkeeping",
      "rerun validate before considering the change complete",
    ],
    requiredCommands: defaultCommands.map((command) => ({
      ...command,
      command: options.commandOverrides?.[command.id] ?? command.command,
    })),
  };
}
