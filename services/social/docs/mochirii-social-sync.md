# Mochirii Social Sync

This private ops note documents the no-secret link between the Mochirii Social
runtime and the Mochirii website/Supabase project.

## Boundary

- The Pixelfed/Laravel runtime runs on the DigitalOcean Droplet for
  `social.mochirii.com`.
- Supabase remains the identity, membership, OAuth, and `social_accounts`
  authority.
- Pixelfed must never receive a Supabase service-role key.
- Pixelfed keeps only a narrow sync secret used to call the Supabase Edge
  Function after a successful OIDC callback.

## Runtime Env

Set these only in the host environment or local credential vault:

```env
MOCHIRII_SOCIAL_SYNC_URL=https://deyvmtncimmcinldjyqe.supabase.co/functions/v1/sync-pixelfed-social-account
MOCHIRII_SOCIAL_SYNC_SECRET=
MOCHIRII_SOCIAL_SYNC_TIMEOUT=5
```

After changing host env, clear Laravel config cache and restart app services
only if required by the current deployment shape.

## First Login Evidence

After admin OIDC login:

1. Pixelfed creates or links the local user.
2. `MochiriiSocialSyncService` POSTs the Supabase `sub`, local Pixelfed user id,
   username, profile URL, event, and timestamp to the sync function.
3. Supabase upserts one active `public.social_accounts` row with
   `provider = 'pixelfed'` and `federation_enabled = false`.
4. The website Account page can read the linked status through existing RLS.

If the sync fails, login should not expose secrets. Check private host logs for
HTTP status only, then verify the Supabase function secret and host env.

## Federation And Media

Keep ActivityPub federation disabled until a separate fediverse hub approval
packet passes moderation, privacy, defederation/blocklist, remote-delivery, and
rollback tests.

Move broad member media uploads to a dedicated DigitalOcean Space before member
rollout. The upload policy is large member uploads with hard safety caps, not
unlimited uploads. Use Pixelfed's resize/optimization path first, verify EXIF
stripping and thumbnails, keep Spaces credentials host-only, and use
exact-origin CORS for `https://social.mochirii.com`.
