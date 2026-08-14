# Upstream Sync Policy

The canonical repository keeps Mochirii Social under `services/social` while
reviewing the official upstream project for security and maintenance updates.
Upstream work is inspected in an isolated temporary clone and never receives a
Mochirii push.

## Remote Policy

- `origin` fetch and push points to
  `https://github.com/Mochirii-Wushu/Mochirii-Social.git`.
- The official upstream source is `https://github.com/pixelfed/pixelfed.git`.
- Do not add an upstream push URL to the canonical checkout.
- Record the reviewed upstream base in `SOURCE-SNAPSHOT.md`.

Use:

```sh
git clone --filter=blob:none https://github.com/pixelfed/pixelfed.git <ignored-temporary-directory>
git -C <ignored-temporary-directory> remote set-url --push origin DISABLED
```

## Update Flow

1. Start from a clean focused branch in the canonical repository.
2. Fetch the official source only in the ignored temporary clone.
3. Review upstream release notes, security notes, migrations, queue changes, and
   config changes before merging.
4. Export and review only the required upstream tree or commits; never import a
   second repository graph into the canonical history.
5. Reapply Mochirii theme, OIDC, sync, media, and federation posture changes as
   needed under `services/social`.
6. Run asset build, Laravel/PHP checks available for the host shape, and
   `npm run check:mochirii-ops`.
7. Deploy only after a rollback note and database/cache/queue impact note exist.

Do not commit secrets, host `.env` files, OAuth client secrets, database dumps,
Redis data, uploaded media, backups, cache files, host IP notes, or credential
digests. Do not push to upstream.

## Public Branding

Public root, login, error, manifest, and default mail surfaces should remain
Mochirii-branded. Private docs may refer to upstream project names only where
needed to explain source control, licensing, compatibility, and upgrades.
