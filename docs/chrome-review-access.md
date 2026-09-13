# Chrome Web Store review access

Ticket 86: the owner explicitly approved a dedicated local Member account on
2026-09-13. This is an operator-only exception for review, not public signup or
a Google identity. It is deliberately labelled Chrome Web Store Reviewer;
its email is a login identifier, not a verified mailbox.

## Provision and verify

`scripts/store-reviewer.ts` creates a fresh project **Google Review Demo**,
key CWSREVIEW, one Epic and two synthetic tickets in the existing workspace.
Only that project is assigned to the fresh Member. Creation is transactional,
uses the tracker domain and records an explicit membership provisioning audit
event. No real project or agent permissions are copied. Existing identities
are never adopted; an exact repeat is a checked no-op and cannot reactivate a
revoked account or change its password/grants.

1. Confirm the exact workspace and owner IDs and operator approval. Run the
   auth integration tests before production provisioning.
2. Create an ignored `.local/secrets` directory with mode 0700. Set
   `ISSOPEN_REVIEW_WORKSPACE_ID`, `ISSOPEN_REVIEW_OWNER_ID` and
   `ISSOPEN_REVIEW_EMAIL` to the approved identity/target, then run:

   ```bash
   pnpm exec tsx scripts/store-reviewer.ts prepare .local/secrets/chrome-review.json
   ```

   This creates an exclusive 0600 file, with a random 256-bit password and a
   stable reviewer ID, before any database mutation. Do not print its contents.
3. With the normal application configuration supplied privately, run:

   ```bash
   pnpm exec tsx scripts/store-reviewer.ts provision .local/secrets/chrome-review.json
   ```

   For production use the authorized master and an SSH loopback-only database
   tunnel. Capture the database connection setting in process memory, never
   terminal output, command arguments or source. This is administrative data
   provisioning, not a schema change or runtime deployment. Snapshot PostgreSQL
   before the operation; do not restore over live data as routine rollback.
4. In a clean browser, sign in with the review credential, verify exactly one
   project, test direct denial of real project/issue URLs and administration,
   then create a synthetic ticket. Test Chrome linking and image submission.
5. Put the login and password **only** into the private Test instructions tab
   of the exact Chrome Web Store item, not its public description, ticket
   comments or Git. Keep the protected file for recovery.

## Reviewer instructions (no credentials in this document)

The review account uses email/password at
`https://issopen.serviciosegado.com/sign-in`; do not choose Continue with
Google. No Google account, invitation, payment or 2FA is required for this
dedicated account. Normal invited users can still use Google sign-in.

Install the submitted extension, open its side panel, choose Connect to
Issopen and complete the web sign-in/consent flow. It uses standard Issopen
OAuth PKCE, including for this local review account. Select Google Review Demo
and its Try Issopen for Chrome Epic. Enter a title/description, paste or upload
a harmless image, review it and send. Open the returned ticket in the web app;
check its image, comments and status. You may create another Epic in the demo
project. Project creation and administration are Owner-only and intentionally
unavailable to this Member. No real customer data is included.

Images are not automatically captured from the page. They stay local until
Send ticket. Maximum five PNG/JPEG/WebP images, 8 MiB combined. Disconnect the
installation from Account after testing. Support: serviciosegado@gmail.com.

## Lifetime, revocation and rollback

Keep this account available while Google reviews the item, including any
follow-up. **There is no automatic account-expiry scheduler.** Ordinary web
sessions and installation tokens retain their existing lifetimes; the operator
must explicitly revoke the reviewer when access is no longer needed.

The Owner can immediately remove the Member in `/members`. This revokes web
sessions, access/refresh tokens and OAuth clients and removes project grants.
The operator can additionally remove its password credential using:

```bash
pnpm exec tsx scripts/store-reviewer.ts revoke .local/secrets/chrome-review.json
```

The command checks the recorded reviewer marker and exact ownership, reuses
membership revocation and removes only this identity's local credential.
Existing Owner/Member accounts and real data remain unchanged. Audit, demo
tickets and attribution are retained; do not delete users or overwrite the DB.
Remove/update the private Store credentials when revoking or replacing access.

Google reference: [private test instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions).

## Observed delivery — 2026-09-13

- Project: `6c6deef8-fdd8-408a-bc93-d798ad94555d` (Google Review Demo).
- Reviewer: `573ce1a4-3b9f-400b-b15b-5e7f5617222c`; login credential is only in
  `.local/secrets/chrome-review.json` (0600) and the private Google form.
- Two seeded issues plus a third live Chrome smoke issue with one synthetic
  PNG: `b3753449-756d-4698-8e7d-6b72fc4ab060`.
- Production login, exact single-project list, private project/issue/evidence
  404 and admin 403 passed. The exact uploaded 0.6.2 ZIP completed real Member
  PKCE/consent, ticket creation and image read in a fresh Chromium profile.
- Test installations were disconnected/revoked; old test sessions revoked and
  the last session signed out. Reviewer membership/password remain active.
- Google item `eohpecaogeelnicbpeedjdganacfknok` > Test instructions displays
  the saved-on-13-September confirmation after reload. Subsequently submitted
  with explicit owner authorization at 19:24 UTC: Pending review, Unlisted,
  automatic publication disabled. Not approved/published yet.
- 94 unit/web tests, 66 integration tests, lint, typecheck, build and secret
  scan passed. No runtime or GitOps changes required for operator provisioning.

## Resolved follow-up decision — 2026-09-13

At 19:35 UTC the human answer in ticket 86 selected a dedicated Google test
identity instead of this local account. The explicit clarification was answered
at 20:21:42 UTC: **keep the current review access**. Question
`bc1536c9-4c81-4f84-8b7c-f0803036e26c` v2 selects option
`f1eeab0f-4cc9-4466-8244-36ce60a4c832`. Both questions are answered; no pending
question blocks ticket 86. Keep both answers and their audit history intact.

The working local Member, project allowlist and private Google instructions
remain unchanged for this submission. No Google test identity was created or
requested from the publisher account. Google sign-in for normal invited users
is unchanged and the Google pilot remains a separate gate in ticket 87.

The publisher's Store dashboard was rechecked at 20:23 UTC: the exact item is
still **Pending review**. Existing reviewer login and its one-project access
were rechecked in an isolated session; foreign reads/admin denied, desktop and
mobile detail/image correct. Only that smoke session was signed out. No tickets,
reviewer credentials, grants or existing browser sessions were modified.
Approval/manual publication and real Store pilot/update remain external gates.
