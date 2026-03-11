# Control-Plane Model

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

## Fidelity

Fidelity is explicit because different obligations need different proof strengths.

Suggested levels:

- `isolated`
- `simulated`
- `contract`
- `real-dependency`
- `full-system`

The package does not force one set, but it forces each project to define and use one consistently.
