# Chrome 0.4 — implementation checkpoint

Implemented: shared bounded capture/DOM contract; inspector and optional context;
private PNG storage/API; owner write consent without upgrading old clients;
atomic project/Epic/ticket creation and owner receipts; web evidence; reviewed-only
24 h IndexedDB draft; immutable pending payload/manual retry; maintenance/backup;
release packaging and Forgejo workflow.

Local gates observed before release: 78 unit/web, 45 PostgreSQL integration,
8 web/OAuth E2E (2 expected mobile skips), 46 extension unit, 5 extension browser
tests. Full DB dump to separate PostgreSQL + copied volume restore verifies
checksum/pixels, receipts and safe quarantine. Full Chrome flow loses reply
after commit, reloads, retries with same key and verifies one issue/private pixels.
Secret-scan synthetic URL fixture corrected without weakening the scanner.
Release command reruns all gates on clean Git before packaging.
Compose runtime passed (isolated containers/volumes). The exact previously
deployed 0.3 image also started against schema 0013 in an isolated PostgreSQL:
readiness, owner login and a Chrome-attributed issue read passed. No schema
rollback or production restart was used to establish backward compatibility.
Pre-deploy database backup completed outside the master in private homelab
`.local/backups/issopen-chrome-04/issopen-BifjDh` (0600, checksum manifest).

Pending at this checkpoint: immutable source image, GitOps/PVC rollout, production
smoke and owner acceptance 33. Do not claim these from local tests. Track live
issue versions/questions through MCP before updating statuses; 17 answers
preserved. Existing 43 Done and 44 untouched.
