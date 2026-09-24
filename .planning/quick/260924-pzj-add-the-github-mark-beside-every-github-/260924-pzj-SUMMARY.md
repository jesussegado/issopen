---
mode: quick
task: 260924-pzj
status: complete
completed: 2026-09-24
source_revision: f7078cc
gitops_revision: 9bc6ceb4
---

# GitHub mark on all landing links

The English landing now shows the GitHub mark immediately before the word “GitHub” in desktop navigation, mobile navigation and footer resources. All three links retain `https://github.com/jesussegado/issopen`, and the decorative SVG is hidden from assistive technology so the accessible name remains “GitHub”. Shared CSS aligns the 16px mark and text without horizontal overflow.

Source commit `f7078cc` changed only `landing/index.html` and `landing/styles.css`. The Docker landing build and packaged-link check passed. Playwright checked 390px and 1440px layouts, three correct links, visible icons and no horizontal overflow.

The immutable image `registry.serviciosegado.com/issopen-landing:f7078cc@sha256:01cad2e715236e84d72539993ba2c15d795e97f22046440df0f428375c7ff2c6` was deployed via GitOps `9bc6ceb4`. Argo CD is Synced/Healthy; landing is 2/2 Ready. Public `https://issopen.com/` serves all three marked links, and the live mobile icon measures 16px. Unrelated in-progress authentication files and GitOps changes were preserved.
