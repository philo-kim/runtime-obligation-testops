# runtime-obligation-testops

`runtime-obligation-testops` is a TestOps control system for teams that want automated testing managed against real runtime behavior, not just test labels or line coverage.

The package exists for one reason:

`automated testing is managed against the full set of runtime obligations`

That rule is enforced through four non-negotiable properties:

- `event completeness`
- `outcome closure`
- `observability`
- `traceability`

## What problem this solves

Most projects can tell you:

- how many tests exist
- which folders have tests
- what line coverage says

They usually cannot tell you:

- which runtime events define the real denominator
- whether that denominator was silently narrowed by hand
- which observable outcomes are actually proven
- which tests own that proof

This package turns that into an explicit control system.

## The runtime model

The package manages five connected artifacts:

- `runtime-discovery-policy.json`
  - scanner rules, ignore patterns, reviewed suppressions
- `runtime-inventory.json`
  - the reviewed runtime denominator
- `runtime-surfaces.json`
  - the project-specific management partition over that denominator
- `runtime-control-plane.json`
  - obligations, evidence, fidelity, owner tests
- `fidelity-policy.json`
  - the minimum proof strength required by surface, source, or obligation

The first artifact manages discovery.
The other four artifacts are the reviewed runtime model.

## How it works

The package keeps two layers of truth in tension:

- `discovered runtime candidates`
- `declared reviewed model`

That distinction matters.

If you only manage the declared model, teams can accidentally leave real runtime files out of scope.
If you only trust discovery, you get noisy heuristics instead of a stable operating model.

`rotops validate` is the gate that keeps those two layers from drifting apart silently.

## Commands

```bash
npx rotops init
npx rotops inventory scan
npx rotops surfaces derive
npx rotops validate
npx rotops report
npx rotops impact --changed src/path/to/file.ts
npx rotops export vitest-workspace --out vitest.runtime.workspace.ts
```

## Recommended operating loop

1. Run `inventory scan` to discover candidate runtime sources.
2. Review the candidate denominator.
3. Record suppressions and scanner noise in `runtime-discovery-policy.json`.
4. Accept the reviewed denominator in `runtime-inventory.json`.
5. Derive or refine runtime surfaces in `runtime-surfaces.json`.
6. Register obligations, evidence, fidelity, and owner tests in `runtime-control-plane.json`.
7. Run `validate` before the main test suite.

## What `validate` checks

- artifact schemas are valid
- principles are consistent across artifacts
- reviewed inventory sources map to reviewed surfaces
- reviewed surfaces map to the control plane
- reviewed runtime files are closed by obligations
- owner tests exist and are referenced
- `// runtime-obligations: ...` annotations do not drift
- fidelity does not regress below policy
- discovered runtime files are not missing from the reviewed denominator

## What this package is not

It is not:

- a replacement for your test runner
- a replacement for real-dependency or full-system tests
- an oracle that invents the correct runtime model without human review

It is a control system for keeping your runtime denominator, proof graph, and test ownership aligned.

## Quick start

```bash
npm install -D runtime-obligation-testops
npx rotops init --preset vitest
npx rotops inventory scan
npx rotops surfaces derive
npx rotops validate
```

If your repo does not use the default `testops/` paths, wrap the CLI with project-local scripts and explicit paths.

## Public repo readiness

A repo using this package is publishable when:

- new runtime entrypoints cannot land without inventory review
- discovered-vs-declared drift fails CI
- obligations own tests and annotations
- proof strength is visible through fidelity policy
- humans and AI agents read the same artifacts first

## AI agents

An AI agent should not treat the control plane as documentation.
It should treat it as the runtime source of truth for automated testing changes.

Start here:

- [Principles](./docs/principles.md)
- [Runtime Model](./docs/model.md)
- [Adoption Guide](./docs/adoption.md)
- [Completeness Workflow](./docs/completeness-workflow.md)
- [AI Agent Integration](./docs/ai-agent-integration.md)

## Example

The package includes a concrete product example under [examples/apppulse](./examples/apppulse).
It shows how a real app can express:

- discovery policy
- reviewed inventory
- runtime surfaces
- runtime obligations
- fidelity policy

## License

MIT
