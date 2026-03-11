# Why This Exists

This project did not start as a generic testing framework exercise.
It started from a real product problem.

The source product had:

- many automated tests
- high line coverage
- passing CI
- familiar labels like `unit`, `integration`, and `component`

and still could not answer a basic operational question:

`what runtime behavior is actually governed by automation, and what is still outside the managed denominator?`

That gap is what this package exists to close.

## The failure mode

The failure mode was not "there are too few tests."
The failure mode was more structural:

- the repo could count tests
- the repo could report coverage
- the repo could organize tests by runner or folder
- but the repo could not prove that the full runtime denominator was actually being managed

In practice that led to a dangerous state:

- a project can look clean
- a control plane can look internally consistent
- coverage can read `100%`
- and a real runtime layer can still be missing from the governed model

This package was extracted from that exact situation.

## What was missing

Traditional test organization is good at describing implementation structure.
It is weaker at governing runtime scope.

For example, labels like:

- `unit`
- `integration`
- `component`
- `e2e`

can tell you how a test is written, but not:

- what runtime event created the need for the test
- which real outcomes were considered
- what evidence is supposed to be observable
- which runtime surface owns the proof
- whether the denominator itself was silently narrowed

That is why the goal here is not better classification.
The goal is to make the runtime denominator itself a governed object.

## The core idea

This package treats automated testing as a runtime governance problem.

The managed object is not:

- the test file tree
- the runner
- the coverage percentage

The managed object is:

- the discovered runtime candidate set
- the reviewed runtime denominator
- the surfaces used to operate that denominator
- the obligations that close it
- the evidence that proves those obligations
- the tests that own that proof

## Why discovered vs reviewed matters

This package keeps two layers on purpose:

- `discovered runtime candidates`
- `reviewed runtime model`

That split exists because both extremes fail:

- if you trust only the reviewed model, a team can forget to register part of the runtime
- if you trust only discovery, you get a noisy scanner instead of a usable operating system

The control system is the reconciliation between those two.

## What this package is for

Use this package when you want a project to answer:

- what the actual runtime denominator is
- which runtime surfaces exist in this project
- which obligations govern each surface
- what evidence proves each obligation
- which tests own that proof
- which proof is weaker than policy allows
- whether discovery and review have drifted apart

That is useful for:

- product teams trying to make automation coverage honest
- platform teams standardizing TestOps across repos
- AI agents that need a concrete source of truth before changing tests

## What this package is not for

This package does not replace:

- a test runner
- a mocking strategy
- real-dependency tests
- full-system tests
- browser tests
- manual verification

Those layers are still necessary.

The purpose of this package is different:
it governs the automated proof graph around those layers so teams do not use broad labels or coverage numbers as a substitute for runtime understanding.

## Why AppPulse is included

The AppPulse example exists because this package came from a real product, not from a blank template.

That example shows:

- how a runtime denominator is reviewed
- how project-specific surfaces are derived
- how obligations are attached to evidence and owner tests
- how discovery is used to expose missing runtime layers

It is a concrete case study of the original problem and the system extracted from solving it.
