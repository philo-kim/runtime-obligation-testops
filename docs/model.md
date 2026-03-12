# Runtime Model

The package manages runtime verification through six linked artifacts:

- `runtime-discovery-policy.json`
- `runtime-inventory.json`
- `runtime-surfaces.json`
- `runtime-control-plane.json`
- `fidelity-policy.json`
- `runtime-quality-policy.json`

The discovery policy controls how candidate runtime sources are found and reviewed.
The next four files form the reviewed runtime model.
The quality policy governs whether that reviewed model is too coarse to expose real gaps.

Together they answer five different questions:

- what the scanner is allowed to propose
- what the team accepts as the runtime denominator
- how that denominator is partitioned into manageable surfaces
- what reviewed behaviors and evidence govern each surface
- what proof strength is required
- whether the reviewed model is still granular enough to expose missing proof

In the intended operating loop, AI updates these artifacts continuously and review approves the semantic decisions that remain.

## Runtime source

A runtime source is any entrypoint or boundary where system behavior begins.

Examples:

- route handler
- CLI command
- page
- webhook
- worker processor
- scheduler
- external adapter

Inventory sources define the reviewed denominator:

- what can enter the system
- where state can change
- where background execution starts
- where storage or provider boundaries exist

They are often seeded by scanner output, but they are not the same thing as raw scanner output.
The inventory is the reviewed answer to "what real runtime scope are we governing?"

## Runtime discovery policy

Discovery policy defines how the scanner is allowed to behave.

Typical uses:

- set discovered-vs-reviewed drift handling to `error`, `warning`, or `off`
- define the file universe the scanner is allowed to inspect
- extend source extensions beyond the default JS/TS set
- ignore tests and generated code
- suppress reviewed false positives
- override specific runtime-source categories with repo-local include or exclude patterns
- keep the discovered candidate set stable in CI

This file exists because discovery is useful but imperfect.
It lets the team control heuristics without mutating the reviewed denominator just to get a clean-looking build.

That makes discovery policy the main portability layer of the package.
The core model stays universal while each repo teaches discovery how its runtime is actually expressed.

## Runtime surface

A runtime surface is a management partition that groups related runtime sources.

Surfaces are not fixed by this package. Each project derives them from its own runtime model.

Examples in different projects might include:

- auth and access
- request boundary
- client state
- workflow orchestration
- persistence semantics
- background execution
- external contracts
- runtime invariants

The point is not to force a universal taxonomy.
The point is to create an operable partition over the reviewed denominator.

## Runtime behavior denominator

The reviewed denominator can now be expressed explicitly in `runtime-inventory.json` through `behaviors`.

Each reviewed runtime behavior records:

- which inventory source it belongs to
- the triggering event
- the expected evidence
- the expected outcome classes
- the minimum fidelity when that behavior needs stronger proof

If `inventory.behaviors` is absent, the package falls back to synthesizing reviewed behaviors from `source.events`.
Explicit `inventory.behaviors` is preferred because it lets the denominator be finer than the source list.

## Runtime behavior unit

A runtime behavior unit is the minimum managed unit of automated verification.

Each behavior unit records:

- the surface it belongs to
- the runtime source patterns it covers
- the triggering event
- the outcomes the system must preserve
- the evidence that must be externally observable
- the fidelity level
- the owner tests

Behavior units close the reviewed inventory with concrete proof.
They are the place where reviewed runtime behavior stops being informal and becomes test-governed.

The control-plane file still accepts the legacy key name `obligations`, but the preferred model is `behaviors`.

## Fidelity policy

Fidelity policy defines the minimum proof strength expected for a surface, source, reviewed behavior, or behavior unit.

This lets teams distinguish:

- simulated proof
- contract proof
- real dependency proof
- full-system proof

## Fidelity

Fidelity is explicit because different behavior units need different proof strengths.

Suggested levels:

- `isolated`
- `simulated`
- `contract`
- `real-dependency`
- `full-system`

The package does not force one universal set, but it forces each project to define and use one consistently.

This matters because not all behavior units should be satisfied with the same kind of proof.
Some need real storage, real queues, or full-system execution.

## Quality policy

Quality policy governs reviewed-model granularity.

Typical uses:

- flag an inventory source that expands to too many files
- flag a behavior unit that expands to too many files
- flag a behavior unit that spans too many reviewed inventory sources
- flag a behavior unit that spans too many reviewed inventory behaviors

This matters because a clean control plane can still hide missing proof if the reviewed model is overly aggregated.

## Declared vs discovered

This package intentionally keeps two layers:

- `discovered runtime candidates`
- `declared reviewed model`

The validator compares them so a team cannot silently narrow the denominator by hand.

That comparison is what turns the package from a static documentation format into a control system.
