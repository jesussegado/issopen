# Issopen skill 0.3.0

Release date: 2026-09-24.

## What changed

Version 0.3.0 adds the explicit `work-epic` mode. A session can now lock its
scope to one project/Epic, build a paginated deterministic inventory, reconcile
missing outcomes by semantic intent and execute only eligible Ready tickets.
Every code, configuration, documentation or deployment change is ticket-first;
queries remain read-only and do not create backlog noise.

The loop confirms claims, records real verification/code evidence, follows the
project completion policy, handles blockers without stalling independent work,
releases owned claims and resumes from authoritative Issopen and Git state. It
stops explicitly when no eligible work remains or a safety condition applies.

## Verification

- 38 focused work-epic tests, including a full restart fixture.
- deterministic package and SHA-256 contract;
- global lint, TypeScript and skill structure validation;
- live dogfood on Epic 6 with tickets 69–76 and public Git evidence;
- native discovery/acceptance inherited from completed ticket 43; the release
  does not claim a fresh native process or browser acceptance where not run.

## Install, update and rollback

Download the versioned ZIP from `/downloads/issopen-skill-0.3.0.zip` and verify
its digest against `/downloads/issopen-skill-manifest.json`. The supported
installer refuses to overwrite local modifications and can install a previous
tag/commit after explicit confirmation. Credentials remain outside the package.

The startup checker detects newer `issopen-skill-vMAJOR.MINOR.PATCH` tags and
notifies; it never updates automatically or changes the active version midway
through work.
