# Feature Landscape: Issopen

**Domain:** Open-source visual issue tracking for people and external coding agents  
**Researched:** 2026-08-23  
**Audience:** Individual developers and open-source maintainers first  
**Confidence:** HIGH for named competitors and issue-tracker conventions; MEDIUM for the opportunity assessment, which is an inference from public product material

## Executive Recommendation

Issopen should not position v1 as “BugHerd with MCP.” BugHerd, Marker.io,
Userback, and Plane now all advertise MCP access, and the first three let an
agent read feedback and write status/comments. MCP connectivity is therefore a
market expectation, not a defensible feature on its own.

The defensible v1 is the complete, narrow loop:

```text
human reviews and safely captures a visual problem
  -> issue combines visual, DOM, browser and repository context
  -> named external agent receives only scoped MCP access
  -> agent claims and updates the same issue with attributed activity
  -> human reviews the linked result and closes it
```

Issopen should add one product-specific aggregation on top: an **audit epic**
that groups visual/UX findings from people with code, SEO, security and
compliance findings created by external agents. The audit is coordination and
traceability, not a scanner or hosted-agent runtime.

The other material differentiator is distribution: the complete loop,
including capture privacy controls and basic MCP, must remain in both the
open-source Community edition and permanent Cloud Free. Cloud should charge for
managed capacity and operations, never by withholding history or disabling the
core loop.

## Competitive Baseline

| Product | Current relevant capability | What it establishes for Issopen | Gap/opportunity for Issopen |
|---------|-----------------------------|---------------------------------|-----------------------------|
| BugHerd | Point-and-click element feedback, screenshot/annotation, browser metadata, integrated Kanban, collaboration and 11 MCP read/write tools; MCP is currently beta and included for subscribed users. | Visual capture must land immediately as a trackable item, and agents must at least read context, comment and change workflow state. | Open/self-hosted distribution, permanent Cloud Free, privacy review before upload, explicit agent identities/scopes and mixed audit epics. |
| Marker.io | Widget/extension capture, annotation, environment details, console/network data, replay, issue synchronization and 33 MCP tools, including accessibility monitoring. | Merely exposing screenshots over MCP is already commodity. Setup and signed media access must be smooth. | A smaller privacy-minimized default; native tracker and audit workflow rather than an integration-first feedback relay; open deployment. |
| Userback | Widget and extension, visual/video/replay context, feedback workflow, notifications, portals/surveys and MCP that can search, create, comment, assign and transition feedback. Free collection exists, but Free feedback becomes unavailable after seven days; MCP starts on a paid plan. | Users expect rich feedback detail, filters, collaboration and notifications. | No time-based lockout, MCP in Free/Community, no survey/roadmap sprawl, safer context capture and explicit external-agent governance. |
| Plane | AGPL Community edition, Cloud Free, rich work-item/project management, native MCP and native/external agents. | Open source + free cloud + MCP is also not unique by itself. A generic issue tracker will out-feature Issopen. | Specialize in secure browser evidence and the capture-to-agent-review loop; do not compete on cycles, docs, roadmaps or general PM. |
| BugDrop / Pindrop.js | Small open-source visual-feedback components: BugDrop sends annotated reports to GitHub Issues; Pindrop is local-first and adapter-driven. | Lightweight open capture is feasible and attractive to maintainers. | Issopen supplies the durable multi-user tracker, scoped agent operations, audit grouping and Cloud option these components do not make their primary product. |
| GitHub Issues / Linear | Stable issue IDs, title/status, assignee, priority/labels, comments/activity, filtering, notifications and development links are normal issue behavior. | Issopen cannot let its visual/agent features excuse a weak basic issue experience. | Keep this subset polished while deliberately omitting their planning depth. |

**Important inference:** public product pages do not demonstrate that BugHerd,
Marker.io or Userback model a separately governed agent identity with its own
project allowlist and end-to-end actor attribution. They describe OAuth or
account-based access and agent actions. Issopen should validate this gap during
customer interviews rather than claim competitors cannot do it.

## V1 Table Stakes

Missing any of these makes the product feel incomplete for the chosen audience.

