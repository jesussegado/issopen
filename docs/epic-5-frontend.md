# Epic 5 — Frontend and usability

This delivery covers tickets 57–59 without changing stored Epic descriptions,
issue keys, MCP permissions, or Chrome OAuth permissions.

## Compact Epic presentation

Project boards and the **Manage Epics** list show only the stable
`number-title` label, ticket count, and derived progress. The description is
still stored, editable, and visible on the Epic detail page. This is a
presentation change only.

Epic detail always exposes **+ Create ticket in Epic** in its page actions,
whether the Epic is empty or already has related tickets. Its link opens the
normal issue form with the current Epic preselected. The empty state therefore
does not need a second, conditional creation action.

## Images on normal web issue creation

The create-issue form accepts paste events and multiple file selection. It
supports static PNG, JPEG, and WebP, at most five images, 32 megapixels per
image, and 8 MiB total. It shows private local previews and allows each image
to be removed before submission. Editing an existing ticket does not add
attachments in this cut.

JPEG and WebP are decoded and converted to PNG in the browser. PNG is sniffed
by bytes rather than trusting its filename or MIME type. The server validates
and re-encodes every PNG again, removing ancillary metadata before storing it.
SVG, GIF, animation, oversized dimensions, malformed PNG, excessive payloads,
and unavailable storage are rejected.

The owner-only endpoint is:

```text
POST /api/v1/captures
```

It requires the normal owner session and same-origin protection. The strict
body includes a UUID idempotency key, normal issue fields, project/Epic IDs,
and an image array. Issue numbering, activity, evidence rows, image files, and
the receipt are coordinated by one database transaction. A concurrent or
uncertain retry with the same body returns the original ticket; reusing the key
with changed content returns 409. Invalid image batches do not leave a ticket
or partial evidence rows. Files written before an uncertain database commit
remain recoverable as aged orphans and are handled by the existing audit/GC
runbook.

If the browser loses the response, the form locks its fields and offers
**Retry safely** with the exact same key and content. A definite server error
keeps the draft editable and rotates the key for a corrected request.

Images use the existing `capture_evidence` table and private attachment PVC;
there is no schema migration. Evidence reads retain owner/workspace checks,
`private, no-store`, CSP sandboxing, checksum validation, deleted-ticket
filtering, and download authorization. The neutral label **Private image** is
used because evidence may now originate in either the web UI or Chrome.

## Release and rollback

Run `pnpm validate`, `pnpm test:compose`, a fresh complete backup, and an
isolated restore before release. Deploy the immutable source image by digest
through GitOps. Rollback changes only the application image: the database,
receipts, and both PVCs remain. An older application can still serve existing
evidence, but its normal web form cannot add new images.
