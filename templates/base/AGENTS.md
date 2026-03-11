# AGENTS

This repository uses a runtime-obligation-first TestOps control system.

Before changing tests or behavior:

1. identify the runtime source that changed
2. review whether discovery now finds a new runtime candidate
3. review repo-local discovery policy if the scanner is too noisy or too blind
4. update inventory or surfaces if the runtime denominator changed
5. update or add the matching runtime obligation
6. connect observable evidence to owner tests
7. rerun `rotops impact` if the blast radius is unclear
8. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
