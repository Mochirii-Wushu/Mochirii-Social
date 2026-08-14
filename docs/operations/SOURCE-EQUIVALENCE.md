# Source equivalence

The incumbent source identity is fixed:

- Website commit: `ef5675575aeea6cb41def256d0a889f60f963ff8`
- Website `services/social` tree:
  `d34a61164a37a5b9c476120b03058e6a9836fc58`
- file count: 2,630

`incumbent-website-social.sha256` and `imported-social.sha256` are sorted
manifests of SHA-256 hashes over canonical Git blob bytes. Each line also
records the Git mode and path relative to `services/social`. They deliberately
do not hash Windows worktree bytes, so CRLF checkout settings cannot create
false drift.

`source-equivalence.v1.json` is the only transition allowlist. Every
non-allowlisted blob and every Git mode must match the incumbent exactly.
Files may not be added or removed inside `services/social`. The checker also
requires the actual differing paths to equal the allowlist, preventing unused
exceptions.

Regenerate the manifests only from a clean reviewed Website clone containing
the exact pinned commit:

```sh
node scripts/generate-source-equivalence-manifests.mjs \
  --source-repository /path/to/clean/Mochirii-Website \
  --write
npm run check:source-equivalence
```

The generator reads immutable Git objects and the Social candidate index. It
does not inspect runtime configuration, credentials, production data, media,
or provider state.

## Generated frontend parity

The incumbent release was created before the Website repository required LF
checkouts for tracked Vue and SCSS inputs. Its committed production assets were
built from the exact Git blobs above using the then-current Windows checkout
semantics: the 228 tracked `*.vue` and `*.scss` inputs used CRLF, while the
already-pinned JavaScript and CSS inputs remained LF. The generated vendor
license was normalized by removing trailing horizontal whitespace.

`scripts/verify-incumbent-frontend-assets.mjs` recreates only those historical
checkout semantics in one disposable application, installs its exact lockfile
offline into a physical local `node_modules`, and runs two independently
reseeded production builds. Each round byte-compares the complete generated
public-file inventory with the committed incumbent assets and verifies that no
non-public tracked byte changed. It never writes to or restores the canonical
`services/social` tree. This preserves the exact incumbent application while
making the repository transition reproducible on Linux and Windows.
