#97 technical implementation verified; production delivery next

Approvedv2 email+manual, Owner-requested reminders only. Separate unansweredv1
question0dd7a18c (provider/From/pilot) still blocks real email activation; no SMTP
credentials, provider account or DNS changes. Production config checked09:30:
mailDisabledtrue, noSMTPHost/credential/encryptionkey, only booleans emitted.

0030 encrypted outbox/AES-GCM independentkey, generation-bound payloads, leases
and3attempt max/retry30s120s, stableMessageID, rate20/h/space+60s/invite, safe
errorcodes and purge. Revocation/rotation rollback and conditional completion
prevent stale grants/resurrection. SMTP at-least-once caveat documented; accepted
bySMTP is not inbox delivery. Revalidates canonicalOwner inside transactions.
UI search/state/delivery filters, manualcopy fallback, renewal confirmation,
disabledemail explanation, private-list clearing and retry. No-store API/errors.
Config/Compose defaultsdisabled, no automatic reminders or old-invite enqueue.

Final pnpm validatePASS15Sep:167unit/web111integration36webE2E+2expectedskips,
Chrome16unit13E2E/reproducible0.6.3, scan408. Full ComposePASS afterenvwiring.
Only intermediate failures were Biome multi-pass formatting, Testing Library
unsupported exact option and ambiguous browser text locator (filter option vs
actual row); fixed at test locator, repeated complete gatespassed. UI inspected
from mobile screenshot; real nativecreate/rotate/revoke works with synthetic data.
API tests: authorization/CSRF/no-store/invalidbody/queue capability. Fake transport
tests encrypt/purge/rotation/revocation/in-flightcancel/retry/crash/keytamper/rates.
No actual mail send or Google pilot claimed. Existing esbuildmoderate devserver
advisory through pre-existingdependencies recorded separately; no new advisory.

Backup .local/backups/epic3-invitations-20260915/issopen-rHAVAe complete and restored
in isolatedPG18.6networknone:113issues1011events13images matchingbytes/SHA256,
19receipts. Private copies stay ignored. Source exact archive/image/GitOps and
postdeploysafe smoke next.107 matrix records external97/98 gates and Storeseparation.
