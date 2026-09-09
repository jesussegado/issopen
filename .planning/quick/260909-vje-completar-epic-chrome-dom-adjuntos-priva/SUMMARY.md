# Chrome 0.4 — technical delivery verified, owner acceptance pending

Implemented: shared bounded capture/DOM contract; inspector and optional context;
private PNG storage/API; owner write consent without upgrading old clients;
atomic project/Epic/ticket creation and owner receipts; web evidence; reviewed-only
24 h IndexedDB draft; immutable pending payload/manual retry; maintenance/backup;
release packaging and Forgejo workflow.

Local gates observed before release: 78 unit/web, 45 PostgreSQL integration,
8 web/OAuth E2E (2 expected mobile skips), 46 extension unit, 5 extension browser
tests. Full DB dump to separate PostgreSQL + copied volume restore verifies
checksum/pixels, receipts and safe quarantine. Full Chrome flow loses reply
after commit, reloads, retries with same key and verifies one issue/private pixels.
Secret-scan synthetic URL fixture corrected without weakening the scanner.
Release command reruns all gates on clean Git before packaging.
Compose runtime passed (isolated containers/volumes). The exact previously
deployed 0.3 image also started against schema 0013 in an isolated PostgreSQL:
readiness, owner login and a Chrome-attributed issue read passed. No schema
rollback or production restart was used to establish backward compatibility.
Pre-deploy database backup completed outside the master in private homelab
`.local/backups/issopen-chrome-04/issopen-BifjDh` (0600, checksum manifest).

## Release and production observed, 2026-09-09

- Source `e5da82fa7078fa3c192128548461a66c5f8d4923`, committed/pushed independently.
- Image `registry.serviciosegado.com/issopen:chrome-mvp-e5da82f@sha256:68ba80cbe45e6bac094d1127a45937656bd32b04b38c01f782a39bb311d8f5b1`.
- GitOps `db767e30`, Synced/Healthy; subsequent docs-only `fac0669d` corrects the
  runtime audit command. Canonical descriptor tracking `edd69d2c`. No merge of
  the unrelated homelab feature branch and no imperative cluster changes.
- New `issopen-attachments` PVC Bound, 5 GiB, protected from Argo prune/delete.
  App pod `issopen-5d5bb9fcd5-p5n78` Ready, zero restarts, readiness HTTP 200.
  PostgreSQL pod/PVC UIDs unchanged. Initial image pull took about 118 seconds
  during the existing Recreate cutover; service recovered without intervention.
- `pnpm extension:release` reran the complete gate on clean source: **182 PASS**,
  two expected mobile skips, deterministic builds and secret scan. Compose runtime
  additionally passed. Homelab `make validate`: **197 tests PASS**; Ansible/Helm
  tools unavailable, no changes to those technologies in this task.
- ZIP: `extensions/chrome/.output/releases/issopen-chrome-0.4.0-e5da82fa7078.zip`.
  SHA256 `8d72844633eb306fa245d62bcbeac2984264069f4a8402af2a3a210ba9954a03`;
  unzip/checksum verified. JSON provenance includes exact source/API/tree hash.
  Workflow defined with pinned actions; **no remote Forgejo run observed**.

## Real Google Chrome 152, production and recovery

Isolated desktop profile, approved production owner OAuth login/consent through
the UI, no PAT in Chrome. Capture source is a synthetic loopback fixture only.
Four tickets were deliberately created as Done technical fixtures in Epic 1:

| Ticket | Mode | Image dimensions |
| --- | --- | --- |
| 45 | viewport | 1170 × 1005 |
| 46 | full | 1170 × 1845 |
| 47 | crop | 270 × 170 |
| 48 | element | 1170 × 1005 |

For each: preview → opaque 40×40 mask → explicit review → submit → web evidence.
Pixel (10,10) is `[0,0,0,255]` in the stored image. Owner image GET 200, anonymous
401, private/no-store. Ticket 48 DOM contains the structural button, no decoys.
Technical fixtures are labelled, not represented as personal owner acceptance.
Chrome remains open and connected in `/tmp/issopen-chrome-04-76r5Lz` for testing.

Harness startup was corrected to omit Playwright's default `--disable-extensions`
for branded Chrome; an early blank sign-in page loaded after retry. These attempts
did not create tickets. The final complete four-mode flow passed. Runtime audit
uses `node dist/runtime/scripts/capture-storage.js`, not `dist/scripts/...`.

Read-only production audit: 4 verified PNG, 90,425 bytes, no corrupt/missing files,
orphans or quarantine. Full post-capture backup in private homelab
`.local/backups/issopen-chrome-04/issopen-uMNA9F`: DB dump + attachment tar + checksums,
0700/0600, outside the master. Restored the **actual full production dump** into
an ephemeral PostgreSQL container with **network none and no published ports**;
verified all 4 real capture files by metadata/hash and all 4 idempotency receipts.
Container cleaned after success; recovered PNGs retained privately in
`restored-77GjcQ`. Source backup and production never overwritten.

Extension update/rollback: same isolated profile and absolute unpacked path,
0.4 → source `def5297` 0.3 → 0.4, same extension ID, working panel/modes and local
storage marker preserved. Previous source built in a separate worktree; active
0.4 artifact and personal Chrome untouched. README now explains stable-path
update/rollback. Server previous image against schema 0013 passed as above.

## Tracker handoff (independent MCP reread)

- 19–32 Ready for Review, linked implementation commit and per-ticket evidence.
- 33 In Progress v5, one unanswered blocking owner-acceptance question, no claim.
- All 15 claims null. Original 17 answers remain at version 2, unchanged.
- 43 Done v22; 44 Backlog v5, untouched. No historical GSD phase closed.

The remaining human gate is answering 33 after using the extension personally.
Remote CI runner execution and Web Store distribution are not claimed; the
approved initial distribution is unpacked with locally validated artifacts.
Reread live issues/answers before subsequent work; this file is derived memory.
