---
status: resolved
phase: 01
depth: standard
files_reviewed: 7
findings:
  critical: 0
  warning: 6
  info: 2
  total: 8
reviewed_at: 2026-09-21
resolved_at: 2026-09-21
open_findings: 0
---

# Phase 01 visual and code review

Scope: the authenticated shell, production board, issue detail, shared UI
styles and their tracker tests. The review combines source inspection with a
read-only production capture at 1440×1000 and 390×844.

## Warnings

### WR-01 — Board columns are narrower than the approved contract

`styles.css` uses `208px` columns, while the approved UI contract requires a
minimum of `280px` and a maximum of `360px`. Long ticket and status names wrap
aggressively, weakening hierarchy. Restore bounded columns and keep overflow
inside the board region.

### WR-02 — Filters wrap according to intrinsic content

The flex toolbar lets the Epic selector consume extra width, leaving the
questions filter alone on a second row. Use an explicit responsive grid so the
four controls align predictably at desktop, tablet and mobile widths.

### WR-03 — Ticket cards lack a compact information hierarchy

The number, title and metadata are rendered as one dense block; priority is
hidden until expansion and the assignee paragraph inherits excess spacing.
Separate the stable number visually, keep the complete accessible link name,
show neutral priority/assignee metadata in the collapsed card and remove
duplicated information from the expanded area.

### WR-04 — Mobile board guidance describes an unavailable gesture

The page tells coarse-pointer users to drag tickets even though native HTML
dragging is not the mobile path. Mobile copy must point to expansion and the
status selector; desktop may retain drag guidance.

### WR-05 — Authenticated mobile header wraps into a noisy two-row layout

Role text is duplicated by the account menu and the full Notifications label
competes with Menu and account controls. Preserve accessible names while hiding
redundant visible copy at mobile widths and keep 44px touch targets.

### WR-06 — Activity stretches to the height of the issue detail

The two-column grid uses the default stretch alignment, producing a mostly
empty activity panel as tall as all ticket content. Align grid children to the
start and keep the activity rail independently usable on desktop.

## Informational findings

### IN-01 — Visual weight and surface rules have drifted

Some local rules use weight `700` although the approved typography allows only
`400` and `600`. Normalize weights and establish one border/radius treatment
without adding a component library or decorative shadows.

### IN-02 — Production console evidence needs an authenticated boundary

The initial anonymous session probe produces an expected `401` before sign-in,
which can be mistaken for a protected-page failure. Visual smoke should clear
pre-auth diagnostics after login, then assert no console or page errors on the
authenticated routes.

## Resolution target

Tickets 119–122 in Epic 9 track the implementation, responsive verification,
regression coverage and production validation for every finding above.

## Resolution

All eight findings are resolved by source commits `8cf80bb` and `0d1001b` and
production GitOps commit `90a1da77`:

- WR-01/02/03: bounded 280–360px board columns, a responsive filter grid and
  compact number/title/priority/assignee card hierarchy are live.
- WR-04/05: touch guidance, 44px targets and a non-truncated mobile shell are
  live at 390px without document overflow.
- WR-06: the activity rail is bounded and sticky on desktop, then returns to
  normal document flow on tablet and mobile.
- IN-01/02: typography/surfaces follow the approved tokens and authenticated
  smoke evidence excludes the expected anonymous session probe.

Validation: 195 unit/web tests, 118 integration tests, 42 web E2E scenarios,
16 Chrome unit tests, 13 Chrome E2E scenarios, reproducible build, secret scan,
Compose and 140 GitOps tests pass. Production is Synced/Healthy with the exact
`0d1001b` image, readiness OK, zero web-pod restarts, unchanged PVCs and clean
1440×1000 plus 390×844 visual smoke reports.
