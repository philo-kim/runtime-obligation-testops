# Completeness Workflow

The package manages two different but connected things:

1. `discovered runtime candidates`
2. `reviewed runtime behaviors`

If you only manage the reviewed model, you can still miss part of the denominator.
If you only trust discovery, you will drown in heuristics and false positives.

The right workflow is to reconcile them continuously.

That workflow exists because completeness is not the same thing as consistency.
A perfectly consistent reviewed model can still be incomplete if the runtime denominator was silently narrowed.

## The six artifacts

- `runtime-discovery-policy.json`
- `runtime-inventory.json`
- `runtime-surfaces.json`
- `runtime-control-plane.json`
- `fidelity-policy.json`
- `runtime-quality-policy.json`

## What each artifact does

### Discovery policy

Controls the scanner:

- ignore noisy files
- document reviewed suppressions
- steer discovery with repo-local source overrides
- decide whether discovered-vs-reviewed drift is an error or a warning

This is where you justify why a discovered candidate should not become part of the managed denominator.

### Inventory

The reviewed denominator.

This is not raw scanner output.
It is the set of runtime sources your team has accepted as the managed scope.

### Surfaces

The reviewed management partition over that denominator.

These are project-specific and may differ from the scanner's first draft.

### Control plane

The proof graph:

- event
- outcomes
- evidence
- owner tests
- fidelity

### Fidelity policy

The minimum strength of proof expected for each layer of the graph.

Without fidelity policy, teams can overclaim runtime confidence using only low-realism proofs.

### Quality policy

The maximum coarseness the reviewed model is allowed to aggregate before it becomes a smell.

Without quality policy, teams can keep a clean-looking control plane while still hiding gaps inside overly broad sources or behavior units.

## Recommended operating loop

1. run `rotops inventory scan`
2. run `rotops review`
3. review the candidate discoveries
4. update `runtime-discovery-policy.json` for real suppressions or staged scope decisions
5. update `runtime-inventory.json`
6. derive or update `runtime-surfaces.json`
7. update `runtime-quality-policy.json` if the reviewed model got broader or was split
8. update reviewed behaviors, behavior units, and owner tests
9. run `rotops validate`

## What `validate` now proves

- declared inventory sources map to surfaces
- declared surfaces map to the control plane
- declared behaviors close the declared inventory
- owner tests and annotations are traceable
- discovered runtime files are not silently missing from the declared inventory
- reviewed sources and behavior units are not broader than the quality policy allows

## What still requires review

- whether scanner suppressions are justified
- whether outcomes are actually closed, not just minimally listed
- whether fidelity policy is strong enough for the runtime surface
- whether top black-box layers still need separate proof

## What `validate` does not replace

- human review of the runtime model
- real-dependency test authoring
- full-system or manual black-box verification

The package is a control system, not an oracle.
