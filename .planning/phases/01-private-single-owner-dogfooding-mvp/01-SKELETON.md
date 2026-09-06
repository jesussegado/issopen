# Phase 1 Walking Skeleton

The first executable slice proves the complete deployment boundary before
feature depth is added:

```text
docker compose up
  -> PostgreSQL becomes healthy
  -> migrations run
  -> Issopen answers /health/ready
  -> operator bootstraps exactly one owner
  -> owner signs in and creates the personal workspace
  -> protected API denies anonymous access
```

Every later plan extends this same deployable and database. There is no mock
backend, parallel prototype, desktop shell or second service to discard.

## Growth sequence

1. **Plan 01:** runnable private application, durable database and owner session.
2. **Plan 02:** projects/issues/activity as one transactionally correct domain.
3. **Plan 03:** complete responsive human workflow over those real APIs.
4. **Plan 04:** separate agent identity plus OAuth/PAT Remote MCP over the same
   services.
5. **Plan 05:** real dogfood fixture, full gates and external ChatGPT checkpoint.

The HTTPS ChatGPT check is the only external dependency. It may report a
remaining checkpoint, but it may not be replaced with an invented hostname or
an unapproved production mutation.
