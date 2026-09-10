# Summary — Ticket 62: clear sent images after creation

## Result

- Reproduced in the managed Chrome panel: one image remained visible with a
  disabled remove button after ticket 64 had already been created, while the
  stale status still said it had not been sent.
- The attachment editor now exists only before confirmed creation. A successful
  response clears the in-memory evidence and reports the number of images that
  were attached to the ticket.
- `Preparar otro ticket` opens a clean attachment area. Removal from a real
  draft remains immediate and covered by the existing image E2E.
- Pending/uncertain submissions retain their exact payload and remain locked;
  this change does not add server-side evidence deletion.

## Verification

- Extension typecheck: PASS.
- Extension unit tests: 76 PASS.
- Extension E2E: 12 PASS, including the new confirmed-success regression.
- Reproducible build: PASS, 8 files, tree SHA-256
  `5daed7ee940a1dfe29e61eef5f5d8aa85529943eff34b3d77f60941b52f2f680`.
- Secret scan: PASS.

Source publication, managed-profile reload and MCP transition are recorded
after the immutable source revision exists.
