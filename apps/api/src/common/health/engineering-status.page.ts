/**
 * Read-only engineering status HTML (platform surface).
 * Not a product UI; does not implement Identity/Tenant business routes.
 */
export const ENGINEERING_STATUS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>EduCore — Engineering Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg0: #0c1412;
      --bg1: #14201c;
      --ink: #e8f0ec;
      --muted: #8aa396;
      --accent: #3d9b6e;
      --accent-dim: #2a6b4c;
      --warn: #c4a35a;
      --line: rgba(232, 240, 236, 0.12);
      --ok: #5ecf8e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "DM Sans", system-ui, sans-serif;
      background:
        radial-gradient(ellipse 80% 50% at 10% -10%, rgba(61, 155, 110, 0.22), transparent 55%),
        radial-gradient(ellipse 60% 40% at 90% 10%, rgba(196, 163, 90, 0.1), transparent 50%),
        linear-gradient(165deg, var(--bg0), var(--bg1) 40%, #0a1210);
      color: var(--ink);
      min-height: 100vh;
      line-height: 1.5;
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 2.5rem 1.5rem 4rem; }
    header { margin-bottom: 2.75rem; animation: rise 0.7s ease-out both; }
    .brand {
      font-family: "Instrument Serif", Georgia, serif;
      font-size: clamp(2.75rem, 8vw, 4.25rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.05;
    }
    .brand em { font-style: italic; color: var(--accent); }
    .tagline {
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: 1.05rem;
      max-width: 36rem;
    }
    .badge {
      display: inline-block;
      margin-top: 1.25rem;
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--warn);
      border-bottom: 1px solid var(--warn);
      padding-bottom: 0.15rem;
      animation: rise 0.7s ease-out 0.15s both;
    }
    section {
      padding: 1.75rem 0;
      border-top: 1px solid var(--line);
      animation: rise 0.7s ease-out both;
    }
    section:nth-of-type(1) { animation-delay: 0.2s; }
    section:nth-of-type(2) { animation-delay: 0.3s; }
    section:nth-of-type(3) { animation-delay: 0.4s; }
    section:nth-of-type(4) { animation-delay: 0.5s; }
    h2 {
      font-family: "Instrument Serif", Georgia, serif;
      font-size: 1.65rem;
      font-weight: 400;
      margin-bottom: 0.5rem;
    }
    .sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 1.1rem; }
    ul { list-style: none; }
    li {
      padding: 0.55rem 0;
      border-bottom: 1px solid var(--line);
      display: grid;
      grid-template-columns: 1.1rem 1fr;
      gap: 0.75rem;
      align-items: start;
      font-size: 0.98rem;
    }
    li:last-child { border-bottom: none; }
    .dot {
      width: 0.55rem; height: 0.55rem;
      border-radius: 50%;
      margin-top: 0.45rem;
      background: var(--ok);
      box-shadow: 0 0 0 3px rgba(94, 207, 142, 0.15);
    }
    .dot.off { background: var(--muted); box-shadow: none; }
    .dot.warn { background: var(--warn); box-shadow: 0 0 0 3px rgba(196, 163, 90, 0.15); }
    .links {
      display: flex; flex-wrap: wrap; gap: 0.75rem;
      margin-top: 0.5rem;
    }
    a.cta {
      display: inline-flex; align-items: center;
      padding: 0.65rem 1.1rem;
      background: var(--accent);
      color: #06120c;
      text-decoration: none;
      font-weight: 700;
      font-size: 0.9rem;
      transition: background 0.2s ease, transform 0.2s ease;
    }
    a.cta:hover { background: #4cb57f; transform: translateY(-1px); }
    a.ghost {
      display: inline-flex; align-items: center;
      padding: 0.65rem 1.1rem;
      color: var(--ink);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
      border: 1px solid var(--line);
      transition: border-color 0.2s ease;
    }
    a.ghost:hover { border-color: var(--accent); }
    footer {
      margin-top: 2.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--line);
      color: var(--muted);
      font-size: 0.85rem;
      animation: rise 0.7s ease-out 0.6s both;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <p class="brand">Edu<em>Core</em></p>
      <p class="tagline">
        Engineering status board for the Identity &amp; Tenant foundation —
        Freeze v1.0 accepted under solo-operator consolidation (SOLO-GOV-001).
      </p>
      <p class="badge">DBF-001 + ACF-001 · Accepted v1.0 (solo-operator) · Product CRUD still gated</p>
    </header>

    <section>
      <h2>Live platform</h2>
      <p class="sub">NestJS API skeleton is running. Probe these endpoints.</p>
      <div class="links">
        <a class="cta" href="/health">/health</a>
        <a class="ghost" href="/ready">/ready</a>
      </div>
    </section>

    <section>
      <h2>Built so far</h2>
      <p class="sub">API + persistence foundation. Product SPA (<code>apps/web</code>) is still empty.</p>
      <ul>
        <li><span class="dot"></span><span>PostgreSQL migrations: tenants, users, memberships, RBAC, sessions</span></li>
        <li><span class="dot"></span><span>RLS hardening + live isolation evidence (AUDIT-R2)</span></li>
        <li><span class="dot"></span><span>P2 request platform: auth/tenant middleware, error envelope, correlation IDs</span></li>
        <li><span class="dot"></span><span>DB-backed TenantMembershipChecker + RequireActiveMembership guard</span></li>
        <li><span class="dot"></span><span>PgPermissionSource (roles → permission codes) behind MembershipAware gate</span></li>
        <li><span class="dot"></span><span>P3 AuthN API: POST /api/v1/auth/login · refresh · logout · me · select-tenant</span></li>
        <li><span class="dot"></span><span>P4 RBAC: system roles (owner/admin/staff/bursar/parent), RequirePermission, PolicyEvaluator, /auth/me permissions</span></li>
        <li><span class="dot"></span><span>P4b: session↔header tenant bind; P4c me() RBAC consistency; P4d fail-closed warn logs</span></li>
        <li><span class="dot"></span><span>P5 product read: GET /tenants · /tenants/current · /tenants/{id}</span></li>
        <li><span class="dot"></span><span>Governance: SOLO-GOV-001 · DBF/ACF Freeze v1.0 (solo-operator) · ADR-012 superseded for sequencing</span></li>
        <li><span class="dot"></span><span>CI quality gate + module boundary checks</span></li>
      </ul>
    </section>

    <section>
      <h2>Still closed</h2>
      <p class="sub">No product web UI yet; domain CRUD remains implementation-gated (freezes accept design, not every route).</p>
      <ul>
        <li><span class="dot off"></span><span>Product web app / login screen (apps/web is empty)</span></li>
        <li><span class="dot off"></span><span>MFA flows</span></li>
        <li><span class="dot off"></span><span>Tenant create / update / delete APIs</span></li>
        <li><span class="dot off"></span><span>Role / permission admin APIs (role.manage HTTP)</span></li>
        <li><span class="dot off"></span><span>Membership invite APIs</span></li>
        <li><span class="dot off"></span><span>Student, Finance, Attendance, and other domain UIs</span></li>
      </ul>
    </section>

    <section>
      <h2>Governance</h2>
      <p class="sub">Solo-operator closure 2026-07-16 (theoretical role seats consolidated).</p>
      <ul>
        <li><span class="dot"></span><span>ADR-012 countersignatures complete (acting DBA / SEC / BE)</span></li>
        <li><span class="dot"></span><span>DBF-001 + ACF-001 Freeze v1.0 accepted (solo-operator)</span></li>
        <li><span class="dot"></span><span>Outbox external send cancelled — see SOLO-GOV-001</span></li>
        <li><span class="dot warn"></span><span>Residual: not independent multi-person peer review; product CRUD still gated</span></li>
      </ul>
    </section>

    <footer>
      EduCore engineering status · platform page only · Solo-operator Freeze v1.0 (SOLO-GOV-001)
    </footer>
  </div>
</body>
</html>
`;
