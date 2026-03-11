# AI Agent Integration

An AI agent should treat this system as executable runtime governance, not as optional documentation.

The agent's job is not to maximize coverage quickly.
The agent's job is to keep the runtime denominator, obligations, evidence, and owner tests aligned after each change.

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
3. review repo-local policy if discovery is too noisy or too blind for that runtime slice
4. determine whether the reviewed denominator changed
5. determine which surface owns the change
6. update or add obligations
7. update owner tests and `runtime-obligations` annotations
8. run `rotops impact` if the blast radius is unclear
9. run `rotops validate`

If discovery finds a candidate the reviewed model does not account for, the agent must not hide it by editing tests alone.
The agent must either:

- accept it into the reviewed model
- suppress it with an explicit repo-local reason
- or keep discovery in advisory mode until the repo-local policy is ready

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

That is why the package ships both machine-readable policy files and human-readable operating guidance.
