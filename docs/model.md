# Runtime Model

The package manages runtime verification in five linked artifacts:

- `runtime-discovery-policy.json`
- `runtime-inventory.json`
- `runtime-surfaces.json`
- `runtime-control-plane.json`
- `fidelity-policy.json`

The discovery policy controls how candidate runtime sources are found.
The other four files are the reviewed runtime model.

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

## Runtime discovery policy

Discovery policy defines how the scanner is allowed to behave.

Typical uses:

- ignore tests and generated code
- suppress reviewed false positives
- keep the discovered candidate set stable in CI

## Runtime surface

A runtime surface is a management partition that groups related runtime sources.

Surfaces are not fixed by this package. Each project derives them from its own runtime model.

## Runtime obligation

A runtime obligation is the minimum managed unit of automated verification.

Each obligation records:

- the surface it belongs to
- the runtime source patterns it covers
- the triggering event
- the outcomes the system must preserve
- the evidence that must be externally observable
- the fidelity level
- the owner tests

Obligations close the reviewed inventory with concrete proof.

## Fidelity policy

Fidelity policy defines the minimum proof strength expected for a surface, source, or obligation.

This lets teams distinguish:

- simulated proof
- contract proof
- real dependency proof
- full-system proof

## Fidelity

Fidelity is explicit because different obligations need different proof strengths.

Suggested levels:

- `isolated`
- `simulated`
- `contract`
- `real-dependency`
- `full-system`

The package does not force one set, but it forces each project to define and use one consistently.

## Declared vs discovered

This package intentionally keeps two layers:

- `discovered runtime candidates`
- `declared reviewed model`

The validator compares them so a team cannot silently narrow the denominator by hand.
