# Fediverse Activation Runbook

Last refreshed: 2026-07-07

Mochirii Social starts as an internal guild social platform. Federation is
disabled until a separate global fediverse hub approval packet is accepted.

## Source Basis

- W3C ActivityPub Recommendation: https://www.w3.org/TR/activitypub/
- Mochirii Social sync boundary: `docs/mochirii-social-sync.md`
- Upstream sync and deployment guardrails: `docs/upstream-sync-policy.md`

## Current Gate

- ActivityPub federation remains disabled.
- Closed registration remains enabled.
- SSO remains the only login path.
- 2026-07-07 runtime readback confirmed `activitypub_enabled: false`.
- No federation, config, DNS, cache, queue, or runtime mutation is approved by
  this runbook.
- Moderation and admin roles must be tested before remote interaction.
- The moderation, report, deletion, defederation, and blocklist flows must be
  documented before activation.

## Approval Packet

Before enabling federation, prepare an approval packet covering:

- Server rules and member-facing privacy copy.
- Deletion-copy warning: remote servers may keep delivered content.
- Moderation roles, escalation, and report/takedown flow.
- Block, mute, and account suspension behavior.
- Defederation and blocklist policy.
- Backup and restore proof.
- Queue and scheduler health.
- WebFinger and NodeInfo public metadata review.
- Allowlisted remote delivery trial before broad federation.
- Rollback steps to disable federation again.

The approval packet must name the exact runtime setting change, operator,
rollback owner, test account(s), allowlisted remote instance(s), backup proof,
and rollback command/window. Do not combine federation enablement with media
pipeline changes, Cloudflare changes, SSO changes, registration changes, or
runtime upgrades.

## Approval Prompt

```text
Approve enabling ActivityPub federation for social.mochirii.com only after the documented moderation roles, report/takedown flow, blocklist/defederation policy, deletion-copy warning, backup/restore proof, WebFinger/NodeInfo review, allowlisted remote-delivery smoke, and rollback window are complete. Do not change registration, SSO, Cloudflare, DNS, media storage, OAuth, or unrelated Pixelfed runtime settings in the same action. Rollback: disable ActivityPub federation again, clear/rebuild Laravel config cache if required, restart only required Pixelfed services, and verify WebFinger/NodeInfo plus remote delivery no longer expose broad federation behavior.
```

## Test Matrix

Run these only after approval:

1. WebFinger discovery.
2. NodeInfo discovery.
3. Local-to-remote follow.
4. Remote-to-local follow.
5. Local post delivery.
6. Remote post delivery.
7. Delete delivery behavior.
8. Remote copy/deletion warning review with member-facing copy visible.
9. Report, block, mute, and defederation smoke tests.
10. Rollback dry-run or documented rollback operator rehearsal.

ActivityPub is decentralized server-to-server content delivery. Public
federation may expose expected federation protocol metadata and upstream
software compatibility details. If Mochirii requires zero public upstream
software names even after federation, decide on that compatibility tradeoff
before approving this milestone.
