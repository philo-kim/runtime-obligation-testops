# AI Agent Integration

An AI agent should not treat this system as extra documentation.

It should treat it as the runtime source of truth for automated testing decisions.

## What the agent must read first

- `testops/runtime-control-plane.json`
- `testops/runtime-control-plane.schema.json`
- `AGENTS.md`

## What the agent must do on every runtime change

1. find the runtime source that changed
2. identify the affected surface
3. identify whether an obligation changed or a new obligation was introduced
4. update owner tests and annotations
5. run `rotops validate`

## What the agent must not do

- do not use file coverage as the main sufficiency signal
- do not add orphan tests
- do not leave runtime sources uncovered
- do not change runtime behavior without updating obligations

## Recommended review question for agents

`for the changed runtime sources, which obligations changed, what evidence proves them, and which tests now own that proof?`
