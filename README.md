# runtime-obligation-testops

`runtime-obligation-testops` is a reusable TestOps control system for teams that want automated testing to be managed against real runtime behavior instead of code-unit labels or coverage numbers alone.

## Principle

Automated testing is managed against the full set of runtime obligations.

That obligation set must satisfy:

- `event completeness`
- `outcome closure`
- `observability`
- `traceability`

## What this package gives you

- a runtime inventory model for extracting the full runtime testing denominator
- a surface catalog model for deriving project-specific management surfaces
- a runtime control plane for obligations, evidence, fidelity, and owner tests
- a validator that checks completeness, observability, fidelity, and traceability drift
- report generation in JSON and Markdown
- initialization templates for a new repo
- a runtime inventory scanner and surface derivation CLI
- a Vitest workspace exporter for teams using Vitest
- an impact analyzer for changed runtime files
- AI-agent guidance for maintaining the control plane

## Install

```bash
npm install -D runtime-obligation-testops
```

## Quick start

```bash
npx rotops init
npx rotops inventory scan
npx rotops surfaces derive
npx rotops validate
npx rotops report
```

If you use Vitest:

```bash
npx rotops export vitest-workspace --out vitest.runtime.workspace.ts
```

## Core files

- `testops/runtime-inventory.json`
- `testops/runtime-surfaces.json`
- `testops/runtime-control-plane.json`
- `testops/fidelity-policy.json`
- `testops/runtime-control-plane.schema.json`
- `AGENTS.md`
- `.github/workflows/testops-control.yml`

## Commands

- `rotops init`
- `rotops inventory scan`
- `rotops surfaces derive`
- `rotops validate`
- `rotops report`
- `rotops impact`
- `rotops export vitest-workspace`

## How to think about it

This system does not start from:

- unit vs integration vs component
- file coverage
- package structure

It starts from:

- what can happen to the system at runtime
- what the system must guarantee when those events happen
- what evidence proves the guarantee externally
- which automated tests own that proof

## Documentation

- [Principles](./docs/principles.md)
- [Control-Plane Model](./docs/model.md)
- [Adoption Guide](./docs/adoption.md)
- [AI Agent Integration](./docs/ai-agent-integration.md)

## Example

There is a concrete example under [examples/apppulse](./examples/apppulse/testops/runtime-control-plane.json).
