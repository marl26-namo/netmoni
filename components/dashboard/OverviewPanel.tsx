"use client";

type Props = {
  onOpenWorkflows: () => void;
};

/** Workspace overview landing panel. */
export function OverviewPanel({ onOpenWorkflows }: Props) {
  return (
    <section className="section-panel">
      <div className="section-panel-inner wide-panel">
        <span className="overline">NETWORK / OVERVIEW</span>
        <h1>Network automation workspace</h1>
        <p>Build event-driven automations for device failures, diagnosis and administrator notifications.</p>
        <button className="header-button section-action" onClick={onOpenWorkflows}>Open automation canvas</button>
      </div>
    </section>
  );
}
