# Summary — Epic 5: frontend and usability

## Delivered candidate

- Ticket 57: board and management Epic cards no longer show descriptions;
  detail/edit keep the stored value.
- Ticket 58: normal web issue creation supports paste/file images with preview,
  removal, five-image/8 MiB/32 MP limits, private storage, and an atomic,
  idempotent owner endpoint.
- Ticket 59: Epic detail always shows `+ Create ticket in Epic`, including
  populated Epics, and preselects that Epic in the issue form.
- Chrome image sniffing moved to a shared pure validator; Chrome behavior and
  permissions are unchanged.

## Verification before release

- `pnpm validate`: PASS — 80 unit/web, 53 integration, 8 web E2E with two
  expected skips, 76 Chrome unit, 12 Chrome E2E, reproducible extension tree,
  and secret scan.
- `pnpm test:compose`: PASS (1).
- Desktop and mobile E2E create a ticket with private image, render the stored
  evidence, verify compact/full Epic presentation, and revisit a populated
  Epic creation action.
- Complete production backup:
  `/home/jsegado/Projects/platform/homelab/.local/backups/issopen-epic5/issopen-vnUp71`.
- Manifest hashes PASS. Isolated PostgreSQL 18 restore used `--network none`:
  64 issues, 553 events, 9 evidence rows/files, 9 receipts, 16 migrations;
  all nine attachment sizes and SHA-256 hashes PASS. Temporary restore was
  stopped and removed; extracted copy moved to desktop trash.

## Production release

- Source `b7c48cbee00370b5d7b59f0611f93b03ff9894b2` was pushed to `main`.
- Immutable image `registry.serviciosegado.com/issopen:epic5-b7c48cb` was
  published as OCI digest
  `sha256:bd534bb85fd3c7f4bb856ac32920e29cd6ae4370ee096b355d844e10262e183c`.
- GitOps revision `c9c46e9e2984c2c8376279bd8b0ad74f1a16748e` reconciled as
  `Synced/Healthy`. Pod `issopen-856cf9d8d7-zknnl` is Ready with zero restarts
  and runs that exact digest. PostgreSQL and both PVC UIDs were preserved.
- Public readiness returns HTTP 200 with HSTS. Authenticated production smoke
  at 1440 px and 360 px verified image controls without overflow, compact Epic
  listings, retained Epic detail descriptions, and the always-visible creation
  action on populated Epic 5. The smoke did not create tickets or upload images.
- Post-deploy database counts remain 64 issues, 553 activity events, 9 capture
  evidence rows, 9 extension receipts, and 16 migrations.

## Issopen tracking

- MCP links the source commit and verification evidence to tickets 57, 58 and
  59. All three are `ready_for_review` version 6, have no unanswered questions,
  and have no active agent claim.
- The owner retains the final human acceptance decision; none of these tickets
  was closed automatically.
