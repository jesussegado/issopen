# Ticket 117 — ChatGPT Authenticate

Canonical plan: cb2afd7c-cc34-43bf-ab08-7316af6b73f8, Epic8, version4,
questions=[], claimed by Codex Issopen persistent. Direct Owner bug-fix request.

1. Reproduce Node24 CIMD lookup contract failure before login.
2. Patch only the pinned dependency lookup callback (all:true array/scalar).
   Preserve public-address validation, one DNS lookup, pinned connection, TLS,
   timeouts and no redirect following. Include patch in both Docker installs.
3. Add regression and negative transport tests; exercise OAuth and publish clear
   Connect/onboarding troubleshooting without credentials or public signup.
4. Full validation, immutable image, GitOps deployment, runtime/readiness and
   real ChatGPT CIMD authorize probe. Record technical vs actual ChatGPT limits.

No schema migration, credential rotation, Google setup or permission expansion.
Rollback: previous image via GitOps; no data changes required.
