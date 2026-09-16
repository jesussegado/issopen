# Invitation operations97

Approved: email plus manual one-time link; reminders only on explicit Owner
request. The seven-day token/Google claim/acceptance protocol is unchanged.
On 16Sep the Owner authorized reuse of Gremiox's Gmail SMTP configuration and
sender serviciosegado@gmail.com. Authentication with mandatory TLS passed without
sending a message. No SMTP account or DNS change is needed for this configuration.
Real receipt remains a [human pilot](google-pilot.md), not inferred from SMTP verify.
Activation and mobile disclosure fix were observed in production16Sep:
sourcef5dbbc4/GitOpsa3704a4a, digest65141db3, Synced/Healthy/Ready0restarts,
readinessJSONok and preserved PVCs. Live-secret SMTP verify and final public+
authenticated browser smoke1440/360 passed. No real message sent by the agent.

## Owner UI and API

Members has independent email/project search, invitation-state and email-state
filters. Refresh clears private lists on failure; existing manual link reveal,
copy, renewal and revocation stay available. Renewing requires confirmation and
invalidates the preceding link, even if its email was already in flight. Copy is
shown once and never reconstructed from hashes. GET/POST responses use no-store.

POST `/api/v1/invitations` accepts optional `delivery: manual | email` (default
manual). POST `/:id/resend` in that group accepts the same field; old empty-body
clients keep manual semantics. Unknown fields/bad JSON rejected. Email disabled
fails explicitly without writing an invitation. Neither endpoint changes the
recipient or grants of an existing invitation. Canonical Owner and membership
are rechecked inside the write transaction after locking the workspace; a stale
HTTP role snapshot cannot survive a concurrent ownership transfer.

Delivery states are queued/sending/sent/failed/cancelled, **not** the invitation's
pending/claimed/accepted/expired/revoked. Sent means SMTP accepted the recipient,
not inbox delivery. Copying a link is not sending email. The latest generation's
delivery metadata has no token/hash/ciphertext/provider errors. Member/other
workspace cannot enumerate addresses or delivery metadata.

## Durable queue and failure semantics

0030 creates invitation_delivery only; existing invitations are not enqueued.
Token encrypted with AES-256-GCM, random96-bit nonce, separate256-bit key, AAD
binding job/workspace/invitation/token hash. No bearer URL durable in plaintext.
One job per token generation, queued in the same transaction as invitation and
audit event. Limits:20 requested emails/hour/workspace and60s between email
renewals of one invitation. A denied renewal rolls back token rotation/cancellation.
Manual sharing remains available during mail failure or rate limiting.

Worker checks every10s, one concurrent run per process, SKIP LOCKED claims,
120s lease, persisted attempt before network, at most3 attempts,30s/120s retry
delay. Stable Message-ID reduces duplicate display but **SMTP is at least once**:
crash after acceptance before DB commit can yield a duplicate email. It cannot
create another invitation, recipient, permission grant or membership. Exhausted
crash leases become delivery_uncertain. Errors are fixed categories, never raw
provider responses. No periodic reminders or broadcast/marketing messages.

Before handoff recheck generation, expiry, claim, acceptance and revocation.
Rotation/revocation purge pending payloads transactionally. Cleanup also runs
while transport disabled; expiry/claim/acceptance purge at next sweep. Sent/final
failure/cancellation discard ciphertext. An already-transmitted old email cannot
be recalled, but its revoked/rotated link does not grant access. Conditional lease
completion never resurrects a cancelled job. Audit events reuse invitation history
with the initiating Owner's attribution; no duplicate business-event ledger.
Database outage pauses worker; process shutdown stops timer and drains active run.

## Operator configuration

Default `ISSOPEN_MAIL_TRANSPORT=disabled` (or absent). Production activation uses
the separate protected Secret `issopen-mail-env`; never overwrite `issopen-env`
or PostgreSQL/Google keys. GitOps references the exact mail keys. Values never
belong in Git/tickets/logs:

| Variable | Meaning |
| --- | --- |
| ISSOPEN_MAIL_TRANSPORT | smtp |
| ISSOPEN_SMTP_HOST / PORT | Authorized provider endpoint; default587 |
| ISSOPEN_SMTP_SECURE | true for implicitTLS (normally465); false for requiredSTARTTLS |
| ISSOPEN_SMTP_USER / PASSWORD | Provider credentials, supplied privately |
| ISSOPEN_MAIL_FROM | Verified single sender email authorized by Owner |
| ISSOPEN_MAIL_ENCRYPTION_KEY | Independent random32-byte key encoded as64hex; not auth secret |

Partial/invalid enabled configuration rejects startup with field names only.
The public privacy page 1.2 describes Google Gmail and invitation-email processing.
Deploy that disclosure with activation before the Owner requests any real send.
No Store resubmission or reviewer access changes. Current nonsecret settings:
smtp.gmail.com:587, required STARTTLS, user/From serviciosegado@gmail.com.
Reuse is temporary and shares provider quota and credential lifecycle with
Gremiox; never revoke/rotate that shared credential as an Issopen-only operation.
Prefer an independent provider credential in a later authorized change.
Recovery source: `.local/secrets/issopen-mail.env` in this source checkout,
ignored, mode0600, with an independent generated encryption key. The GitOps
`scripts/provision-production-secrets.sh --mail-only` accepts
`ISSOPEN_MAIL_SECRET_FILE` and creates only the absent mail Secret. It never
overwrites an existing Secret; rotate through a separately approved procedure.
The historical source copy of the bootstrap script is not the mail entrypoint.
Never turn off TLS verification. RequiredSTARTTLS/implicitTLS, bounded DNS/
connection/greeting/socket timeouts, no debug/logger or file/URL content access.
No HTML/project/ticket payloads or attachments are sent; constant plain-text
invitation and private URL only. Operator key loss/rotation makes pending jobs
fail closed and purge; renew links afterwards. Back up key separately from DB
under access control. Old backups may contain encrypted historical payloads and
must retain the existing private backup retention/access policy.

Dependency Nodemailer10.0.10 pinned with integrity, no runtime dependencies or
install lifecycle hooks; narrow exact-version release-age exception reviewed
15Sep for its multiline SMTP reply hardening. Existing transitive esbuild dev-
server advisory reported by pnpm audit is separate; no dev server is exposed by
production image. Do not claim an all-dependency audit is clean.
Primary references: [SMTP configuration](https://nodemailer.com/smtp),
[message policy](https://nodemailer.com/message),
[reviewed release](https://github.com/nodemailer/nodemailer/releases/tag/v10.0.10).

## Validation and rollout

Integration tests invitation-mail cover encryption/row binding, retries, crash
leases, concurrent workers, in-flight revoke, expiry/acceptance/rotation cleanup,
disabled mode, Owner transfer race, rate rollback, safe API DTO/CSRF. Unit adapter
tests assert TLS/privacy; transport is fake, **no real email delivery is claimed**.
Web tests check filtered queued states and confirmation; desktop/mobile browser
tests exercise real manual create/renew/revoke and stale403 clearing on synthetic
accounts. Full gates and isolated backup/restore precede immutable GitOps release.

Prefer forward fixes. Previous106 binary leaves new table intact but has no queue
worker. Before an intentional future rollback with mail enabled, disable sending,
drain/cancel pending jobs and preserve keys/history. Never downgrade permission or
multiworkspace migrations to undo the UI. No Store87/88 changes.
