# Adoption Guide

## Start from the runtime, not the repo layout

Do not begin with:

- `unit / integration / component`
- package folders
- line coverage

Begin with what can actually happen at runtime:

- request entrypoints
- UI entrypoints
- storage boundaries
- background execution
- external adapters
- session and auth boundaries

The point of adoption is not to rename tests.
The point is to make the runtime denominator explicit and governable.

## When this package is worth adopting

Adopt it when a repo already has meaningful automation, but still struggles to answer:

- what the real runtime denominator is
- whether a runtime layer is missing from review
- which tests actually own important behavior
- which obligations are only covered by weak proof

If your team only wants a prettier test folder structure, this package is the wrong tool.

## The adoption sequence

### 1. Discover candidate runtime sources

```bash
npx rotops inventory scan
```

This gives you the first draft of the denominator.
It is intentionally heuristic.

### 2. Review scanner noise

Use `runtime-discovery-policy.json` to:

- ignore generated or irrelevant files
- suppress reviewed false positives
- keep CI stable

Do not edit the reviewed denominator just to make validation green.
Review discovery first.

The discovery layer exists to challenge the reviewed model, not to be rewritten away.

### 3. Declare the reviewed denominator

Move accepted runtime sources into `runtime-inventory.json`.

This file is the denominator your team is willing to manage.
If the denominator is wrong, every downstream green signal is weaker than it looks.

### 4. Derive management surfaces

```bash
npx rotops surfaces derive
```

Then refine the result.

Good surfaces are:

- meaningful for your runtime
- stable enough to operate
- non-overlapping enough to stay understandable
- complete enough to cover the reviewed denominator

There is no package-level fixed list.
Surfaces are project-specific management partitions.

### 5. Register obligations

For each surface, define obligations with:

- event
- outcomes
- evidence
- fidelity
- owner tests

### 6. Connect the proof

Annotate owner tests:

```ts
// runtime-obligations: surface.example-obligation
```

If a test owns no obligation, it should not be presented as runtime proof.

### 7. Add the control gate to CI

Run:

```bash
npx rotops validate
```

before the main test suite.

Treat `validate` failures as control-plane regressions, not as incidental tooling noise.

## What a good rollout looks like

At the end of adoption, your repo should be able to answer:

- what the runtime denominator is
- which surfaces partition it
- which obligations close it
- what evidence proves each obligation
- which tests own that proof
- whether discovered runtime files are missing from the reviewed model

It should also be able to reject this failure mode:

- high coverage
- many tests
- green CI
- but no proof that the full runtime denominator is governed

## Public repo checklist

- commit the five runtime artifacts
- commit `AGENTS.md`
- fail CI on `rotops validate`
- keep generated reports out of git
- document any non-default path layout
- make example owner-test annotations visible in the repo

## Existing repos with custom paths

If your repo already uses `testing/` instead of `testops/`, keep the artifacts where they are and wrap `rotops` with project-local scripts.

The rule is consistency, not folder dogma.
