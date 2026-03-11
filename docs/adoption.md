# Adoption Guide

## 1. Inventory runtime sources

Do not start from folders or test files.

Start from the runtime:

- request entrypoints
- UI entrypoints
- background entrypoints
- storage boundaries
- external adapters

You can seed this with:

```bash
npx rotops inventory scan
```

## 2. Derive surfaces

Create management surfaces that are:

- meaningful for your runtime
- non-overlapping enough to stay operable
- broad enough to cover the whole runtime

You can generate a first draft with:

```bash
npx rotops surfaces derive
```

## 3. Register obligations

For each surface, create obligations in this form:

- event
- outcomes
- evidence
- owner tests

If the surface has stronger expectations, encode them in `fidelity-policy.json`.

## 4. Map tests to obligations

Tests are not primary objects anymore.

They are proof artifacts owned by obligations.

## 5. Add the validator to CI

Run `rotops validate` before the main test suite.

This catches:

- inventory sources that are not assigned to a surface
- surfaces that are not represented in the control plane
- uncovered runtime sources
- orphan owner tests
- missing owner files
- missing evidence or outcome classes
- fidelity regressions
- annotation drift

## 6. Export runner-specific configs if needed

If you use Vitest, generate a runtime-surface workspace:

```bash
npx rotops export vitest-workspace --out vitest.runtime.workspace.ts
```

## 7. Teach AI agents the same source of truth

Point agents at:

- the control plane
- the schema
- the validator
- your AGENTS instructions

If an agent changes runtime behavior without updating obligations, the change is incomplete.
