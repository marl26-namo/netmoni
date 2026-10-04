"use client";

import type { BackendResult, ExecutionRun } from "./types";

type Props = {
  results: BackendResult[];
  history: ExecutionRun[];
};

/** Workflow execution history and recent probe outcomes. */
export function ExecutionsPanel({ results, history }: Props) {
  return (
    <section className="section-panel">
      <div className="section-panel-inner wide-panel">
        <span className="overline">AUTOMATION / EXECUTIONS</span>
        <h1>Workflow executions</h1>
        <p>Monitor each network event as it moves through detection, condition checks and notification dispatch.</p>
        <div className="dashboard-integration-grid">
          {results.length > 0 && results.slice(0, 6).map((result, i) => (
            <article className="dashboard-integration-card" key={result.id}>
              <div className="dashboard-integration-icon">{String(i + 1).padStart(2, "0")}</div>
              <div><strong>{result.deviceName} · {result.probe.toUpperCase()} · {result.ok ? "Reachable" : "Unreachable"}</strong>
                <small>{result.ipAddress} · {result.checkedAt.slice(0, 19).replace("T", " ")}</small>
                <p>{result.latencyMs ?? "–"} ms · {result.packetLossPercent}% loss{result.bandwidthInMbps !== null ? ` · in ${result.bandwidthInMbps.toFixed(2)} Mbps` : ""}{result.bandwidthOutMbps !== null ? ` · out ${result.bandwidthOutMbps.toFixed(2)} Mbps` : ""}</p>
              </div>
            </article>
          ))}
          {history.length ? history.map((run, i) => (
            <article className="dashboard-integration-card" key={run.id}>
              <div className="dashboard-integration-icon">{String(i + 1).padStart(2, "0")}</div>
              <div><strong>{run.status} · {run.time}</strong><small>{run.detail}</small><p>Network Fault → Check Severity → AI Message → Send Gmail</p></div>
            </article>
          )) : <article className="dashboard-integration-card"><div className="dashboard-integration-icon">—</div><div><strong>No executions yet</strong><small>Run Test workflow from the header.</small><p>Your workflow test history will appear here.</p></div></article>}
        </div>
      </div>
    </section>
  );
}
