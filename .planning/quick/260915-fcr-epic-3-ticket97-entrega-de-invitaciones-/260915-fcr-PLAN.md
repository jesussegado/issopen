---
type: quick
status: verified-local-releasing
ticket: 97
epic: 3
---

# 97 — invitation operations and disabled-by-default delivery

Live09:03: original answersv2 choose email+manual and reminders only on Owner
request. Provider/From/pilot question0dd7a18c remains unansweredv1. Implement local
and configurable technical pieces without configuring/enabling a production
provider or sending real mail. No passwords/tokens in tickets. Inline GSD.

1. Preserve seven-day invitation protocol and manual one-time reveal. Add distinct
   invitation-state and delivery-state/search controls. Revalidate canonical Owner
   in service transactions (inspection found create/resend/revoke rely only on
   earlier HTTP role check, unlike member edits; close that transfer race).
2. Minimal durable outbox with AES-256-GCM, separate operator-configured key,
   bounded retries/lease recovery, stable message ID, sanitized errors and
   expiry/revocation/rotation purge. Queue only on explicit Owner email action,
   never periodic reminders. Provider acceptance is not proof of inbox delivery;
   SMTP cannot promise exactly-once after uncertain responses. Never duplicate
   invitation/grants/recipient on retry. Rate limits and current token validity.
3. Standard SMTP adapter via pinned maintained Nodemailer, provider not selected
   by source code. TLS/STARTTLS required, no logger/debug/file/URL attachment
   access, bounded timeouts. Mail disabled by default and invalid partial config
   rejected without secret values. Production config/DNS/real-send await question.
4. Disposable fake/local transport tests: outage/retry/crash/duplicate, stale
   links, revoke, expiry, encryption/plaintext absence, authorization, limits,
   UI labels/keyboard/mobile. Full gates/backuprestore/immutable GitOps + readonly
   smoke. Keep97 warning/InProgress for actual provider pilot after technical
   delivery;107 tracks combined acceptance separately from Store87/88.

Official transport/message docs inspected15Sep:
https://nodemailer.com/smtp and https://nodemailer.com/message.
Registry15Sep: nodemailer10.0.10, @types/nodemailer8.0.1 (confirm compatibility).
