# SPEC-PORTALS-001 — Adversarial Review Findings

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| Artifact | `docs/engineering/specs/SPEC-PORTALS-001-multi-portal-vision.md` (v0.1, 2026-08-14) |
| Reviewed against | SRS (34) "User Roles" + "MVP Scope" · 32_ACCESS_CONTROL_BIBLE · DSF-KIT-001 · the 9-point review contract |
| Date     | 2026-08-15                                                         |
| Result   | 17 issues (4 marked speculative: #5, #8, #13, #17)                 |

## Issues

**1. D2's portal priority list contradicts P5's own decision that Deputy is not a portal. (§2 D2 vs §3 P5)**
The priority chain is "Platform Super Admin > Head > Deputy > School Admin > Teacher > Student > Parent". P5 explicitly decides Deputy is *not* a sixth portal — Deputies enter the Head shell under delegation. So "Deputy" cannot be a distinct target in a portal-priority ordering; a Deputy resolving portals would resolve *Head (delegation-scoped)*, not "Deputy". The list also omits School Owner and Platform Support entirely, even though both appear in the §4 matrix as landing somewhere. Violates contract 9 (internal consistency) and weakens contract 5 (the routing algorithm is underspecified for real role combinations).

**2. The routing pipeline cannot route the Super Admin at all. (§2 D2)**
The pipeline is strictly sequential: authn → MFA → *resolve tenant memberships* → tenant picker → *resolve portal capabilities within tenant* → enter portal. A Super Admin (and Platform Support) has no tenant membership — `/platform` is not "within tenant". As written, steps 3–5 dead-end for exactly the highest-priority role in the system. The platform-capability check must occur outside/before tenancy resolution, and the spec never says so. Violates contract 3 (layered model applied incorrectly to the platform context) and contract 9.

**3. "Auto-enter highest-priority" and "persist last-portal preference" coexist with no precedence rule, and the §4 matrix contradicts both. (§2 D2 steps 6–7 vs §4)**
Step 6 says >1 capability → auto-enter *highest-priority* portal (chooser only on first login); step 7 persists *last-portal* per user × tenant. On the second login, which wins — the persisted preference or the priority order? Never stated. Concretely: the §4 matrix says School Owner's landing portal is School Admin even when Head is "also available (if granted)", but D2's priority order (Head > School Admin) says such an Owner auto-enters Head. Two sections give different answers for the same user. Violates contracts 5 and 9. Note the teacher-mode analogue (D1) explicitly resolves this with "last-used" — the portal-level rule doesn't.

**4. Platform billing/entitlements/metering is silently invented beyond SRS MVP scope. (§1 Assumption 4, §3 P1, §6 Phase 1a, §8)**
Contract 2 pins scope to the SRS *MVP In Scope* list. That list contains tenant onboarding but **not** subscription plans, entitlements, feature flags, or metering — those appear only in the SRS "Functional Requirements → Tenant And Billing" section, which is not the MVP scope list. The spec correctly flags Student portal and timetable as SRS amendments, but ships "manual plan & entitlement assignment" and metering views in Phase 1a with no SRS amendment; the §8 checklist's SRS-amendment item covers only "Student portal scope; timetable module". Same rigor, inconsistently applied — this is exactly the "silently invented" scope the contract forbids.

**5. "At-risk students" KPI is unscoped and potentially collides with the SRS high-risk-AI rule. (§3 P4 JTBD 1)** *(partly speculative)*
"At-risk students" is not in MVP scope, and the SRS explicitly classifies "student predictions" as high-risk AI requiring evaluation, human review, and privacy controls. The spec neither marks this as an amendment nor states whether "at-risk" is rule-based or model-based, nor gates it on the AI review path. It hides behind "exactly the 07_DESIGN_SYSTEM Headmaster list" — citing a design doc doesn't grant SRS scope. Partly speculative (if it's a simple rule threshold, only the scope-marking issue remains), but the unstated assumption is itself the defect.

**6. The delegation field list drops two mandatory fields from the Access Control Bible. (§3 P5)**
P5 cites the delegation record as "(delegator, scope, permissions, expiry, reason — 32_ACCESS_CONTROL_BIBLE)". The Bible mandates seven fields: delegator, **delegatee**, scope, permissions, expiry, reason, **audit trail**. Omitting delegatee and audit trail in the very sentence that claims Bible compliance is precisely the overconfident paraphrase the contract 3 check exists to catch — a downstream ACF/DBF built from this spec would under-model the record.

**7. Teacher mode model ignores the "approved marks after lock" explicit deny. (§5)**
The Bible's explicit-deny list includes "teacher editing approved marks after lock", and the SRS says "approved marks must not be silently overwritten". §5's "Locked out" row covers only *unassigned* subjects/classes; Subject mode's core actions include "enter marks" with no lock/approved state in the mode model, and the read view ("subject performance snapshot after approval") implies awareness of the approval state without carrying the deny. The one deny case most relevant to this exact surface is unaddressed. Violates contract 3.

**8. Self-approval deny is missing for Head/Deputy who also teach. (§3 P4 + §4 matrix)** *(speculative extension)*
The matrix explicitly allows Deputy Headmaster to also hold Teacher capability (and School Owner to hold real teaching relationships). P4 grants marks approval. The Bible's deny pattern ("user approving own sensitive finance request") clearly generalizes, yet nothing denies a Deputy approving marks they themselves submitted in Teacher mode. Marked speculative because the Bible's literal deny is finance-scoped — but the spec claims to extend explicit denies (it invents one for students) and skips the one its own matrix makes reachable.