| Area | Capability and v1 boundary | Why expected | Complexity | Dependencies |
|------|----------------------------|--------------|------------|--------------|
| Onboarding | GitHub OAuth and email magic-link login; automatically create or enter one personal workspace. | Developer tools must be usable without password administration or organization setup. | Medium | Auth, session handling, workspace authorization |
| Onboarding | A short activation checklist: create project, create first issue, install extension, submit first capture, connect/test MCP. Each step is skippable and resumable. | The product spans web, extension and an MCP client; users otherwise fail between surfaces. | Medium | Projects, extension distribution, MCP connection test, product events |
| Workspace collaboration | Invite by email/link and three understandable human roles: owner, admin, member. All workspace members can use ordinary projects in v1. | Maintainers need collaborators without enterprise RBAC. | Medium | Email delivery, membership model, server-side authorization |
| Projects | Create, rename and archive a project with stable key, description and lightweight repository context. Never recycle issue identifiers. | Stable project/issue identity is basic tracker behavior and essential in comments and agent prompts. | Low-Medium | Workspace auth, transactional numbering |
| Repository context | Store one canonical repository URL plus optional default branch and repository subpath; show it on issues and return it over MCP. | An external coding agent needs to match a visual report to the checkout it already controls. | Low | Projects, URL validation, MCP issue DTO |
| Kanban | Fast board with default semantic states `backlog`, `todo`, `in_progress`, `review`, `done`; allow display-name changes and reordering without changing semantics. | BugHerd and modern issue trackers make visual prioritization and drag/drop expected. Stable semantics prevent renamed columns from breaking agents. | Medium | Issue state model, ordered columns, optimistic/concurrent updates |
| Issues | Manual issue creation and edit with stable ID, title, Markdown description, status, fixed small priority set, labels, one accountable human owner, attachments and source. | The tracker must remain useful without the extension or an agent. Linear requires only title/status and keeps other properties optional; Issopen should preserve that speed. | Medium | Projects, authorization, editor, storage |
| Issues | Issue detail with comments, visual context, repository/result links and chronological activity. | Humans and agents need one shared place for evidence and decisions. | Medium | Actor model, audit events, attachment authorization |
| Issues | Filter/search by project, status, priority, label, owner/claimant, source, audit and free text; archive rather than destructively delete in normal use. | Boards become unusable quickly without retrieval and completed-item control. MCP list tools need the same filters. | Medium | Query/index design, consistent web/MCP contracts |
| Collaboration | Comments, `@mention` of human collaborators, edit attribution and a visible distinction between human, agent, integration and system activity. | Status alone cannot carry investigation, blocker and review context. | Medium | Membership, actor model, notification events |
| Notifications | Minimal inbox/email notifications for invitation, assignment, mention/reply, agent claim, and transition to Ready for Review; per-user mute/unsubscribe. | These are the events that require action. Linear automatically subscribes creators, assignees and mentioned users; Issopen needs the same basic reliability, not a notification rules engine. | Medium | Event generation, email provider, user preferences |
| Private attachments | Private screenshots/images with validated type/size, authorized upload/download and short-lived access; no public object URLs. | Every competitor treats visual evidence as core, while Issopen promises stronger privacy. | High | Object storage, workspace authorization, quotas, cleanup jobs |
| Extension distribution | Signed Chromium Manifest V3 package, Chrome Web Store listing and documented unpacked build for Community contributors. | “Install and capture” must work for normal users while remaining reproducible from source. | Medium | Release pipeline, store review, extension auth |
| Capture | Capture visible viewport or user-drawn region, URL/title, timestamp, viewport, scroll position and available browser/OS metadata. | This is the minimum actionable context offered by visual-feedback tools. | High | Extension permissions, browser capture API, private attachments |
| Element context | Optional hover/click element picker with highlight, bounding box, stable best-effort selector, tag, limited visible-text excerpt and tightly bounded sanitized DOM snippet. | The differentiating issue should point to the element an agent may need to find in source. | High | Content script isolation, selector strategy, sanitizer, capture model |
| Capture review | Before submission, preview the image and every metadata category; let the reporter crop, redact/cover regions and omit URL, selected text or DOM context. Sensitive inputs and secret-like values are excluded by default. | Competitors offer masking, sometimes only on high tiers. Issopen's privacy promise requires reporter control before bytes leave the browser. | High | Local image editor, client-side sanitizer, clear consent UX |
| Annotation | Focused tools only: rectangle, arrow, pen and short text; retain original capture and normalized annotation data. | Screenshot annotation is baseline in BugHerd, Marker.io and Userback. | Medium | Capture canvas, attachment model, responsive rendering |
| Capture reliability | Submission progress, retry without recapturing, and a local unsent draft after an upload or auth failure; explicit success with created issue ID. | Losing a report destroys trust in the primary loop. | Medium | Extension local storage, resumable/idempotent API, upload lifecycle |
| MCP setup | One standards-compatible Remote MCP endpoint, concise setup snippets for at least Codex and Claude Code, a connection test and token last-used/error visibility. | Competing products advertise setup in minutes and multi-client compatibility. | Medium | Remote transport, auth, docs, observability |
| MCP read | Small paginated tools to list projects/issues, filter work, get one complete issue/audit and obtain authorized short-lived attachment access. Do not inline large images by default. | An agent cannot act reliably without bounded, structured retrieval. | Medium | Shared contracts, filters, private media access |
| MCP write | Explicit tools to create an issue/finding, claim/release work, comment, update supported fields, link result metadata, and transition/close when permitted. No arbitrary patch tool. | All three visual-feedback leaders now expose write actions; read-only MCP is below market. | High | Agent identity, scopes, concurrency rules, audit events |
| Agent permissions | Named credentials shown once, stored hashed, revocable/expiring, with read/write/close scopes and project allowlist. Closing and creating work are separately grantable; least privilege is the default. | “Autonomous” must never mean implicit workspace-wide authority. | High | Token/auth model, authorization policy, settings UI, MCP enforcement |
| Agent activity | Every agent action records credential/agent name, tool/action, target, timestamp and outcome in the same issue activity feed; security-sensitive use is also queryable at workspace level. | First-class attribution is essential to review autonomous work and is central to Issopen's thesis. | High | Immutable audit-event append path, actor model, request IDs |
| Human review | Keep accountable human ownership separate from an agent's active claim; make Ready for Review a semantic state and require explicit permission for an agent to move to Done. | Human responsibility should not disappear when an agent takes execution. Linear similarly distinguishes human assignment from agent delegation. | Medium | Issue assignment/claim model, permission checks, notifications |
| Result traceability | Attach branch, commit and PR as validated links/text metadata and show who added each result. No repository API is required. | A status change without a code/result reference is weak evidence for review. GitHub establishes branch/PR linking as normal issue behavior. | Low-Medium | Repository context, activity events |
| Community operations | Reproducible Docker Compose deployment, migrations, configurable PostgreSQL/object storage/auth/email, health check, upgrade/rollback and backup/restore documentation. No Issopen Cloud dependency. | “Self-hostable” is a feature contract, not a Dockerfile. Plane sets a high current bar for documented deployment. | High | Stable deployable, storage abstraction, release/version policy |
| Cloud operations | Tenant isolation, usage page, graceful capacity limits, rate limiting, private media, backups, error monitoring and a supportable deletion/export path. Existing readable data and text-only issue work must survive a capacity limit. | A permanent free service needs visible, predictable constraints without data hostage behavior. | High | Central plan config, metering, jobs, observability, recovery testing |

