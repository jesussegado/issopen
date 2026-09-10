# Chrome 0.5: paste/upload external ticket images

Owner request replaces capture/DOM/editor with external screenshots.
Ticket 51, Epic Chrome 1. Source implementation 4426dc6 and panel title 22b7e89;
release source `22b7e89c16b6c5a5c5faa996336dd363db310da6`, pushed to origin/main.

## Delivered implementation

- Ctrl+V/CmdV native paste, explicit Paste button with optional clipboardRead,
  multi-file input, compact thumbnails/count/remove. Normal text paste preserved.
- PNG/JPEG/WebP static images normalized locally to PNG without metadata;
  up to 5, 8 MiB total normalized, 8 MiB input each, 32 MP each.
- No activeTab/scripting, page access or automatic clipboard reads; worker
  rejects legacy capture requests. Historical helpers remain unconnected.
- User-added images enter 24 h local draft; no separate review confirmation.
  Submit remains the only upload. Account dialog/composer/destinations preserved.
- API v1 additive images array, maxImages capability; legacy image/pending hashes
  unchanged. Atomic private evidence/issue/receipt; deterministic attachment order.
  No schema migration, new volume or OAuth scope. Older server permits one image.

## Verification

Full clean release gate: 213 PASS:
78 unit/web, 46 PostgreSQL integration, 8 web/OAuth E2E, 76 extension unit,
5 extension E2E. Two expected desktop-only skips in mobile profile.
Compose runtime separately PASS, repeated owner bootstrap and restart persistence.
First release gate timed out one legacy integration case at 5 s during parallel
build/Compose activity; complete rerun passed without editing/skipping that test.

Native Chromium clipboard image write → real Ctrl+V, text paste unaffected,
PNG/JPEG/WebP input, removal, IndexedDB restoration, narrow 320/400 px screenshots.
Permission denied/empty/success button branches use explicit UI fixtures.
OAuth/API E2E submits two PNGs, loses response after commit, reloads/retries,
sees one ticket/two private images, anonymous GET 401. DB integration accepts
five, rejects malformed/mixed/oversized batches atomically, preserves receipt
through reconnection, read-only denial and legacy restore regression.

Release ZIP `extensions/chrome/.output/releases/issopen-chrome-0.5.0-22b7e89c16b6.zip`.
SHA-256 `7c08a83b12c678bff5bb02d33b53e1f0f2bb5145f01b44ef48c7acb658827ac7`.
Checksum/unzip verified; two builds identical, 8 files; secret scan PASS.

## Deployment artifacts / backup

Docker image `registry.serviciosegado.com/issopen:chrome-images-22b7e89@sha256:8f4db1a315de73cdd4df633863aea6dd6a04a45af9e26037234863a126222cc3`.
Actual push and registry inspection agree. amd64 manifest
`sha256:580a944ca52f52c30784d5bb374b138f6396747cb3a35c67d9e11e4e1c1ce997`.
GitOps main `4eb5b1ecbb50fcd596542ff7852fd7a686233039`; canonical tracking
commit `b62b1c91`. Unrelated dirty watchdog/network work left untouched.

Canonical homelab make validate: 197 PASS, workspace 31 repos valid.
Ansible/Helm absent (not checked, no changes to those layers). Production main
has historical structure without make validate: its Kustomize rendered and
three deployment files match the validated canonical checkout byte-for-byte.

Full pre-release backup outside master:
`homelab/.local/backups/issopen-chrome-05/issopen-okHnJe`, private permissions,
database.dump + attachments.tar + complete checksummed manifest.
Restored actual dump to disposable PostgreSQL with network none/no ports,
verified all 4 PNGs/checksums/bytes and 4 receipts. Restored files retained under
`restored-Dv84rI`; only ephemeral restore container removed. Production untouched.
Pre-release storage audit: 4 verified PNGs, 90425 bytes, no invalid/orphan files.

## Rollback boundary

Previous backend e5da82f and previous ZIP 0.4.3 retained; revert image via GitOps,
keep both PVCs and schema 0013. Old web may not render new upload metadata.
Do not downgrade extension with pending/new multi-image draft: 0.4.3 parser
can discard it. Resolve/export first, keep same unpacked path/ID, never uninstall.
No live downgrade with user data performed; no downgrade draft compatibility claim.
Personal Epic acceptance ticket 33 remains untouched; 43 Done, 44 untouched.

## Final runtime / tracker verification

GitOps 4eb5b1ec is Synced/Healthy; pod issopen-7d4595fcf8-l552t Ready, zero
restarts, actual imageID matches the registry index digest. Both original
PVC/PV identities preserved. Public readiness/web/new Vite bundle 200 and HSTS.
Post-deploy storage audit still 4 verified PNGs/90425 bytes, zero invalid/orphans.

Reloaded Chrome 152 in existing managed profile /tmp/issopen-chrome-04-76r5Lz,
same unpacked path and ID maclhppfbnhaeelekfdmmnmhdnmddcch. Checked no unsaved
fields/capture first. Native toolbar action opens Images 0/5, version 0.5.0,
human account connected/writable, 2 projects, server maxImages=5. Account
dialog Escape/return focus verified. Screenshot in ignored .output.
No real clipboard read, user-image upload or production test ticket created.
Initial automated account probe overlapped startup's serialized account request;
waiting for Conectada and repeating succeeded, without changing credentials.

MCP ticket 51 independently reread after code link, evidence comment, move and
claim release: Ready for Review v6, no questions, claim null. 33 untouched.
