# Flutter Session Example

This example shows staged adoption in a non-JS repo.

It is intentionally smaller than AppPulse.
The point is to demonstrate how a team can start with one critical runtime slice while discovery is still being tuned through repo-local policy.

## What this example demonstrates

- a hand-authored reviewed model for a `session/auth` slice
- `candidateReviewMode: "warning"` during bootstrap
- `scopePatterns` that intentionally limit discovery to the pilot slice
- repo-local `sourceOverrides` that steer discovery toward Dart runtime files
- obligations and owner tests that still close the slice even before whole-repo completeness is enforced

## Included artifacts

- `testops/runtime-discovery-policy.json`
- `testops/runtime-inventory.json`
- `testops/runtime-surfaces.json`
- `testops/runtime-control-plane.json`
- `testops/fidelity-policy.json`

## Why this example exists

Not every repo should jump straight to strict discovery.

For stacks where generic scanner heuristics are still immature, the right move is:

1. govern one important slice with a reviewed model
2. run `validate` and `impact`
3. keep discovery visible but advisory
4. tighten repo-local policy
5. promote discovered-vs-reviewed drift to an error later

This example shows that operating posture.