## Meaningful Issopen Differentiators

These should be designed and tested as product features, not left as marketing
phrases.

| Differentiator | V1 behavior | Value proposition | Complexity | Dependencies |
|----------------|-------------|-------------------|------------|--------------|
| Safe visual issue as an agent-ready packet | A single `get_issue` response joins the reporter's note, annotated image metadata, reviewed URL/browser/viewport data, selected element/sanitized DOM, repository context, activity and result links. | Reduces the clarification loop without capturing a whole browsing session. | High | Complete capture pipeline, shared domain DTO, signed media |
| Privacy review is core and open | Redaction/omission preview and DOM minimization ship in Community and Cloud Free, not as an enterprise add-on. | Trustworthy capture is more useful to maintainers than maximum passive telemetry. Marker.io documents sensitive-data masking as an Enterprise feature; Userback places advanced privacy controls in Business Plus. | High | Client-side capture/sanitization, policy tests |
| Separately governed external agents | Each agent connection has a human-readable identity, project allowlist and operation scopes; actions never collapse into the token owner's name. | Makes autonomous work reviewable and revocable while remaining BYO-agent/BYO-AI. | High | Agent credentials, authorization, activity log |
| Human owner + agent claimant | An issue can retain a responsible human/reviewer while showing which agent currently works it, with claim time and release/expiry behavior. | Prevents “assigned to bot” from erasing accountability and supports parallel human-agent work. | Medium-High | Actor/claim domain model, notifications, stale-claim policy |
| Mixed audit epics | Create an audit with title, goal, in-scope URLs/repository text, categories and optional instructions. Link ordinary issues/findings from people and agents; derive counts/progress by status, category and actor. | One place combines what humans see (visual quality, utility, flow) and what agents inspect (code, SEO, security, compliance). | High | Issues, filters, agent create permission, audit membership |
| Deterministic live audit summary | Show scope, progress, unresolved severity/priority, findings by category/source, blockers and linked results. Summary is computed from issues; no LLM or export is required. | Useful immediately and auditable; avoids paying for or trusting hidden inference. | Medium | Audit epic, issue fields/status, aggregation queries |
| Complete open vertical loop | Community and Cloud Free both include Kanban, safe capture, audits and basic MCP read/write. Self-hosted instances do not call proprietary Issopen services. | Combines the openness of Plane/BugDrop/Pindrop with a cohesive visual-to-agent tracker. | High operational commitment | Packaging, release discipline, capability-parity tests |
| Capacity-paid Cloud | Paid service increases managed storage, retention policy options, throughput, backup/restore support and operational assurances; it does not unlock closed product behavior. | Aligns revenue with real Cloud cost while giving open-source adopters a credible hosted path. | High business/operations | Metering, central plan policy, support and cost telemetry |

