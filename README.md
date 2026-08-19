# Reroll Verifier

Public source for the versioned Reroll game engine and its standalone browser
verifier.

[Open the verifier](https://reroll-com.github.io/verifier/)

## What is published

- [`src/versions.ts`](src/versions.ts) defines immutable historical game versions.
- [`src/registry.ts`](src/registry.ts) validates and resolves registered versions.
- [`src/engine.ts`](src/engine.ts) derives exact integer multiplier outcomes.
- [`src/verify.ts`](src/verify.ts) reproduces a roll and its derivation proof.
- [`src/browser.ts`](src/browser.ts) supplies the browser WebCrypto adapter.
- [`src/server.ts`](src/server.ts) supplies the Node crypto adapter.
- [`verifier/App.tsx`](verifier/App.tsx) is the static verifier interface.

The verifier performs its calculation in the browser. It does not submit seed
values to a verification API.

## Verify locally

Install [Bun 1.3.14](https://bun.sh/) and run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run verifier:build
bun run verifier:preview
```

The fixed vectors in [`src/__test__/game.unit.test.ts`](src/__test__/game.unit.test.ts)
protect the historical behavior of every registered version.

## Repository status

This repository is an automatically generated publication of the verifier
source. Its commits are produced by the Reroll verifier sync app so private
development history and personal commit attribution are not copied here.

The package is marked private to prevent accidental registry publication. It
is intended to be inspected, built, and run directly from this repository.
