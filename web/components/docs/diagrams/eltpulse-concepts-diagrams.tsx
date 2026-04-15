/**
 * Static SVG diagrams for /docs/concepts — entity relationships and egress-only architecture.
 * Strokes use currentColor for light/dark via parent text color.
 */

export function EntityRelationshipDiagram() {
  return (
    <figure className="not-prose my-8 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
      <svg
        viewBox="0 0 780 440"
        className="mx-auto h-auto w-full min-w-[680px] max-w-[780px]"
        role="img"
        aria-labelledby="er-title er-desc"
      >
        <title id="er-title">How pipelines, connections, monitors, runs, and gateways relate</title>
        <desc id="er-desc">
          Pipelines and monitors reference connections by foreign keys. Runs belong to pipelines. The gateway uses the
          control plane API only.
        </desc>
        <defs>
          <marker id="er-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" className="opacity-70" />
          </marker>
        </defs>

        {/* Connection — centered hub */}
        <rect x="310" y="152" width="168" height="76" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="310" y="152" width="168" height="76" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="394" y="186" textAnchor="middle" className="fill-current text-[13px] font-semibold">
          Connection
        </text>
        <text x="394" y="206" textAnchor="middle" className="fill-current text-[10px] opacity-80">
          named profile + optional secrets
        </text>

        {/* Pipeline */}
        <rect x="40" y="40" width="148" height="68" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="40" y="40" width="148" height="68" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="114" y="70" textAnchor="middle" className="fill-current text-[13px] font-semibold">
          Pipeline
        </text>
        <text x="114" y="90" textAnchor="middle" className="fill-current text-[10px] opacity-80">
          definition (Neon)
        </text>

        <path
          d="M 188 74 L 250 74 L 250 190 L 310 190"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#er-arrow)"
          className="opacity-70"
        />
        <rect x="198" y="20" width="164" height="44" rx="6" fill="currentColor" className="opacity-[0.12]" />
        <text x="280" y="36" textAnchor="middle" className="fill-current text-[9px] font-semibold opacity-90">
          sourceConnectionId
        </text>
        <text x="280" y="50" textAnchor="middle" className="fill-current text-[9px] font-semibold opacity-90">
          destinationConnectionId (FK)
        </text>

        {/* Run */}
        <rect x="40" y="258" width="148" height="68" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="40" y="258" width="148" height="68" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="114" y="288" textAnchor="middle" className="fill-current text-[13px] font-semibold">
          Run
        </text>
        <text x="114" y="308" textAnchor="middle" className="fill-current text-[10px] opacity-80">
          one execution (Neon)
        </text>

        <path
          d="M 114 108 L 114 258"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#er-arrow)"
          className="opacity-70"
        />
        <text x="126" y="188" className="fill-current text-[10px] opacity-90">
          instance of
        </text>

        {/* Monitor */}
        <rect x="592" y="40" width="148" height="68" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="592" y="40" width="148" height="68" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="666" y="70" textAnchor="middle" className="fill-current text-[13px] font-semibold">
          Monitor
        </text>
        <text x="666" y="90" textAnchor="middle" className="fill-current text-[10px] opacity-80">
          sensor (Neon)
        </text>

        <path
          d="M 592 74 L 530 74 L 530 190 L 478 190"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#er-arrow)"
          className="opacity-70"
        />
        <rect x="520" y="20" width="112" height="44" rx="6" fill="currentColor" className="opacity-[0.12]" />
        <text x="576" y="38" textAnchor="middle" className="fill-current text-[9px] font-semibold opacity-90">
          connectionId
        </text>
        <text x="576" y="52" textAnchor="middle" className="fill-current text-[9px] font-semibold opacity-90">
          (FK)
        </text>

        <path
          d="M 666 108 L 666 292 L 188 292"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          markerEnd="url(#er-arrow)"
          className="opacity-70"
        />
        <text x="430" y="282" textAnchor="middle" className="fill-current text-[10px] opacity-90">
          enqueues run (pipelineName → pipeline)
        </text>

        {/* Gateway */}
        <rect x="36" y="342" width="156" height="80" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="36" y="342" width="156" height="80" rx="10" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="114" y="370" textAnchor="middle" className="fill-current text-[12px] font-semibold">
          Gateway
        </text>
        <text x="114" y="392" textAnchor="middle" className="fill-current text-[9px] opacity-80">
          Bearer = AgentToken
        </text>
        <text x="114" y="408" textAnchor="middle" className="fill-current text-[9px] opacity-80">
          HTTPS to API only
        </text>

        {/* Control plane */}
        <rect x="220" y="338" width="524" height="88" rx="10" fill="currentColor" className="opacity-[0.12]" />
        <rect x="220" y="338" width="524" height="88" rx="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        <text x="482" y="368" textAnchor="middle" className="fill-current text-[12px] font-semibold">
          eltPulse control plane (Next.js API + Neon)
        </text>
        <text x="482" y="392" textAnchor="middle" className="fill-current text-[10px] opacity-80">
          persists pipelines, runs, monitors, connections · serves /api/agent/*
        </text>
        <text x="482" y="412" textAnchor="middle" className="fill-current text-[9px] opacity-75">
          Gateway never connects to Postgres; it uses JSON APIs over TLS.
        </text>

        <path
          d="M 192 382 L 220 382"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          markerEnd="url(#er-arrow)"
          className="opacity-80"
        />
        <text x="206" y="332" textAnchor="middle" className="fill-current text-[8px] opacity-85">
          manifest · runs · connections · heartbeat · monitor report
        </text>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-slate-600 dark:text-slate-400">
        Pipelines and monitors link to connections by <strong>foreign keys</strong>. The gateway loads connection
        payloads <strong>through the API</strong>, not by talking to Neon.
      </figcaption>
    </figure>
  );
}

export function ArchitectureEgressDiagram() {
  return (
    <figure className="not-prose my-8 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
      <svg
        viewBox="0 0 1040 620"
        className="mx-auto h-auto w-full min-w-[720px] max-w-[1040px]"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Where work runs: eltPulse-hosted vs customer gateway, egress-only</title>
        <desc id="arch-desc">
          Three columns: your network, the HTTPS control-plane link (TLS, JSON APIs, auth), and eltPulse hosted. No
          inbound from eltPulse to your VPC. Separate egress to your data plane.
        </desc>
        <defs>
          <marker id="arch-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" className="opacity-80" />
          </marker>
        </defs>

        {/* ——— Column 1: YOUR NETWORK ——— */}
        <rect x="16" y="20" width="300" height="580" rx="14" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-45" />
        <text x="166" y="46" textAnchor="middle" className="fill-current text-[11px] font-bold tracking-wide opacity-90">
          YOUR NETWORK
        </text>
        <text x="166" y="62" textAnchor="middle" className="fill-current text-[9px] opacity-65">
          VPC · cluster · laptop
        </text>

        <rect x="36" y="78" width="260" height="102" rx="10" fill="currentColor" className="opacity-[0.08]" />
        <rect x="36" y="78" width="260" height="102" rx="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="166" y="108" textAnchor="middle" className="fill-current text-[12px] font-semibold">
          Gateway (long-lived)
        </text>
        <text x="166" y="132" textAnchor="middle" className="fill-current text-[9px] opacity-80">
          polls manifest · runs · heartbeats
        </text>
        <text x="166" y="152" textAnchor="middle" className="fill-current text-[9px] opacity-80">
          optional: monitors · dispatch workers
        </text>

        <rect x="36" y="198" width="260" height="88" rx="10" fill="currentColor" className="opacity-[0.06]" />
        <rect x="36" y="198" width="260" height="88" rx="10" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 4" className="opacity-55" />
        <text x="166" y="228" textAnchor="middle" className="fill-current text-[11px] font-semibold opacity-90">
          Run workers (optional)
        </text>
        <text x="166" y="252" textAnchor="middle" className="fill-current text-[9px] opacity-75">
          ECS / K8s Job / docker — eltPulse connectors, your code
        </text>

        <rect x="36" y="306" width="260" height="158" rx="10" fill="currentColor" className="opacity-[0.06]" />
        <rect x="36" y="306" width="260" height="158" rx="10" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="5 4" className="opacity-55" />
        <text x="166" y="338" textAnchor="middle" className="fill-current text-[11px] font-semibold opacity-90">
          Data plane (your accounts)
        </text>
        <text x="166" y="364" textAnchor="middle" className="fill-current text-[9px] opacity-75">
          Snowflake · S3 · Postgres…
        </text>
        <text x="166" y="388" textAnchor="middle" className="fill-current text-[9px] opacity-65">
          Separate TLS egress from here
        </text>
        <text x="166" y="408" textAnchor="middle" className="fill-current text-[9px] opacity-65">
          — not through eltPulse
        </text>
        <text x="166" y="436" textAnchor="middle" className="fill-current text-[8px] opacity-55">
          Warehouse bulk stays out of band
        </text>

        <path
          d="M 166 180 L 166 198"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          markerEnd="url(#arch-arrow)"
          className="opacity-45"
        />
        <path
          d="M 166 286 L 166 306"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          markerEnd="url(#arch-arrow)"
          className="opacity-45"
        />

        {/* ——— Column 2: THE GAP — what crosses it (3 boxes) ——— */}
        <rect x="332" y="20" width="376" height="580" rx="14" fill="currentColor" className="opacity-[0.07]" />
        <rect x="332" y="20" width="376" height="580" rx="14" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" className="opacity-55" />
        <text x="520" y="46" textAnchor="middle" className="fill-current text-[11px] font-bold tracking-wide opacity-90">
          THE GAP — CONTROL PLANE ONLY
        </text>
        <text x="520" y="64" textAnchor="middle" className="fill-current text-[8px] opacity-65">
          Nothing else crosses this strip · your gateway opens TLS outward
        </text>

        {/* Three equal boxes in a row */}
        <rect x="348" y="84" width="108" height="128" rx="8" fill="currentColor" className="opacity-[0.12]" />
        <rect x="348" y="84" width="108" height="128" rx="8" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-70" />
        <text x="402" y="104" textAnchor="middle" className="fill-current text-[9px] font-semibold">
          1 · Transport
        </text>
        <text x="402" y="124" textAnchor="middle" className="fill-current text-[8px] opacity-90">
          HTTPS egress
        </text>
        <text x="402" y="142" textAnchor="middle" className="fill-current text-[8px] opacity-85">
          TLS you initiate
        </text>
        <text x="402" y="164" textAnchor="middle" className="fill-current text-[7px] opacity-75">
          to eltPulse app
        </text>
        <text x="402" y="182" textAnchor="middle" className="fill-current text-[7px] opacity-75">
          origin only
        </text>

        <rect x="466" y="84" width="108" height="128" rx="8" fill="currentColor" className="opacity-[0.12]" />
        <rect x="466" y="84" width="108" height="128" rx="8" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-70" />
        <text x="520" y="104" textAnchor="middle" className="fill-current text-[9px] font-semibold">
          2 · JSON APIs
        </text>
        <text x="520" y="126" textAnchor="middle" className="fill-current text-[7px] opacity-88">
          manifest · runs
        </text>
        <text x="520" y="142" textAnchor="middle" className="fill-current text-[7px] opacity-88">
          connections · hb
        </text>
        <text x="520" y="158" textAnchor="middle" className="fill-current text-[7px] opacity-88">
          monitor report
        </text>
        <text x="520" y="180" textAnchor="middle" className="fill-current text-[7px] opacity-72">
          GET/PATCH where
        </text>
        <text x="520" y="196" textAnchor="middle" className="fill-current text-[7px] opacity-72">
          applicable
        </text>

        <rect x="584" y="84" width="108" height="128" rx="8" fill="currentColor" className="opacity-[0.12]" />
        <rect x="584" y="84" width="108" height="128" rx="8" fill="none" stroke="currentColor" strokeWidth="1.25" className="opacity-70" />
        <text x="638" y="104" textAnchor="middle" className="fill-current text-[9px] font-semibold">
          3 · Auth &amp; scope
        </text>
        <text x="638" y="126" textAnchor="middle" className="fill-current text-[7px] opacity-88">
          Bearer = gateway
        </text>
        <text x="638" y="142" textAnchor="middle" className="fill-current text-[7px] opacity-88">
          token only
        </text>
        <text x="638" y="164" textAnchor="middle" className="fill-current text-[7px] opacity-75">
          No pipeline code
        </text>
        <text x="638" y="180" textAnchor="middle" className="fill-current text-[7px] opacity-75">
          No warehouse bulk
        </text>
        <text x="638" y="198" textAnchor="middle" className="fill-current text-[7px] opacity-75">
          on this path
        </text>

        <rect x="348" y="228" width="344" height="52" rx="8" fill="currentColor" className="opacity-[0.1]" />
        <rect x="348" y="228" width="344" height="52" rx="8" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />
        <text x="520" y="252" textAnchor="middle" className="fill-current text-[9px] font-semibold opacity-80">
          No inbound from eltPulse into your VPC
        </text>
        <text x="520" y="268" textAnchor="middle" className="fill-current text-[8px] opacity-65">
          eltPulse never originates connections to your private network for runs or monitors
        </text>

        {/* Ingestion note — inside middle column, lower */}
        <path
          d="M 166 386 Q 260 460 348 500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeDasharray="5 4"
          markerEnd="url(#arch-arrow)"
          className="opacity-45"
        />
        <text x="268" y="488" className="fill-current text-[8px] opacity-70">
          ingestion → warehouse / sources (separate path)
        </text>

        {/* Horizontal arrows: col1 → col2 → col3 (gateway row) */}
        <path
          d="M 296 129 L 332 129"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          markerEnd="url(#arch-arrow)"
        />
        <path
          d="M 708 129 L 724 129"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          markerEnd="url(#arch-arrow)"
        />

        {/* ——— Column 3: ELTPULSE HOSTED ——— */}
        <rect x="724" y="20" width="300" height="580" rx="14" fill="currentColor" className="opacity-[0.05]" />
        <rect x="724" y="20" width="300" height="580" rx="14" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-45" />
        <text x="874" y="46" textAnchor="middle" className="fill-current text-[11px] font-bold tracking-wide opacity-90">
          ELTPULSE HOSTED
        </text>
        <text x="874" y="62" textAnchor="middle" className="fill-current text-[9px] opacity-65">
          e.g. Vercel + Neon
        </text>

        <rect x="744" y="78" width="260" height="72" rx="8" fill="currentColor" className="opacity-[0.09]" />
        <rect x="744" y="78" width="260" height="72" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="874" y="106" textAnchor="middle" className="fill-current text-[11px] font-semibold">
          Next.js API
        </text>
        <text x="874" y="128" textAnchor="middle" className="fill-current text-[8px] opacity-75">
          /api/agent/* · Clerk · webhooks
        </text>

        <rect x="744" y="164" width="260" height="64" rx="8" fill="currentColor" className="opacity-[0.09]" />
        <rect x="744" y="164" width="260" height="64" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="874" y="190" textAnchor="middle" className="fill-current text-[11px] font-semibold">
          Postgres (Neon)
        </text>
        <text x="874" y="210" textAnchor="middle" className="fill-current text-[8px] opacity-75">
          pipelines · runs · connections…
        </text>

        <rect x="744" y="242" width="260" height="56" rx="8" fill="currentColor" className="opacity-[0.08]" />
        <rect x="744" y="242" width="260" height="56" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="874" y="266" textAnchor="middle" className="fill-current text-[10px] font-semibold">
          Cloud cron (managed monitors)
        </text>
        <text x="874" y="286" textAnchor="middle" className="fill-current text-[8px] opacity-72">
          S3/SQS when Runs on = eltPulse-managed
        </text>

        <rect x="744" y="312" width="260" height="76" rx="8" fill="currentColor" className="opacity-[0.06]" />
        <rect x="744" y="312" width="260" height="76" rx="8" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" className="opacity-50" />
        <text x="874" y="338" textAnchor="middle" className="fill-current text-[10px] font-semibold opacity-90">
          Managed workers
        </text>
        <text x="874" y="358" textAnchor="middle" className="fill-current text-[8px] opacity-68">
          future — queue consumers for
        </text>
        <text x="874" y="374" textAnchor="middle" className="fill-current text-[8px] opacity-68">
          eltpulse_managed runs
        </text>

        <text x="874" y="430" textAnchor="middle" className="fill-current text-[9px] opacity-68">
          No listener required in your network
        </text>
      </svg>
      <figcaption className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <p>
          <strong>Reading the diagram:</strong> three columns — your network, the <strong>control-plane gap</strong>{" "}
          (three boxes: transport, JSON APIs, auth/scope), then eltPulse hosted. Arrows at gateway height show the HTTPS
          path only.
        </p>
        <p>
          <strong>Customer path:</strong> only <strong>outbound</strong> TLS from your side to the app origin for
          control-plane APIs. eltPulse does not open a path into your VPC for runs or monitors.
        </p>
        <p>
          <strong>eltPulse-managed path:</strong> monitors (and eventually workers) run in our environment using
          connection credentials stored for cloud checks; ingestion may still use env vars in the runner depending on
          setup.
        </p>
      </figcaption>
    </figure>
  );
}
