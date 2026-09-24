---
mode: quick
task: 260924-pel
status: complete
completed: 2026-09-24
source_revision: 1a3a8a0
gitops_revision: c0c2dbb0
---

# English-only landing screenshots

Scope confirmed with the owner: only `issopen.com` and its screenshots, not `app.issopen.com` or the Chrome extension code. All visible HTML copy, metadata, image alt text and the page language were already English. Two landing screenshots contained Spanish, so both were replaced with English-localized derivatives. The existing source application and extension remain unchanged; these are marketing captures, not evidence that those products are themselves localized.

## Assets and method

- `landing/assets/issopen-board.png`: built-in imagegen `text-localization` edit of the original board screenshot. Final prompt: replace only `Extensiones Chrome` with `Chrome extensions` and `2 tickets` with `2 issues`; preserve the remaining UI, brand, layout and text.
- `landing/assets/issopen-extension.png`: built-in imagegen `text-localization` edit of the original extension screenshot. Final prompt: translate the Spanish header, account state, development badge, information notice and success card into concise natural English; preserve the real interface structure, brand and controls, with no Spanish or invented controls. Required success labels were `Create issue`, `Issue created: 3-Chrome review smoke — image issue`, `1 attached image sent.`, `Open issue in Issopen`, `Prepare another issue`, and `Discard draft`.
- The accepted outputs are 1505×1045 PNGs. `landing/index.html` declares those dimensions. `landing/styles.css` sets the extension image height to auto and adjusts its zoom independently on desktop and mobile, avoiding the old vertical stretch.

## Verification and publication

- Visually inspected both generated assets and the landing at 1440px and 390px; every image loaded and neither viewport overflowed horizontally. The extension image retains its 1.44 aspect ratio on mobile.
- Docker build and packaged-asset hashes pass. Board SHA-256: `8cee67872f46dbb78f26d2307965f9a79e771accc702f0bad231fe0a6b63a3a1`; extension SHA-256: `040bc87735918545334d587f0ba3b60e0bf9174e83d63fb2a1f108b176ce7d1f`.
- Source `1a3a8a0` and GitOps `c0c2dbb0` are published. Landing image: `registry.serviciosegado.com/issopen-landing:1a3a8a0@sha256:de3cf6a4a184324bf3d8567bcf624d4de504f9138ee8af1bb00393638d386097`.
- Production Argo CD is Synced/Healthy at `c0c2dbb0`, landing Deployment 2/2. `https://issopen.com/` declares `lang="en"`; both public PNGs match the hashes above.
- Unrelated in-progress authentication files and quick-task directory were left untouched. No app runtime, API, database, extension build, DNS or secrets changed.
