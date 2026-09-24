---
status: complete
quick_id: 260924-sx0
date: 2026-09-24
source_commit: 1c42ae4
isolated_release_commit: 4857f44
gitops_commit: 30f6395a
---

# Fictional AI-project screenshots

The landing and README now use the same two English-only, illustrative Issopen screenshots. The fictional project, `The One-Prompt App`, makes the irony visible: its `Build the 'quick' AI app` Epic contains tickets to find the spec in 47 chats, explain the app again, stop rewriting auth, turn chat into a plan, and check what AI shipped. The extension image drafts `AI forgot the spec in chat #47` and says the agent built a CRM after the team agreed on a dashboard.

## Image generation

Built-in imagegen edit mode, with the previous English screenshots as edit targets. No API/CLI fallback was used.

- Board prompt: preserve the Issopen board design, branding, five-column layout, and English UI; replace only the demo data with `The One-Prompt App`, a five-issue `Build the 'quick' AI app` Epic, and the five satirical tickets above.
- Extension prompt: preserve the Issopen extension design and English branding; replace the confirmation panel with a populated issue form selecting the same fictional project/Epic, title `AI forgot the spec in chat #47`, description `We agreed on a dashboard in chat #12. It built a CRM instead.`, one image attachment, and `Send issue`.

Final assets are `landing/assets/issopen-board.png`, `landing/assets/issopen-extension.png`, and identical copies at `docs/assets/readme/issopen-board.png` and `docs/assets/readme/issopen-extension.png`. All four are 1506×1045 PNGs. Board SHA-256: `4bca90718c3f581e4874d6b67eef7e038cf1b178031fcc95e6715bb8c59c59f4`; extension SHA-256: `d8ba2c1623e2b16695fc0d4fdad8dfe18f2491bed7655610d14ae76e4bf09b87`. The landing and README describe these as illustrative/fictional rather than real customer data.

## Verification and publication

- Visual inspection passed; Playwright at 1440px and 390px loaded both PNGs with no horizontal overflow. The mobile extension form remained readable.
- Docker landing build and packaged PNG checksums passed; `pnpm test:secrets` passed (591 files); `git diff --check` passed.
- Local source commit `1c42ae4` was recreated as isolated release commit `4857f44` from the published source base so unfinished authentication commits were not released. The private `landing/one-prompt-demo` branch and GitHub `main` both contain `4857f44`; GitHub README PNG hashes match the final assets.
- The immutable landing image `registry.serviciosegado.com/issopen-landing:4857f44@sha256:cdeea0b93e533e59674e05ca4eacbd75ea1fb7963dd606cbd24af2f980798f19` was deployed through GitOps commit `30f6395a`. Argo CD is `Synced/Healthy`, landing Deployment 2/2 Ready, both new pods have zero restarts, and the PostgreSQL and attachment PVCs remain Bound.
- Public `https://issopen.com/` references the new images and both live PNG checksums match. No app runtime, extension package, database, DNS, or Secret was changed.

The broader repository-wide Spanish cleanup requested earlier is separate and remains incomplete; this task only changes illustrative marketing/README screenshots.