### Audit Epic: Minimal V1 Contract

An audit epic is not a generic hierarchy system. Keep the v1 shape explicit:

- title, goal and owner;
- project and scope notes (URLs/routes and repository text, not credentials);
- fixed initial categories: visual/UX, code quality, SEO, security and
  compliance, with `other` as an escape hatch;
- state: planned, active, review, complete;
- linked issues/findings, each retaining its normal priority, actor provenance,
  status, visual context and result links;
- derived progress and live summary;
- MCP can read audit scope and create/link findings only when the credential has
  the required project and create scopes;
- completion remains a human-visible decision; the product never presents an
  audit as a certification.

Do not build arbitrary parent/child issue trees, audit templates, scheduled
scanners or PDF exports to deliver this contract.

## V2 Candidates

Valuable after the primary loop is observed in real use; none should block the
v1 end-to-end validation.

| Candidate | Why defer | Complexity | Prerequisite / trigger |
|-----------|-----------|------------|------------------------|
| Remote MCP OAuth 2.1 with PKCE and discovery | Named scoped tokens are enough for an initial controlled release, but OAuth is the current smooth/safe Cloud standard used by Marker.io and Userback. | High | Public Cloud adoption across several MCP clients; follow the current MCP authorization spec |
| GitHub App with PR/branch sync and webhook-driven state | Manual links prove repository value without broad installation permissions or reconciliation edge cases. | High | Repeated demand and stable issue/result model |
| Public/guest capture widget | Competitors make no-login reporting excellent, but anonymous intake adds spam, consent, reporter identity and support workflows outside the maintainer-first loop. | High | Users need feedback from their own end users, not just collaborators |
| Full-page scrolling capture | Viewport and crop validate capture with fewer rendering/alignment problems. | High | Material share of reports require off-screen context |
| Console/network capture | Powerful for diagnosis but high privacy, filtering and payload complexity. | High | Explicit opt-in design and field/domain redaction proven |
| Short video or session replay | High storage/bandwidth/privacy cost; direct competitor strength does not make it necessary for Issopen's thesis. | Very High | Screenshots repeatedly fail to reproduce interaction bugs |
| Before/after verification evidence | Strategically valuable after agents already return reliable results. | High | Stable result links plus safe browser/test execution outside Issopen |
| Audit report export/share | A live internal summary should first prove value and reveal the required report shape. | Medium | Users complete audits and ask to share them externally |
| Audit templates and recurring audits | Risks becoming a workflow engine before one-off audits work. | Medium-High | Repeated audit patterns with stable categories and evidence |
| Issue relations, duplicates, sub-issues and templates | Useful tracker depth, but not needed for the core capture-agent loop. | Medium-High | Users cannot represent real work with issue + audit epic |
| Saved views, bulk edits and richer board configuration | Necessary only after issue volume makes simple filters inadequate. | Medium | Measured board/search friction |
| Slack/email digests and outgoing webhooks | Collaboration reach is useful but creates integration and delivery support burden. | Medium-High | Notification inbox/email no longer suffices |
| Firefox/Safari support | Separate extension behavior, packaging and test matrix. | High | Meaningful audience blocked by Chromium-only support |
| Import/export from GitHub/Linear/Plane | Reduces adoption friction later; mapping semantics too early can distort Issopen's domain. | High | Migration becomes a repeated sales/adoption blocker |
| Project-private human permissions, custom roles and approval policies | Enterprise/team governance is not the initial audience. | High | Workspaces with distinct teams and sensitive projects appear |
| Cloud billing UI and enterprise controls | Capacity can initially be operated with simple plan assignment; full billing/SSO/SCIM/compliance is premature. | High | Validated paid demand and operational readiness |

