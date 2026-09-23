---
phase: quick
plan: 260923-rf2
subsystem: persistence
status: complete
completed: 2026-09-23
tags:
  - refactor
  - drizzle
  - schema
  - architecture
requirements:
  - ISSOPEN-124
key_files:
  created:
    - src/server/db/schema/identity.ts
    - src/server/db/schema/access.ts
    - src/server/db/schema/agents.ts
    - src/server/db/schema/tracker.ts
    - src/server/db/schema/notifications.ts
    - src/server/db/schema/captures.ts
    - src/server/db/schema/relations.ts
  modified:
    - src/server/db/schema.ts
    - tests/unit/architecture-boundaries.test.ts
    - docs/refactoring-v1.md
    - AGENTS.md
commits:
  - 16d4df6
metrics:
  tables_unchanged: 42
  tests_characterization: 78
  tests_fast: 201
  tests_integration: 118
---

# Quick 260923-rf2: Modular Drizzle schema

Ticket 124 replaces the 1,681-line schema implementation with cohesive modules
while preserving `src/server/db/schema.ts` as the stable public facade.

## Delivered

- Split tables into identity/auth, workspace/access, agents/MCP, tracker,
  notifications and extension/capture modules.
- Isolated cross-domain Drizzle relations in a documented integration module,
  avoiding reverse dependencies between table modules.
- Added architecture tests that reject deep imports from application code and
  reject undeclared internal schema dependencies.
- Updated the project instructions and refactor map with the durable ownership
  and zero-drift rules.

## Verification

- Exact before/after exported declaration names: PASS, no difference.
- `pnpm schema:check`: PASS, 42 tables and no generated migration artifact.
- `pnpm refactor:check`: PASS, including 78 characterization tests.
- `pnpm test`: 44 files, 201 tests PASS.
- `pnpm test:integration`: 22 files, 118 tests PASS against ephemeral
  PostgreSQL and versioned migrations.
- `pnpm build`: PASS, SPA, server TypeScript and packaged skill.
- `git diff --check`: PASS.

## Result

The largest schema module is now the 529-line access boundary. Consumers keep
their existing imports, SQL names/constraints/indexes are unchanged and no
runtime, authorization or product contract was altered.

## Self-check

PASSED. Commit `16d4df6` contains the bounded refactor and its executable
architecture rules. No migration was created.
