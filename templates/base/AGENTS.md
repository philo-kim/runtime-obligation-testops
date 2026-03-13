# AGENTS

This repository uses a runtime-obligation-first TestOps control system.

Operate it as:

- discovery proposes candidates
- repo-local policy shapes discovery
- AI performs most runtime-model maintenance
- review approves semantic decisions
- CI enforces the gate

Before changing tests or behavior:

1. identify the runtime source that changed
2. run `rotops impact` if the blast radius is unclear
3. review whether discovery now finds a new runtime candidate
4. run `rotops review` when denominator drift may have changed
5. run `rotops doctor` so stale installs or missing control artifacts do not fake a clean result
6. review repo-local discovery policy if the scanner is too noisy or too blind
7. run `rotops self-check` to question whether the reviewed model has become too implicit or too broad
8. update inventory or surfaces if the runtime denominator changed
9. update or add the matching reviewed runtime behavior or behavior unit
10. connect observable evidence to owner tests
11. if a real miss escaped, record it in `runtime-retrospective.json` and run `rotops retro`
12. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