## Anti-Features

These are explicit exclusions. They protect the wedge and prevent Jira parity
or hosted-agent scope creep.

| Anti-feature | Why avoid in v1 | Do instead |
|--------------|-----------------|------------|
| Jira/Linear/Plane parity: sprints, cycles, estimates, Gantt, roadmap, multiple view builders, docs/wiki, OKRs | Generic trackers already do this better; it obscures the visual-agent loop. | One excellent Kanban, filters and audit-epic summary. |
| Hosted coding agents, LLM proxying, model billing or prompt orchestration | Transfers inference cost, execution security and reliability to Issopen. | BYO external agent over scoped MCP. |
| Repository cloning, indexing, vector database or stored source credentials | Creates a major secrets/supply-chain boundary and duplicates the agent's local checkout. | Store lightweight repository metadata; the external agent reads its own checkout. |
| Automatic code changes, deployments or unattended browser execution by Issopen | A tracker should coordinate and record work, not become a privileged CI/CD runtime. | Agent links branch/commit/PR; human reviews. |
| Full session replay, passive surveillance, automatic console/network/cookie/storage capture | Violates data minimization and drives storage/compliance cost. | Explicit viewport/crop and bounded, reviewed context. |
| Raw/full DOM capture | Likely to include PII, tokens and irrelevant data; expensive for agents. | Sanitized, bounded snippet chosen around an optional selected element. |
| Public attachment URLs | Leaks potentially sensitive product and customer data. | Authorization and short-lived signed access. |
| Anonymous public intake and customer feature portal | Spam, moderation and customer-feedback product scope do not validate the maintainer-first thesis. | Invited collaborators and authenticated extension in v1. |
| Surveys, NPS/CSAT, voting, announcements and public roadmap | Competes with Userback's feedback-management suite rather than solving issue execution. | Issues, comments and audit progress. |
| AI auto-title, rewrite, semantic dedupe or hidden triage service | Adds inference, privacy and explainability cost; external agents can perform explicit triage through MCP. | Keep capture structured and let a permitted actor edit transparently. |
| Complex workflow/custom-field/automation builder | Multiplies permissions, UI and MCP semantics before real needs exist. | Five semantic states, small priority enum, labels and explicit tools. |
| GitHub App and automatic two-way sync in v1 | Installation scopes, mapping conflicts and webhook failure modes can block the core demo. | Repository URL and explicit branch/commit/PR links. |
| Agent access inherited silently from its creator | Makes compromise and attribution hard to reason about. | Named, revocable, project-scoped credentials with least privilege. |
| Agent marks Done by default | Conflates implementation with acceptance. | Ready for Review by default; Done requires explicit close permission. |
| Paywall on MCP, safe redaction, audits or old issue history | Breaks the open/full-loop promise and creates data hostage behavior like time-limited visibility. | Meter creation/storage/throughput; retain read/export paths and sell managed capacity/operations. |
| “Unlimited forever” Cloud promises | Visual storage, egress and abuse have real variable cost. | Publish understandable, centrally configured capacity limits without hard-coding speculative numbers in product architecture. |
| Closed Cloud-only product modules | Conflicts with the all-open-source decision and creates edition drift. | Same product code; Cloud-specific operational configuration and service levels only. |
| Kubernetes, microservices, multi-region and enterprise compliance in product v1 | No validated scale or enterprise buyer justifies them. | One deployable backend and reproducible Community Compose. |
| Native mobile/desktop apps and non-Chromium extensions | Large support surface unrelated to the first workflow. | Responsive web plus Chromium extension. |

