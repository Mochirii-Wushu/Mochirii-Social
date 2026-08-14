# Mochirii Social governance seed guidance

This standalone working tree is a history-clean, source-only proposal for the
one-time initialization of `Mochirii-Wushu/Mochirii-Social`. It contains no
runnable Pixelfed service, deployment configuration, provider binding,
credential, member data, package, image, or production authority.

## Required workflow

- Begin with `git status --short --branch` and preserve every existing change.
- The exact reviewed root tree may be committed and first-pushed to an empty
  `main` only after a separate, target-specific bootstrap authorization. This
  file grants no such authority.
- After that single bootstrap exception, every change uses a focused branch,
  exact-head CI, accountable review, and the normal protected merge path.
- Run `npm ci --ignore-scripts`, `npm run check`, and
  `npm run check:remotes` before handoff.
- Use `node scripts/configure-remotes.mjs --apply` only in the intended clone;
  it changes clone-local Git configuration and never fetches or pushes.

## Hard boundaries

- Keep this seed governance-only. Do not add application source, generated
  assets, containers, runtime configuration, hostnames beyond documented
  scope, provider settings, secrets, databases, media, backups, or archives.
- Preserve the exact GNU AGPLv3 license and official Pixelfed attribution.
  Production activation still requires qualified legal review and an exact
  digest-bound Corresponding Source offer; a private repository is not that
  offer.
- Keep registration closed and ActivityPub disabled in every later source
  integration unless a separate product and security approval changes them.
- `origin` is canonical Mochirii source. `upstream` is official Pixelfed and
  must remain fetch-only with the inert push sentinel. Never push upstream.
- Do not guess a CODEOWNERS identity or GitHub plan. Both remain explicit
  blockers until an existing organization team and private-capable plan are
  approved and verified.
- All candidate publication, source cutover, ruleset, provider, runtime, legal,
  and deployment booleans remain false. Passing source checks does not change
  those gates.
- Never commit credentials, environment values, private evidence, user data,
  local paths, or recovery material. Production must never depend on a
  workstation.

## Safe integration topology

The approved sequence is: independently review this no-parent seed; create one
root commit; first-push it to empty `main` only under exact approval; verify
remote readback and CI; establish the separately approved protected-main
capability; then apply the independently reviewed full Social candidate as one
child commit whose final tree preserves the accepted source tree plus only the
reviewed governance delta. Do not rewrite or push the rejected predecessor
ancestry.
