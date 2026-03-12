# Repo-Local Policy

`runtime-obligation-testops` is universal at the control-plane level and local at the discovery-policy level.

That split is intentional.

The package should not require a separate distribution for every framework just to stay useful.
Instead, each repo teaches the package how its runtime is expressed.

## What belongs in repo-local policy

Use `runtime-discovery-policy.json` to define:

- the file universe discovery is allowed to inspect
- the currently managed scope of discovery during staged adoption
- which file extensions belong to this repo's source model
- which generated, vendored, or mirrored paths are irrelevant
- which matches are reviewed suppressions
- which runtime-source categories need explicit include or exclude patterns
- whether discovery drift should fail CI or only warn for now

This makes the policy file the portability layer of the system.

## Why this is better than framework-specific package forks

Framework-specific forks scale poorly because:

- mixed repos exist
- internal architecture matters as much as framework choice
- the same framework can have very different runtime layouts
- AI agents need repo-local instructions anyway

Repo-local policy keeps the package core stable while allowing each codebase to express its own runtime signals.

Use `runtime-quality-policy.json` alongside it when the reviewed model starts to get too broad.
Discovery policy governs candidate quality.
Quality policy governs reviewed-model granularity.

## Core fields

### `candidateReviewMode`

Controls how discovered-but-unreviewed runtime files are handled by `rotops validate`.

- `error`
  - completeness drift fails validation
- `warning`
  - completeness drift stays visible but does not fail validation
- `off`
  - completeness drift is ignored entirely

Use `warning` during staged adoption.
Use `error` once discovery is trusted enough to act as a gate.

### `codeFilePatterns`

Defines which files discovery should consider part of the runtime candidate universe.

Examples:

- `["**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}"]`
- `["**/*.{ts,tsx,js,jsx,dart}"]`

### `scopePatterns`

Defines which subset of the candidate universe is actively managed right now.

Use this when:

- adoption is starting from one runtime slice
- a mixed repo contains large unmanaged regions for now
- whole-repo discovery is still too noisy to gate safely

This is how staged adoption becomes explicit instead of ad hoc.

### `sourceExtensions`

Defines which source extensions count when the scanner resolves imports or import-adjacent signals.

### `ignorePatterns`

Defines whole regions of the repo that discovery should never consider.

Typical examples:

- generated code
- vendored SDK directories
- mirrored docs
- build artifacts

### `suppressions`

Reviewed false positives with explicit reasons.

Suppressions are for known, stable noise.
They are not a substitute for modeling real runtime sources.

### `sourceOverrides`

Repo-local include or exclude patterns for specific runtime-source categories.

This is how a repo teaches discovery where its runtime actually lives when generic heuristics are insufficient.

Examples:

- point `client-state` at `lib/presentation/**/*.dart`
- point `external-contracts` at `lib/data/**/*.dart`
- replace `workflow-orchestration` detection with `lib/core/**/*.dart`

## Example staged policy

```json
{
  "$schema": "./runtime-discovery-policy.schema.json",
  "version": "1.0.0",
  "principle": "runtime-obligation-first",
  "candidateReviewMode": "warning",
  "codeFilePatterns": ["**/*.{ts,tsx,js,jsx,dart}"],
  "scopePatterns": ["lib/presentation/auth/**/*.dart", "lib/core/session/**/*.dart"],
  "sourceExtensions": [".ts", ".tsx", ".js", ".jsx", ".dart"],
  "ignorePatterns": ["**/.fvm/**", "**/ios/.symlinks/**", "**/generated/**"],
  "suppressions": [],
  "sourceOverrides": [
    {
      "sourceId": "client-state",
      "mode": "replace",
      "includePatterns": ["lib/presentation/**/*.dart"]
    }
  ]
}
```

## Operating rule

If discovery quality is poor, fix repo-local policy before weakening the reviewed model.

That is the point of this layer.
