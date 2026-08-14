# ADR 0001: History-clean governance bootstrap

- Status: Accepted for local source review only
- Date: 2026-08-12

## Context

The intended private Social repository is empty. The independently accepted
runtime/storage source tree is source-only, but its local 34-commit ancestry
contains historical boundary markers and must not be pushed. Rewriting that
ancestry is neither necessary nor authorized.

## Decision

Create a minimal governance-only tree in a standalone Git repository with no
parent commit. Its exact root tree is reviewed before any remote write. A
single root commit may initialize empty `main` only under a separate exact
approval. The later full Social candidate is introduced as one child commit,
preserving the accepted source tree plus only a separately reviewed governance
delta.

The seed contains a comment-only CODEOWNERS blocker because no real
organization team is approved. It records the private-capable GitHub plan and
protected-main ruleset as unresolved and false. It provides a cross-platform,
clone-local remote configurator and verifier: canonical Mochirii `origin`,
official Pixelfed `upstream`, one bounded `dev` fetch refspec, no automatic
tags, an inert upstream push URL, `origin` as push default, and fast-forward-
only pulls.

## Consequences

- The rejected predecessor ancestry is never pushed or rewritten.
- Passing checks proves a clean governance source boundary, not remote or
  production readiness.
- The first push, GitHub plan, repository rules, CODEOWNERS team, source child
  commit, package publication, and every provider or production action remain
  separately gated.
- The AGPL license and official upstream identity remain reviewable before any
  runnable source is introduced.
