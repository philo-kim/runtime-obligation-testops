# AGENTS

This repository uses a runtime-obligation-first TestOps control system.

Before changing tests or behavior:

1. identify the runtime source that changed
2. update inventory or surfaces if the runtime denominator changed
3. update or add the matching runtime obligation
4. connect observable evidence to owner tests
5. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
