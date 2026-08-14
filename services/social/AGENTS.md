# Mochirii Social Guidance

- This directory is the preserved application path inside the canonical
  `Mochirii-Wushu/Mochirii-Social` repository and owns the source and
  immutable image for `social.mochirii.com`.
- Preserve upstream license and attribution. Upstream names may remain in code,
  dependencies, compatibility notes, and license files, but not in rendered
  Mochirii member-facing copy.
- Keep registration closed and ActivityPub federation disabled.
- Never commit runtime `.env` files, OAuth keys, database/media/cache state,
  backups, host addresses, credentials, or generated archives.
- Run application commands from this directory and repository checks from two
  levels above. Use only the root repository workflows for image publication,
  deployment, recovery, and hosted verification.
- Production accepts only an immutable reviewed GHCR digest. Database
  migrations require a verified backup and explicit migration approval.
- Do not change DNS, Cloudflare, Spaces configuration, Droplet sizing, or
  federation as part of ordinary Social source work.
- The first repository cutover is source-equivalent and uses
  `migration_approval=NONE`. Do not change application behavior as part of the
  authority transfer.
