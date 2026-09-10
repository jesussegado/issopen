# Quick plan — Ticket 64: separate the Epic create icon

## Goal

Give the `+` icon and `Create ticket in Epic` label an explicit visual gap so
the primary action remains legible at desktop and mobile widths.

## Tasks

1. Add a narrowly scoped class and spacing rule to the Epic detail action.
2. Cover the semantic label and computed visual gap in web and browser tests.
3. Run the complete repository gate, publish an immutable image and deploy it
   through GitOps after backup/restore verification.
4. Verify the production button and return ticket 64 for human review.

## Invariants

- The accessible name remains `Create ticket in Epic`; the decorative `+` is
  still hidden from assistive technology.
- The destination URL and issue-creation flow do not change.
- No schema, API, authentication, MCP or extension behavior changes.
