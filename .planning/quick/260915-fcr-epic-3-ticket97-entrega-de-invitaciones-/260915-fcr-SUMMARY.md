#97 technical delivered; real email activation blocked

Source3747d7421d3fff21fe508d53a8aa0db255cf0ea1, GitOps06a3d26268679dc5964e4fd1f5f108dcccdaa880,
imageinvitations-3747d74@sha256:135f94309c57d75edd566ccda77ab5bd63fc96caa3dcec8e8cfb23a3d8c181ff.
15Sep09:39 observedHealthy/Synced exactrevision/Ready1/1 zero restarts/readinessJSONok,
PVCidentitiesunchanged. Production newreviewerMember smoke1440/360PASS, members+
audit403/no-store, protectedimages/foreign404 and ownnewsessionrevocation/clearing;
existing humans/Store sessions/grants/tickets untouched. Isolatedbrowsernamespace
avoids unrelated n8nnetworkrestarts. DBmetadata0030exists/mailJobs0, envdisabled
withoutcredentials/key; queueWarnings0. No real mail sent. Commitlinks in97/107.
Final post-summary secret scan409PASS. Below preserves predeployment checkpoint.

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
