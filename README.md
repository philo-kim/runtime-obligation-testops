# runtime-obligation-testops

`runtime-obligation-testops` is a TestOps control system for teams that want automated testing managed against real runtime behavior, not just test labels or line coverage.

The package exists for one governing rule:

`automated testing is managed against the full set of runtime obligations`

That rule is enforced through four properties:

- `event completeness`
- `outcome closure`
- `observability`
- `traceability`

## Why this exists

This project started from a real failure mode in a real product.

The original product had:

- a large automated test suite
- very high code coverage
- passing builds
- clear `unit / integration / component` labels

and still had missing runtime layers.

The core problem was not that the product had too few tests.
The problem was that the product had no durable way to answer:

- what the real runtime denominator is
- which runtime layers are actually managed
- what observable outcomes are proven
- which tests own that proof
- whether the denominator has been silently narrowed by hand

In practice that caused exactly the kind of mistake this package is designed to prevent:

- a repo can look “100% covered”
- a declared control plane can look clean
- and a whole runtime layer can still be absent from the managed denominator

That is why this package exists.

It is not a prettier coverage tool.
It is a control system for the runtime denominator itself.

## What problem it solves

Most repos can tell you:

- how many tests exist
- which folders contain tests
- which runner they use
- what line coverage says

Most repos cannot tell you:

- which runtime events define the real denominator
- which surfaces partition that denominator
- which obligations close those surfaces
- what evidence proves each obligation
- which tests own that evidence
- whether discovery and the reviewed model have drifted apart

This package makes those questions explicit and operational.

## What the package actually manages

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

## The key design choice: discovered vs reviewed

The package keeps two layers of truth in tension:

- `discovered runtime candidates`
- `reviewed runtime model`

That distinction is the whole point.

If you manage only the reviewed model, teams can accidentally leave real runtime files out of scope.
If you trust only discovery, you get noisy heuristics instead of an operable system.

`rotops validate` exists to stop those two layers from drifting apart silently.

## Where this fits in a real test strategy

This package is for governing automated verification below and around the top black-box layer.

It helps teams manage:

- request boundaries
- client state transitions
- workflow orchestration
- persistence semantics
- background execution
- external contracts
- runtime invariants

It does not eliminate the need for:

- real-dependency integration tests
- full-system tests
- browser or manual black-box checks

Those layers still matter.
This package exists so the rest of the automated stack is not managed blindly.

## What this is not

It is not:

- a replacement for your test runner
- a replacement for E2E or manual testing
- an oracle that invents the correct runtime model without review
- a promise that line coverage now means runtime completeness

It is a control system for keeping your runtime denominator, proof graph, and test ownership aligned.

## Commands

Install the package in the target repo first:

```bash
npm install -D runtime-obligation-testops
```

Then run the CLI:

```bash
npx rotops init
npx rotops inventory scan
npx rotops surfaces derive
npx rotops validate
npx rotops report
npx rotops impact --changed src/path/to/file.ts
npx rotops export vitest-workspace --out vitest.runtime.workspace.ts
```

If your repo uses non-default paths such as `testing/` instead of `testops/`, keep the artifacts where they are and wrap the CLI with project-local scripts.

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

## How to use this in practice

Use it when you want a repo to answer, concretely:

- what runtime behavior exists
- what part of it is managed
- what part is still unreviewed
- what proof exists
- what proof is too weak
- what changed files affect which obligations

Do not use it as a cosmetic wrapper around existing folder labels.
If the runtime denominator is not reviewed, the system is being used incorrectly.

## Public repo readiness

A repo using this package is publishable when:

- new runtime entrypoints cannot land without denominator review
- discovered-vs-declared drift fails CI
- obligations own tests and annotations
- proof strength is visible through fidelity policy
- humans and AI agents read the same artifacts first

## AI agents

An AI agent should not treat the control plane as documentation.
It should treat it as the runtime source of truth for automated testing changes.

Start here:

- [Why This Exists](./docs/why-this-exists.md)
- [Principles](./docs/principles.md)
- [Runtime Model](./docs/model.md)
- [Adoption Guide](./docs/adoption.md)
- [Completeness Workflow](./docs/completeness-workflow.md)
- [AI Agent Integration](./docs/ai-agent-integration.md)

## Example

The package includes a concrete product example under [examples/apppulse](./examples/apppulse).

That example matters because this package was not invented from a blank framework template.
It was extracted from a real product that exposed the exact failure mode this system is meant to prevent.

## License

MIT