**9. D1's default-mode algorithm has an undefined branch. (§2 D1)**
Default mode: attendance pending → Class; marks window open → Subject; both → last-used. Not covered: **neither** condition true (weekends, holidays, exam-free periods, a teacher's first day) combined with no last-used preference (first login ever — where "both → last-used" also dereferences a value that doesn't exist). Contract 6 demands the default "from today's assignments" be well-defined; the most common state of a school day (no live capture window) falls through the algorithm.

**10. The audited-switch list is enumerated too narrowly for the finance least-privilege posture. (§2 D2)**
Audited switches are exactly: entering `/platform`, entering Head approvals, support-session entry. Switching into School Admin — which contains user/role management and the Fees office — is not on the list, even though the matrix marks Owner/Bursar actions "Hard (finance)" MFA and contract 7 declares finance least-privilege. A Headmaster hopping into School Admin (his "also available" portal) is a privileged-context switch under contract 5's own definition, yet unaudited by this spec.

**11. A draft spec unilaterally "supersedes" an accepted freeze provision without a named amendment path. (§2 D2, §7 Retire vs DSF-KIT-001 §4/IMP-050)**
IMP-050 (workspace switcher, student disabled hint) and the post-login routing rule ("`/auth/me` → admin vs teacher vs parent home") are part of the *accepted* DSF-KIT-001 v1.5 nav model. This v0.1 document, status "Awaiting Owner GO", states in present tense that it "supersedes IMP-050" and lists it under "Retire". Contract 4 requires divergences to route through explicit amendments — but the DSF-KIT-002 scope description (§2 D3, §8: "portal chrome model, brand deepening, portal identity marks, nav patterns per portal") never mentions IMP-050 retirement or replacing the frozen post-login routing rule. The change may be intended to land in DSF-KIT-002, but it isn't written there, so as specified the retirement bypasses the amendment.

**12. Head portal nav lists "Ripoti (Reports)" with no corresponding JTBD. (§3 P4)**
P4's six JTBD are: dashboard, approve/reject marks, exceptions, delegate, KPI drill, audit review. The nav adds a fifth section, Reports, backed by no job. Either a JTBD is missing (undercounted deliverable) or a nav section was invented beyond the jobs — contract 8 requires the portal map and IA to be the deliverable pair, and contract 9 forbids them contradicting. Which reports a Head sees also matters for the finance least-privilege line P4 itself draws.

**13. Head's "reconciliation exceptions" job conflicts with his own finance drill-down bar. (§3 P4 JTBD 3 vs JTBD 5 / Q7)** *(speculative)*
JTBD 5 and Q7's default deny the Head raw finance postings without a finance capability, but JTBD 3 has him reviewing reconciliation exceptions — a task that in practice requires seeing the mismatched payment attempts/postings behind the exception. The spec asserts "aggregate view" but never defines what an exception aggregate contains, so the least-privilege boundary is asserted, not specified.

**14. P7 (Parent) is missing its required deliverables. (§3 P7)**
Contract 8 requires per-portal ≤7 JTBD and an IA. P1–P4 and P6 have JTBD lists; P7 has neither a JTBD list nor a nav/IA — just "Keep DSF-006 scope" and a flow arrow. Pointing at DSF-006 may be defensible for scope, but the deliverable as contracted is not present in the artifact, and the "refinements" (child switcher prominence, honesty states) are UX changes with no IA to hang them on. P3's IA is similarly only implicit via §5's shell description.

**15. Three different MFA scopes are stated for the platform portal. (§1 Assumption 6 vs §3 P1 vs §4 matrix)**
Assumption 6: MFA hard gates extend "to all platform actions". P1: "hard-required for every **write**; step-up for destructive". Matrix: "Hard, **always**" (implying reads too). These are three different policies; whichever one the ACF-PLAT author picks, the other two sections contradict it. Contract 9.

**16. The §4 matrix presents Platform Support unconditionally while Q8's default excludes it from Phase 1. (§4 vs §9 Q8, §3 P1)**
Minor, but the matrix row carries no phase marker, so a reader implementing routing from the matrix would provision a role that P1 and Q8 defer. Contract 9.

**17. Load-bearing factual claims about the codebase are asserted without hedging or verification path. (§1 Assumption 5, §6 Phases 1a and 3)** *(speculative)*
"Platform Operations API is a skeleton", "API skeleton exists but needs contracts", "approvals API exists" — the phase ordering's rationale (why 1a is cheap, why Phase 3 is feasible) rests on these present-tense claims about current code. A spec-gate document should either cite where these are established (task record / IMP number, as it does elsewhere) or list them as assumptions to verify; Assumption 5 does the former only for the skeleton claim, and nothing supports "approvals API exists".

## Not found (checked and passed)

Contract 1 (no source code, migrations, or coding authorization — the nav trees are IA sketches; every phase names a freeze gate); assumptions count (8, within the 5–8 band); owner-question count (10, each with a default); JTBD caps (P1: 7, P2: 7, P3: 7, P4: 6, P6: 6 — all within limits); username-based routing (explicitly forbidden in D2); hard-coded tenant-isolation or token divergences (accent variation and new chrome are correctly routed to DSF-KIT-002, with the exception noted in issue 11).
