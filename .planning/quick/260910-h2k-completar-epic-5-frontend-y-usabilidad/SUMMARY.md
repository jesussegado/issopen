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

## Pending in this summary revision

Immutable image publication, GitOps reconciliation, production smoke checks,
MCP evidence links/status transitions, and exact revisions are recorded after
deployment rather than predicted here.
