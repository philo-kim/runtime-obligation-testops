# Bootstrap Maturity

Not every part of `runtime-obligation-testops` matures at the same speed in every stack.

That is normal.

The package is designed so teams can adopt the universal control system first, then tighten discovery later.

## The maturity ladder

### 1. Reviewed-model only

You hand-author:

- `runtime-inventory.json`
- `runtime-surfaces.json`
- `runtime-control-plane.json`
- `fidelity-policy.json`
- `runtime-quality-policy.json`

and use:

- `rotops validate`
- `rotops impact`

This is already useful.
It gives you runtime traceability and behavior-unit ownership even before discovery is trusted.
AI agents can still operate effectively here because `impact`, `validate`, and the reviewed model are already machine-readable.

### 2. Advisory discovery

You add:

- `runtime-discovery-policy.json`
- `rotops inventory scan`
- `rotops review`

with `candidateReviewMode: "warning"`.

Discovery now challenges the reviewed model without breaking CI.

This is the right stage when:

- the repo is large
- vendor or generated paths are noisy
- discovery heuristics need tuning
- the runtime denominator is still being actively mapped

In this stage it is often correct to narrow `scopePatterns` to one managed slice instead of pretending the whole repo is already review-ready.

### 3. Enforced completeness

You move to `candidateReviewMode: "error"`.

At this point, discovered-vs-reviewed drift becomes a merge gate.

This is appropriate when:

- ignore patterns are stable
- major false positives are suppressed or overridden
- teams trust discovery enough to use it as a denominator guardrail

## What is usually portable first

These parts tend to work across stacks first:

- reviewed runtime model
- behavior-unit ownership
- annotation traceability
- fidelity governance
- reviewed-model quality governance
- impact analysis

## What usually needs local shaping

These parts vary most by repo:

- discovery file universe
- UI/state heuristics
- workflow heuristics
- external adapter heuristics
- generated/vendor ignore rules

That is why the package exposes repo-local policy instead of trying to hide every detection rule behind one universal heuristic.

## Practical recommendation

For a new repo:

1. start with one important runtime slice
2. make `validate` and `impact` trustworthy
3. keep discovery advisory
4. tighten policy
5. only then switch completeness drift to `error`

This is the safe path to completeness.
