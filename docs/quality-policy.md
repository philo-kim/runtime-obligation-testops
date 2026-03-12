# Quality Policy

`runtime-quality-policy.json` governs whether a reviewed runtime model is too coarse to be trustworthy.

It exists for a specific failure mode:

- discovery drift is closed
- every runtime source has an obligation
- every obligation has owner tests
- validation is green
- but the reviewed model is so broad that missing runtime proof still hides inside it

## What it controls

Quality policy lets a repo set rules such as:

- maximum files per reviewed inventory source
- maximum files per obligation
- maximum reviewed inventory sources per obligation

Rules can be set:

- globally
- per surface
- per inventory source
- per obligation

## Why it is separate from fidelity

Fidelity asks:

- how real is the proof

Quality asks:

- how granular is the proof graph

Both matter.

High-fidelity proof can still be too coarse.
Granular proof can still be too simulated.

## Typical rollout

Start with warnings.

Then raise high-risk surfaces such as:

- client state
- persistence semantics
- background execution
- external contracts

to errors once the reviewed model is stable enough.
