# Summary — Ticket 64: separate the Epic create icon

## Result

- The Epic detail primary action gives the decorative `+` and its label an
  explicit eight-pixel gap.
- Its accessible name remains `Create ticket in Epic`, the icon remains
  `aria-hidden` and the preselected-Epic destination is unchanged.
- The rule is scoped to this action; no schema, API, MCP or extension behavior
  changed.

## Verification and release

- Complete gate: 81 unit/web tests, 54 integration tests, 10 web E2E tests with
  two expected skips, 76 Chrome unit tests, 12 Chrome E2E tests, reproducible
  extension build and secret scan all pass.
- Backup `.local/backups/issopen-epic-button/issopen-VO5i8H` passed both
  manifest hashes. Its isolated PostgreSQL 18 restore retained 65 issues, 583
  activity events, ten evidences, ten receipts and 16 migrations; all ten
  attachment files matched their database size and SHA-256.
- Source `44b1bda8ca1160880829f4c71dfba265bf9d55fa` is deployed by GitOps
  `cfc0474b333f549d13bf2ae4c799c89d7d50fdae` as
  `registry.serviciosegado.com/issopen:epic-button-44b1bda` at OCI digest
  `sha256:0964635f064c82ac91059bcfea64ed9f13f08c2d426d8d5db1d2a0eb0dfa8ee7`.
- Argo CD is `Synced/Healthy`; the pod is Ready with zero restarts, public
  readiness passes, PostgreSQL stayed in place and both PVC UIDs are unchanged.
- The authenticated production Chrome session measured `gap: 8px`, the exact
  accessible label, decorative icon and Epic 5 creation URL. Ticket 64 is Ready
  for Human Review v6 without an active claim.
