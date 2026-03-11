# AI Agent Integration

An AI agent should treat this system as executable runtime governance, not as optional documentation.

## Read order

Before changing runtime behavior, the agent should read:

1. `runtime-discovery-policy.json`
2. `runtime-inventory.json`
3. `runtime-surfaces.json`
4. `runtime-control-plane.json`
5. `fidelity-policy.json`
6. `AGENTS.md`

## Mandatory agent loop

For every runtime change:

1. identify the changed runtime source
2. compare the change against discovered runtime candidates
3. determine whether the reviewed denominator changed
4. determine which surface owns the change
5. update or add obligations
6. update owner tests and `runtime-obligations` annotations
7. run `rotops impact` if the blast radius is unclear
8. run `rotops validate`

## What agents must never do

- treat line coverage as the main sufficiency signal
- add tests that own no obligation
- edit inventory to hide discovery drift
- change runtime behavior without updating obligations
- claim a proof is complete when the evidence is not externally observable

## The core review question

An agent should always be able to answer:

`for the changed runtime source, what did discovery find, what does the reviewed model accept, which obligations changed, what evidence proves them, and which tests own that proof?`

## Why this matters for agents

Without this system, agents can easily:

- optimize for easy coverage
- add low-value tests
- miss runtime denominator drift
- confuse local implementation detail with runtime proof

With this system, the agent has a concrete control loop instead of a vague testing heuristic.
