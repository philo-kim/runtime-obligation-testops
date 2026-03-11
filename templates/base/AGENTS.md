# AGENTS

This repository uses a runtime-obligation-first TestOps control system.

Before changing tests or behavior:

1. identify the runtime source that changed
2. review whether discovery now finds a new runtime candidate
3. update inventory or surfaces if the runtime denominator changed
4. update or add the matching runtime obligation
5. connect observable evidence to owner tests
6. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
