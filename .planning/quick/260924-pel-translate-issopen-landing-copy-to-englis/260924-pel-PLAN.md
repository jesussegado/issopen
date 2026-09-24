---
mode: quick
task: 260924-pel
status: planned
date: 2026-09-24
---

# English-only Issopen landing and screenshots

Scope is `https://issopen.com/` only. The owner explicitly excluded the app and Chrome extension from localization. Do not change their source strings, authentication, or production data. Preserve unrelated untracked work.

## Task 1 — Audit and localize landing assets

- Inspect all visible landing copy, metadata, alt text and the two embedded product screenshots.
- Keep existing English HTML copy. Replace Spanish text in both screenshots with accurate English while preserving the real Issopen UI and brand.
- Prefer faithful text-localization; if generated edits distort the interface or text, recapture an isolated English representative screen from the source UI. Do not claim the app/extension itself is English.

Verify: visually inspect both 1440×1000 assets and check that no Spanish remains in the landing or displayed screenshots.

## Task 2 — Integrate and test

- Update landing references only if new asset filenames are required. Keep Open Graph/Twitter images aligned.
- Build the landing image and verify the packaged screenshot bytes, HTML language, and local responsive rendering.
- Commit source and GSD summary/state atomically without staging unrelated files.

Verify: Docker build, image smoke, English screenshot inspection, `git diff --check`.

## Task 3 — Publish

- Push source, publish immutable landing image, update only Issopen landing GitOps manifest and revision documentation.
- Wait for Argo CD and both landing replicas, then verify public HTML and screenshot asset hashes.

Verify: Argo `Synced/Healthy`, landing 2/2, HTTPS 200, exact asset bytes.
