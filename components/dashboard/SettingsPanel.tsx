"use client";

import type { SettingsForm } from "./types";

type Props = {
  settings: SettingsForm;
  onSettingsChange: (patch: Partial<SettingsForm>) => void;
  workflowName: string;
  onWorkflowNameChange: (value: string) => void;
  onSaveSettings: () => void;
};

/** Monitoring thresholds and notification workflow settings. */
export function SettingsPanel({ settings, onSettingsChange, workflowName, onWorkflowNameChange, onSaveSettings }: Props) {
  return (
    <section className="section-panel">
      <div className="section-panel-inner api-panel">
        <span className="overline">NETWORK / SETTINGS</span>
        <h1>Monitoring and notification settings</h1>
        <p>Configure thresholds used by network events and the notification workflow.</p>
        <div className="credential-form">
          <label>Polling interval<select value={settings.pollingInterval} onChange={(e) => onSettingsChange({ pollingInterval: e.target.value })}><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">60 seconds</option></select></label>
          <label>Failure threshold<select value={settings.failureThreshold} onChange={(e) => onSettingsChange({ failureThreshold: e.target.value })}><option value="2">2 missed responses</option><option value="3">3 missed responses</option><option value="5">5 missed responses</option></select></label>
          <label>Default notification workflow<input value={workflowName} onChange={(e) => onWorkflowNameChange(e.target.value)} /></label>
          <button className="btn primary" type="button" onClick={onSaveSettings}>Save monitoring settings</button>
          <div className="database-choice"><strong>Google SMTP / Nodemailer</strong><span>The workflow sends the AI-generated message to the authenticated administrator Gmail. Google App Passwords and AI API keys must be stored server-side.</span></div>
        </div>
      </div>
    </section>
  );
}