## Feature Dependencies

```text
Authentication -> workspace membership -> project authorization
Project -> semantic Kanban -> persistent issues -> comments/activity
Issues -> private attachments -> basic viewport/crop capture
Basic capture -> element picker + sanitizer -> review/redaction -> annotations

Actor model -> named agent credential -> scoped MCP read -> scoped MCP write
MCP write + activity -> agent claim -> Ready for Review -> human closure

Issues + actor provenance -> audit epic -> agent-created findings -> live audit summary

Central plan policy + attachment metering -> graceful Cloud limits
Stable deployable + migrations + storage abstraction -> Community release
Complete vertical loop + security/operability -> public Cloud Free
```

The ordering constraint that matters most is: **do not build extension capture
before private attachments and issue persistence, and do not build MCP write
before actor attribution and authorization.** Otherwise the first demo will
create security and data-model rewrites.

## Recommended V1 Cut

Prioritize these vertical outcomes:

1. **Useful tracker:** login, personal workspace, project/repository context,
   issue detail, comments/activity, semantic Kanban, filters and minimal
   notifications.
2. **Safe visual evidence:** private attachments, Chromium viewport/crop,
   element context, preview/redaction, annotations and reliable submission.
3. **Agent reads safely:** named credential, project/scopes, MCP list/get and
   signed attachment access, verified with real Codex and Claude Code clients.
4. **Agent works traceably:** create/claim/comment/transition/link result,
   separate human owner, Ready for Review notification and attributable log.
5. **Audits combine both sides:** scoped audit epic, human/agent findings and
   deterministic live summary.
6. **Credible distribution:** repeatable Community deployment plus Cloud Free
   metering, graceful limits, backups, isolation and operational monitoring.

The activation metric should be:

> A person submits a reviewed visual issue and a named external agent reads or
> updates it through MCP, after which a person reviews the result.

Do not use signup, raw capture count or MCP connection alone as proof of the
product thesis.

## Cloud Free and Capacity-Paid Model

### Recommended contract

- Community contains the complete product and supports administrator-defined
  limits; it has no license check against Issopen Cloud.
- Cloud Free permanently includes at least one usable path through project,
  safe visual capture, issue, audit and MCP read/write.
- Paid Cloud expands active capacity, storage, capture/attachment throughput,
  configurable retention and managed operational assurances such as support
  and recovery objectives.
- Limits are centrally configured and enforced by the API, with a visible
  usage page and warnings before enforcement.
- At a limit, existing data remains readable; comments/text issues continue
  where their cost is negligible; archiving/deletion/export remain available;
  only the capacity-increasing operation is blocked.
- Do not promise exact quotas until cost telemetry exists for database rows,
  object storage, egress, image processing, logs and MCP/API traffic.

### Why this can work

BugHerd and Marker.io currently lead with trials and paid subscriptions;
Userback's free plan allows collection but locks feedback from view after seven
days. Plane proves that AGPL Community plus Cloud Free can be an adoption path,
while BugDrop and Pindrop show demand for open visual tooling. Issopen can occupy
the intersection if its hosted costs stay dominated by bounded screenshots and
ordinary CRUD rather than video, replay or inference.

### Principal risk

“All features open” removes feature gating as a monetization lever. The service
must therefore be operationally easier and more trustworthy than self-hosting,
and paid capacity must correspond to actual cost. Instrument unit economics
before choosing quotas; otherwise Cloud Free can become either unusably small
or financially unsafe.

