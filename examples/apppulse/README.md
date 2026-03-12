# AppPulse Example

This example shows how a real product expresses its automated test system as a reviewed runtime model.

It matters because this package was extracted from the kind of product represented here:

- multiple runtime entrypoints
- mixed client and server behavior
- persistence rules
- background processing
- external providers

AppPulse is included as a case study of the original failure mode, not as a toy scaffold.

## Included artifacts

- `testops/runtime-discovery-policy.json`
- `testops/runtime-inventory.json`
- `testops/runtime-surfaces.json`
- `testops/runtime-control-plane.json`
- `testops/fidelity-policy.json`
- `testops/runtime-quality-policy.json`

## What the example demonstrates

- discovery is reviewed instead of blindly trusted
- discovery drift is enforced in CI once the repo-local policy is stable
- discovery scope is explicit instead of being silently narrowed
- the runtime denominator is explicit
- runtime surfaces are project-specific, not fixed by the package
- obligations own observable evidence and owner tests
- fidelity is an explicit policy decision
- reviewed-model granularity is governed explicitly instead of being left to taste

## Why this example matters

AppPulse is not a toy folder structure.
It has:

- auth and protected access
- API route contracts
- client bootstrap and state transitions
- persistence and deduplication rules
- background workers
- external provider adapters

That makes it a good illustration of how the model scales beyond unit-vs-integration labels.

It also demonstrates the original reason this package exists:

- a repo can have strong tests and high coverage
- and still need a better way to govern the runtime denominator itself

This example shows what that governance looks like once it has been made explicit.

## How to read it

1. Start with `runtime-discovery-policy.json`
2. Review the accepted denominator in `runtime-inventory.json`
3. See how the denominator is partitioned in `runtime-surfaces.json`
4. Follow obligations and owner tests in `runtime-control-plane.json`
5. Inspect proof-strength requirements in `fidelity-policy.json`

The example is illustrative.
It mirrors a real application model, but it is not executed inside this package repository.
