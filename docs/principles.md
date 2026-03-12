# Principles

This package starts from one operational problem:

`a repo can have many tests, high coverage, and still fail to express what runtime behavior is actually governed`

The control system exists to prevent that failure mode.

It is meant to be operated by AI agents, repo-local policy, and CI as the default loop.
Human review remains for semantic approval, not repetitive bookkeeping.

## Governing rule

`automated testing is managed against the full set of runtime obligations`

That rule matters because neither test labels nor line coverage define the real denominator of the system.
Only runtime behavior does.

## The four required properties

### Event completeness

Every externally reachable runtime event must exist in the managed denominator.

Typical examples:

- user actions
- request entrypoints
- scheduled jobs
- queue deliveries
- worker execution
- storage boundaries
- external provider interactions
- retries and replays

If a real event can happen in production but is absent from the model, the system is incomplete even if coverage is high.

### Outcome closure

Each event must close over the outcomes the real system can produce.

Typical examples:

- success
- rejection
- validation failure
- timeout
- retry
- duplicate execution
- partial success
- delayed propagation
- fallback

If only the happy path is modeled, the runtime is not actually governed.

### Observability

Every outcome must terminate in observable evidence.

Typical examples:

- response payload
- redirect
- rendered state
- state transition
- storage write
- storage read
- emitted job
- external call
- notification or audit record

Evidence must be visible from outside the code under test.
Internal function calls are not enough.

### Traceability

Every obligation must be traceable:

- back to the runtime source that produced it
- forward to the tests that prove it
- back again when code changes affect the source

This package treats traceability drift as a first-class failure because unmanaged drift is how false confidence accumulates.

## Operational consequence

To enforce those properties, the package manages five connected artifacts:

- `runtime-discovery-policy.json`
- `runtime-inventory.json`
- `runtime-surfaces.json`
- `runtime-control-plane.json`
- `fidelity-policy.json`

These artifacts let teams govern:

- what the runtime denominator is
- how it is partitioned into operable surfaces
- which obligations close those surfaces
- what evidence proves each obligation
- what minimum proof strength is acceptable

## Why discovered and reviewed both exist

A reviewed model alone is not enough.
A team can accidentally narrow the denominator by omission and still keep the declared model clean.

Discovery alone is not enough either.
Heuristics are useful, but raw scanner output is not an operating model.

That is why this package keeps both:

- `discovered runtime candidates`
- `reviewed runtime model`

The validator compares them so the team cannot silently drift into a smaller runtime denominator than the product actually has.

That is also why repo-local policy exists.
The core model is universal, but runtime discovery must remain teachable by each repository.
