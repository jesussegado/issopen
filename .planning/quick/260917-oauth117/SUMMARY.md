# 117 — Authenticate repaired and production-smoked

Source381fdf357b9ad443370947b22b049bef5b411c69 implements the pinned CIMD
lookup-shape fix, signed password/Google login continuation, consent scope labels
and all onboarding surfaces. Test-only85c03e3 makes Epic link selectors exact
after parallel board shortcuts introduced ambiguous text matches.

## Verification

- Regression demonstrated array/scalar mismatch before patch, passes afterward.
- `pnpm validate` on isolated85c03e3:192unit/web,115integration,42webE2E/2expected
  skips; Chrome unit/E2E13/reproducible validation; secret scan441; all PASS.
- Integration mocks metadata/JWKS network only: actual CIMD persistence, signed
  login, consent, issuer callback, private_key_jwt/PKCE token and MCP read PASS.
- `pnpm test:compose` in isolated worktree PASS; GitOps Python140 tests and
  kustomize PASS. Offline install initially lacked cached package metadata;
  normal frozen install succeeded without disabling supply-chain checks.
- Built/pushed immutable diagnostic imagechatgpt-oauth-381fdf3/digest1c497cbe;
  it independently downloads both official ChatGPT documents200.

## Actual deployment (preserve concurrent releases)

While validating, source20c4b3030d62ae84ca832cb2f3193ecb7ec994fe added board drag
and drop on top of381fdf3/85c03e3. GitOpsaf286bf0cdfc24e075ec03ed4ec36c38d4a03537
published that descendant as epic5-drag-20c4b30, digest
103cd7d0f731957df1ba7eb3f277c828f8d8aca2ec1090bb3fb2d8a87e42b70b.
Our older local GitOps16e113c6 was deliberately NOT pushed: do not roll back the
newer board. Exact runtime observed Synced/Healthy, podissopen-7c5cb95cfd-gj4fc
Ready/0restarts, readiness200, both PVC identities unchanged.

From that pod, real chatgpt.com/oauth/client.json and jwks.json return200 through
the patched transport. Anonymous authorize now returns a login continuation.
Fresh isolated Playwright owner sign-in lands on **ChatGPT wants to access
Issopen**, Allow enabled, correct workspace, read/offline consent.1440/360
screenshots inspected, no overflow/page errors. Updated /connect help and all
public onboarding responses pass. Only the test session was signed out200.

No production consent grant was submitted and no genuine ChatGPT private-key
exchange can be fabricated. Owner must retry Authenticate for final account-side
acceptance. Ticket117 goes to Ready for Human Review, not Done.

No schema or secret changes. Skill archive unchanged (instructions and MCP tools
unchanged); OAuth onboarding updated instead. Rollback via previous GitOps image
would restore the original bug and remove later board changes: use a targeted
forward fix for any new issue, not an unreviewed old-image overwrite.
