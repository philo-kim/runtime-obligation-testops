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
2. Keep the control-plane schema generic. Do not hardcode one framework unless it is explicitly inside an adapter.
3. Keep validators framework-agnostic. Runner-specific behavior belongs in adapters.
4. If templates change, update docs and tests in the same change.
5. If the CLI output changes, update the example files and the README.

Required commands before finishing:

- `npm test`
- `npm run build`
