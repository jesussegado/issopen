---
status: complete
source_commit: e05ff240ddfc08a5ea85d6e2840bd12759e86819
ticket: 86
---

# Google review access prepared

Owner-authorized operator exception: new local Member, new synthetic project,
one Epic, two seeded tickets. No public signup, schema, runtime or GitOps
changes; existing Google users and Owner credentials remain unchanged.

Provisioning/revocation is transactional and audited, rejects collisions and
invalid owners, cannot adopt an existing account or regrant a revoked user.
Credentials are generated exclusively into an ignored 0600 file and use the
existing Better Auth password hash in PostgreSQL. Runbook:
`docs/chrome-review-access.md`.

## Verification

- Lint, typecheck and production build passed.
- 94 unit/web tests and 66 integration tests passed, including two new
  integration cases for review provisioning, isolation, collision rollback,
  checked replay and revocation. Secret scan passed (285 files at source gate).
- Fresh PostgreSQL snapshot in ignored protected storage before provisioning.
- Live credential login and exact project allowlist passed. Real project,
  issue and evidence URLs: 404. Administration: 403.
- Exact uploaded ZIP 0.6.2 (SHA256
  `0e9c636c51407797e95697fa5cb1a8d679448d13775c7887161079f2e2fb177b`)
  loaded in a fresh Chromium profile. Real OAuth PKCE/Member consent completed,
  synthetic image ticket created and private image rendered in web.
- Initial smoke assumed automatic project selection; corrected the harness
  to select the actual combobox option. No product change was needed. Both
  test installations and old reviewer sessions were revoked/closed afterwards.
- Google private Test instructions saved and persisted after reload for item
  `eohpecaogeelnicbpeedjdganacfknok`, using serviciosegado@gmail.com.

## Boundaries and follow-up

The review account stays active until explicitly revoked; no automatic account
expiry is claimed. The Store item remains Draft, not submitted or published.
Ticket 86 stays In Progress with approval recorded in an MCP comment; no human
question answer was impersonated. Ticket 91 records existing Member UI showing
Owner-only actions/incorrect Owner label, while API denial remains enforced.

GSD used the installed legacy init helper because gsd-sdk is absent; executed
inline according to the Codex adapter. The operation and recovery path are now
documented instead of leaving an untraceable database modification.
