# Quick plan — Ticket 62: clear sent images after creation

## Goal

Remove the misleading editable-image state after the Chrome extension has
already received a successful ticket response, while preserving real draft
removal before submission and idempotent uncertain retries.

## Tasks

1. Reproduce the state in the managed Chrome panel and record whether the
   attachment has already been sent.
2. Hide the editable attachment area after confirmed creation, clear its
   in-memory copy, and report the number of images attached to the new ticket.
3. Extend E2E coverage for pre-submit removal, post-submit success and a clean
   next draft; run the extension and repository gates.
4. Publish the source release, load the validated unpacked extension in the
   managed profile without changing its ID, verify the real panel, and return
   ticket 62 through MCP for human review.

## Invariants

- A pending or uncertain request remains locked and keeps its exact payload and
  idempotency key.
- No server attachment deletion is implied or introduced.
- No new Chrome, OAuth, MCP or backend permission is added.
- Existing draft data is not discarded during an upgrade or failed request.
