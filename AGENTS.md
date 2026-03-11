# AGENTS

This repository packages a `runtime-obligation-first` TestOps system.

The rule is simple:

`automated testing is managed against the full set of runtime obligations, not against code units or test labels`

When changing this repository:

1. Preserve the principle:
   - event completeness
   - outcome closure
   - observability
   - traceability
2. Keep discovery, inventory, surface, control-plane, and fidelity artifacts aligned.
3. Keep schemas and validators framework-agnostic. Runner-specific behavior belongs in adapters, and repo-local behavior belongs in policy files.
4. If templates change, update docs and tests in the same change.
5. If discovery policy semantics change, update the examples and adoption guidance in the same change.
6. If the CLI output changes, update the example files and the README.

Required commands before finishing:

- `npm test`
- `npm run build`