## Research Flags

- **MCP authorization:** PAT-style named credentials fit the initial brief, but
  current competitors use OAuth and the current MCP authorization specification
  expects OAuth 2.1 patterns for protected HTTP servers. Research this before a
  broad Cloud beta, not after client-specific incompatibilities appear.
- **Agent identity gap:** validate whether target users understand and value a
  distinct agent identity/project allowlist over account-scoped OAuth. Public
  competitor docs are insufficient to prove the gap.
- **Capture privacy:** prototype and test the sanitizer/redaction UX against
  forms, contenteditable, iframes, shadow DOM, canvas and authenticated apps.
  Browser constraints will determine the honest support contract.
- **Audit semantics:** interview maintainers who perform actual code/SEO/
  security reviews. Fixed categories are a useful starting hypothesis, not a
  compliance taxonomy.
- **Cloud economics:** obtain real image sizes, egress, retention and MCP call
  distributions before publishing limits or prices.
- **License:** AGPLv3 remains a legal/product decision to validate; feature
  research cannot settle compatibility or contributor-policy questions.

## Sources

### Visual-feedback products (first party)

- [BugHerd features](https://bugherd.com/features) — point/click capture,
  screenshot metadata, Kanban, collaboration, integrations and MCP (HIGH).
- [BugHerd MCP](https://bugherd.com/feature/mcp) — current read/write tool
  surface, agent workflow and beta availability (HIGH).
- [BugHerd pricing](https://bugherd.com/pricing) — paid-plan baseline and
  included MCP (HIGH).
- [Marker.io product tour](https://marker.io/features) — widget/extension,
  technical context, integrations, replay and collaboration (HIGH).
- [Marker.io MCP documentation](https://help.marker.io/en/articles/14034657-mcp-integration-model-context-protocol)
  — OAuth/token auth and current tool surface (HIGH).
- [Marker.io pricing](https://marker.io/pricing) — trial/paid model and feature
  tiers (HIGH).
- [Marker.io sensitive-data masking](https://help.marker.io/en/articles/9657817-sensitive-data-masking)
  — client-side masking behavior and Enterprise availability (HIGH).
- [Userback features](https://userback.io/features/) — feedback collection,
  visual context, collaboration, portals and MCP (HIGH).
- [Userback MCP](https://userback.io/feature/mcp-integration/) — OAuth,
  read/search/write behavior and workspace-permission statement (HIGH).
- [Userback pricing](https://userback.io/pricing/) — permanent Free terms,
  seven-day feedback availability, paid MCP and privacy tiers (HIGH).

### Open-source and agent-native alternatives (first party/canonical)

- [Plane open source](https://plane.so/open-source) and
  [Plane AI](https://plane.so/ai) — AGPL Community, Cloud Free, rich project
  management, MCP and agent activity (HIGH for stated product capabilities).
- [Plane canonical repository](https://github.com/makeplane/plane) (HIGH).
- [BugDrop](https://bugdrop.dev/) — MIT visual feedback directly to GitHub
  Issues with no separate dashboard (HIGH).
- [Pindrop.js](https://pindropjs.com/) — MIT local-first DOM annotation with
  adapters/export and advertised agent use (HIGH for stated capabilities).
- [AgentEcho canonical repository](https://github.com/Areshkew/agentecho) —
  element markers and AI-ready Markdown; explicitly source-available under a
  noncommercial license rather than open source (HIGH).

### Expected issue and protocol behavior (official)

- [Linear: creating issues](https://linear.app/docs/creating-issues),
  [priority](https://linear.app/docs/priority),
  [assignment/delegation](https://linear.app/docs/assigning-issues) and
  [notifications](https://linear.app/docs/notifications) (HIGH).
- [GitHub: creating issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue),
  [Projects/boards](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects),
  [milestone progress](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/about-milestones) and
  [linking pull requests](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue) (HIGH).
- [Model Context Protocol authorization](https://modelcontextprotocol.io/specification/draft/basic/authorization)
  — current draft expectations for protected HTTP servers, OAuth discovery,
  audience validation and scopes (HIGH for protocol direction; the linked page
  is a draft and must be rechecked at implementation time).

