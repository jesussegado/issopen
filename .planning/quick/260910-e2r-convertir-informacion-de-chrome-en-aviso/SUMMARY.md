# Chrome 0.5.1 — dismissible information and permanent Account help

Owner request on the historical 0.4.3 screenshot applied to current 0.5 flow.
Ticket 52 `327e0b54-0f31-4cec-990f-95a4d26795b2`, Epic Chrome 1.
Release/source `dbfc597009e7770cfd7024e66646386bd27d8c16`, pushed origin/main.

## Implementation

Information.tsx shares identical help between a closable introductory notice
and Account → Ayuda e información, including disconnected state. Local boolean
`issopen-information-dismissed-v1` remembers dismissal and syncs extension
views. No account/draft storage read/writes; no new permissions or OS notification.
Closing returns focus to Account. Failed preference storage allows closing for
the current view with an honest persistence warning; help is always accessible.

Generic privacy/draft notes consolidated here, removed their repeated blocks
from Images/composer/footer. Operational errors and file limits remain visible.
No timer, automatic dismissal, OAuth, schema/API or image-handling change.

## Validation

Clean release gate: 215 tests PASS (78 unit/web, 46 PostgreSQL integration,
8 web/OAuth E2E, 76 extension unit, 7 extension E2E); two expected desktop-only
skips on mobile. Lint, TypeScript, deterministic builds and secret scan PASS.
E2E covers 320/400 px notice/help, keyboard/focus, dismissal across views and
reload, retained image/title draft, help while disconnected, storage failure.
Existing account/composer, real native action, clipboard, OAuth and private
two-image retry E2E passed. Only synthetic fixtures in automated browser tests.

ZIP `extensions/chrome/.output/releases/issopen-chrome-0.5.1-dbfc597009e7.zip`;
SHA-256 `595013877560bf67b49194d0a5ded1c707d9e8570037d42cbc63d81781485318`.
sha256sum/unzip verified, 8 generated files, two builds byte-identical.
Homelab make validate: 197 PASS; workspace 31 repos valid.
Ansible/Helm absent, checks omitted; neither layer changed. Unrelated dirty
watchdog/network work preserved.

## Managed Chrome verification

Chrome 152 updated in the existing test profile /tmp/issopen-chrome-04-76r5Lz,
same absolute unpacked path and ID maclhppfbnhaeelekfdmmnmhdnmddcch.
The panel had one user-added image: verified it matched the persisted, unexpired
draft with no pending operation before reloading. Browser-local digests compared
draft owner/form/evidence (never printed images, field values or digests).
0.5.1 loaded, session connected, image and complete draft preserved.
Native close button, focus, permanent Account help and dismissal after reload
verified. Left notice dismissed, Account closed and draft available.

One initial smoke assertion ran before asynchronous Epic options finished
rendering; the draft/images were intact. Waiting for DOM fields to match the
confirmed draft and repeating the panel-reload comparison passed. No product
code, credentials or draft data were modified to make the probe pass.
No clipboard reads, user-image uploads, uninstall or new OAuth consent.

## Deployment and handoff

Extension-only: no Docker/GitOps/server rollout or production interruption.
Backend remains source 22b7e89 / GitOps 4eb5b1ec.
Rollback is previous retained 0.5.0 ZIP in the same unpacked path/ID; no
draft-schema change. Resolve pending work before reload, do not uninstall.

Ticket 52 code-linked, evidence-commented, moved to Ready for Review and claim
released; final independent reread v6, no questions, claim null.
Ticket 33 acceptance and unrelated tickets untouched; no historical phase closed.
