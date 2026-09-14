---
type: quick
status: planned
ticket: 99
epic: 3
---

# 99 — Profile and project collaborator directory

Both live answers v2: name+avatar editable; collaborators name+role without email.
Reuse95 permissions and96 accepted memberships; no public workspace directory,
implicit access, profile email/provider changes or real reviewer changes. Inline GSD.

## 1. Server contract

Own profile only, bounded safe display name, optimistic versioning with explicit
conflict recovery. Local validated small PNG avatar, no arbitrary URL fetching,
metadata stripped and dimensions/bytes constrained before decompression. Store one
bounded current avatar in PostgreSQL for atomic updates/removal and existing backup
coverage, not a new service/PVC. Do not expose Better Auth/provider image URLs.
Directory scoped to an accessible existing project: current canonical Owner and
its explicit Members, safe projection {id,name,role,permission,avatar}. Bounded
search/keyset pagination tied to project+filter; foreign/removed members fail closed.
Reusable service for101/102/103. Keep stable IDs and actor history untouched.

## 2. Web and verification

Account profile editor with preview, cancel, upload/remove, consentful save, conflict
retaining draft. Client decodes local PNG/JPEG/WebP, scales to a small PNG, no SVG,
animated/oversized inputs. Directory UI within project, never global enumeration.
Integration negative tests for authentication/origin/foreign project/cursors,
same-name users/removal, avatar validation, injection/long names, historical actor
snapshots and unchanged login email/provider. Real browser1440/360 with isolated users.

## 3. Deliver

Migration preserves current users/grants/history. Full gates and isolated upgrade/
backup restore. Source/image/GitOps exact revisions, observe rollout then read-only
production smoke using own ephemeral sessions. Record evidence in99, review only
after checks. Continue independent remaining Epic tickets; do not stop for97/98
provider/pilot questions unless all other work genuinely blocked.
