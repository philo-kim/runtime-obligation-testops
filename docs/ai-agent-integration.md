# AI Agent Integration

An AI agent should treat this system as executable runtime behavior completeness, not as optional documentation.

The agent's job is not to maximize coverage quickly.
The agent's job is to keep the runtime denominator, reviewed behaviors, implemented behavior units, evidence, and owner tests aligned after each change.

This is not a manual-modeling workflow where a human has to author everything by hand.
The intended operating model is:

- discovery proposes
- repo-local policy interprets
- AI performs most updates
- review approves semantic meaning
- CI enforces the gate

## Read order

Before changing runtime behavior, the agent should read:

1. `runtime-discovery-policy.json`
2. `runtime-inventory.json`
3. `runtime-surfaces.json`
4. `runtime-control-plane.json`
5. `fidelity-policy.json`
6. `runtime-quality-policy.json`
7. `runtime-self-check-policy.json` if the repo uses self-check
8. `runtime-retrospective.json` if the repo records escaped misses
9. `runtime-agent-contract.json` if the repo exports it
10. `AGENTS.md`

## Mandatory agent loop

For every runtime change:

1. identify the changed runtime source
2. run `rotops impact` if the blast radius is unclear
3. compare the change against discovered runtime candidates
4. run `rotops doctor` so the installed package and runtime artifacts are known-good before trusting completeness output
5. run `rotops review` when candidate drift may have changed
6. review repo-local policy if discovery is too noisy or too blind for that runtime slice
7. run `rotops self-check` to question whether the reviewed model has become too implicit or too broad
8. check whether the reviewed model is still granular enough under the quality policy
9. determine whether the reviewed denominator changed
10. determine which surface owns the change
11. update or add reviewed behaviors or implemented behavior units
12. update owner tests and `runtime-behaviors` annotations
13. if a real miss escaped, record it in `runtime-retrospective.json` and rerun `rotops retro`
14. rerun `rotops validate`

If discovery finds a candidate the reviewed model does not account for, the agent must not hide it by editing tests alone.
The agent must either:

- accept it into the reviewed model
- suppress it with an explicit repo-local reason
- or keep discovery in advisory mode until the repo-local policy is ready

## What agents must never do

- treat line coverage as the main sufficiency signal
- add tests that own no reviewed behavior
- edit inventory to hide discovery drift
- change runtime behavior without updating reviewed behaviors or behavior units
- claim a proof is complete when the evidence is not externally observable

## The core review question

An agent should always be able to answer:

`for the changed runtime source, what did discovery find, what does the reviewed model accept, which reviewed behaviors changed, which behavior units implement them, what evidence proves them, and which tests own that proof?`

## Why this matters for agents

Without this system, agents can easily:

- optimize for easy coverage
- add low-value tests
- miss runtime denominator drift
- confuse local implementation detail with runtime proof

With this system, the agent has a concrete control loop instead of a vague testing heuristic.

That is why the package ships both machine-readable policy files and human-readable operating guidance.

## Reviewed decision does not mean manual bookkeeping

When the package says a reviewed decision is required, it does not mean a human has to manually maintain every artifact.

It means the repo still needs semantic approval on one of these questions:

- should this discovered candidate become part of the managed denominator
- is this suppression legitimate
- is this behavior unit too coarse
- is this evidence sufficient
- is this fidelity level strong enough
- did a real miss escape badly enough that it must become retrospective hardening instead of a one-off fix

Everything else should usually be prepared by AI and policy before review happens.

## Machine-readable agent contract

The package can export a machine-readable contract:

```bash
npx rotops export agent-contract
```

Use it when:

- multiple AI agents operate in the same repo
- local wrappers hide non-default artifact paths
- CI needs a stable artifact that describes the enforced loop

If the repo wraps `rotops` behind project-local scripts, export the contract with command overrides so the agent sees the real operating commands instead of generic defaults.

The exported contract is not a replacement for the reviewed model.
It is a generated operational summary of it.
