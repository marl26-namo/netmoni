"use client";

import Link from "next/link";

const modules = [
  {
    icon: "📡",
    title: "Network Status",
    detail:
      "Polls every router, switch, PC, and the MUBAS server on a 30-second SNMP cycle and streams live availability and response times to the dashboard.",
  },
  {
    icon: "🚨",
    title: "Fault Detection",
    detail:
      "Raises a fault automatically when a device fails to answer within its 5-second threshold — timestamp, affected device, and fault type are recorded instantly.",
  },
  {
    icon: "🧠",
    title: "Fault Diagnosis",
    detail:
      "Analyses the pattern of unresponsive devices: one unreachable PC means a link failure, a dead router means device failure, campus-wide high latency means congestion.",
  },
  {
    icon: "🛠️",
    title: "Recommendations",
    detail:
      "Every diagnosis ships with the corrective action the administrator should take — from re-seating a patch cord to enabling QoS on a saturated uplink.",
  },
  {
    icon: "🔔",
    title: "Notifications",
    detail:
      "In-application alerts reach the administrator the moment a fault is detected — no one has to be staring at graphs to know something broke.",
  },
  {
    icon: "📊",
    title: "Reporting & Statistics",
    detail:
      "Logs every event for historical analysis and computes detection-time means, standard deviations, diagnosis accuracy, and a t-test versus manual monitoring.",
  },
];

const metrics = [
  { label: "Poll cycle", value: "30 s" },
  { label: "Fault timeout", value: "5 s" },
  { label: "Fault scenarios", value: "3" },
  { label: "Significance α", value: "0.05" },
];

export default function LandingPage() {
  return (
    <div className="nw-shell">
      <header className="nw-topbar">
        <div className="nw-logo">
          <span className="nw-logo-dot" />
          MUBAS&nbsp;NetWatch
        </div>
        <nav>
          <Link href="#modules" className="nw-toplink">
            Modules
          </Link>
          <Link href="#research" className="nw-toplink">
            Research
          </Link>
          <Link href="/dashboard" className="nw-toplink active">
            Open console
          </Link>
          <Link href="/auth?returnTo=/dashboard" className="nw-toplink">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="nw-hero">
        <span className="nw-hero-kicker">◉ CIS-PRJ-411 · Fault Detection &amp; Management</span>
        <h1>
          The campus network that <em>tells you what broke</em> — before anyone asks.
        </h1>
        <p className="lead">
          MUBAS NetWatch is a prototype network monitoring application for fault detection and
          management. It replaces manual Cacti-style graph watching with real-time status,
          automated fault detection, diagnosis, and recommended corrective actions — tested
          against a simulated Cisco Packet Tracer campus network.
        </p>
        <div className="nw-hero-actions">
          <Link href="/auth?returnTo=/dashboard" className="nw-button">
            Sign in & launch console →
          </Link>
          <Link href="#modules" className="nw-button ghost">
            How it works
          </Link>
        </div>
        <div className="nw-grid cols-4" style={{ marginTop: 46 }}>
          {metrics.map((metric) => (
            <div className="nw-stat" key={metric.label}>
              <div className="label">{metric.label}</div>
              <div className="value">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="nw-section" id="modules">
        <h2>Six modules, one pipeline</h2>
        <p className="nw-sub">
          Each polling cycle flows through the full pipeline — poll, detect, diagnose, recommend,
          notify, report — exactly as specified in the research proposal.
        </p>
        <div className="nw-grid cols-3" style={{ marginTop: 26 }}>
          {modules.map((module) => (
            <div className="nw-card" key={module.title}>
              <div className="nw-icon">{module.icon}</div>
              <h3>{module.title}</h3>
              <p>{module.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="nw-section" id="research" style={{ paddingBottom: 80 }}>
        <h2>Built for the experiment</h2>
        <p className="nw-sub">
          The console doubles as the experimental apparatus: inject device failure, link failure,
          or congestion into the simulated network, run trials against both the prototype and a
          simulated manual (Cacti-style) administrator, and export the statistics.
        </p>
        <div className="nw-grid cols-3" style={{ marginTop: 26 }}>
          <div className="nw-card">
            <div className="nw-icon">⚡</div>
            <h3>Fault Detection Time</h3>
            <p>Time from fault injection to alert, in seconds, per trial — the headline metric compared against manual monitoring.</p>
          </div>
          <div className="nw-card">
            <div className="nw-icon">🎯</div>
            <h3>Diagnosis Accuracy</h3>
            <p>Frequency analysis of how often the diagnosis module identified the correct fault type across all trials.</p>
          </div>
          <div className="nw-card">
            <div className="nw-icon">📈</div>
            <h3>Independent t-Test</h3>
            <p>Welch&apos;s t-test at α = 0.05 determines whether the prototype&apos;s mean detection time beats manual monitoring significantly.</p>
          </div>
        </div>
        <div className="nw-hero-actions" style={{ marginTop: 34 }}>
          <Link href="/auth?returnTo=/dashboard" className="nw-button">
            Create an admin account →
          </Link>
        </div>
      </section>

      <footer className="nw-footer">
        MUBAS NetWatch · Development of a Prototype Network Monitoring Application for Fault
        Detection and Management at MUBAS · Tumwitike Mapoma (BIS/22/SS/018)
      </footer>
    </div>
  );
}
