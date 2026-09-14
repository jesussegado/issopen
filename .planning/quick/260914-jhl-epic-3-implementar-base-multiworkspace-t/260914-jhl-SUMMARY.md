# 108 — multiworkspace delivered, continuing Epic3

2026-09-14. Source390f3d0; GitOpscbf737cd; image06d2fec0. Argo Synced/Healthy,
new podissopen-56bc94569b-gxntq Ready0restarts, readiness200 and PVCs unchanged.
Ticket108 Ready for Human Review, claim released. Next95 is claimed/in progress,
quick260914-k34. No human blocker, user mandate continues; not a handoff.

0019 binds existing Chrome clients then removes global membership uniqueness.
Explicit request/tab context, verified additional invitation, safe selector and
revocation only for the affected workspace. Global own sessions/MCP preserved.
One owned workspace invariant remains for105. No Store/reviewer/access changes.

Full pnpm validate:115 unit/web,75 integrationPG,16 webE2E+2 expected skips,
16 Chrome unit/12E2E;8-file reproducible ZIP unchanged, scan316. ComposePASS.
Final web adjustments repeated lint/types,49web and2 desktop/mobile E2E.
Validation found login focus race (banner vs animation frame): deterministic
post-render password focus and ARIA error association, tracked as partial98.
Multiworkspace login now preserves requested path through the chooser.
Mobile E2E locator corrected from hidden navigation link to visible board heading.

Backup source.local/backups/epic3-multiworkspace/issopen-4CEs9C protected, full
DB+attachments checksums verified; isolatedPG18.6 restore113issues,932events,
13matchingimagehashes/bytes,19receipts. Temp restore container removed, backup kept.
Production smoke1440/360: ownaccount metadata/dialogs, detail/image, navigation,
foreign404/admin403; only its newly identified session revoked and SSE cleared.
Real tickets and existing reviewer/user sessions unchanged. Canonical197tests,
actualGitOps134tests andKustomizerenderPASS. No source secrets in git archive image.

Rollback to monoworkspace binary unsafe after second memberships; roll-forward.
Runbook apps/issopen/deploy/MULTIWORKSPACE.md in actual GitOps worktree.
No new dependencies, external signup, emails, DNS or Google/Store mutation.
