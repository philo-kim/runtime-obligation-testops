# AGENTS

This repository uses a runtime-obligation-first TestOps control system.

Before changing tests or behavior:

1. identify the runtime source that changed
2. run `rotops impact` if the blast radius is unclear
3. review whether discovery now finds a new runtime candidate
4. run `rotops review` when denominator drift may have changed
5. review repo-local discovery policy if the scanner is too noisy or too blind
6. update inventory or surfaces if the runtime denominator changed
7. update or add the matching runtime obligation
8. connect observable evidence to owner tests
9. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
