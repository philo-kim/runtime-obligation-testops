# AGENTS

This repository uses a runtime-obligation-first TestOps control plane.

Before changing tests or behavior:

1. identify the runtime source that changed
2. update or add the matching runtime obligation
3. connect observable evidence to owner tests
4. run `rotops validate`

Do not ship runtime changes that are not reflected in the control plane.
