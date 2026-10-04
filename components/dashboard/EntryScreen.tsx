"use client";

import type { FormEvent } from "react";
import type { EntryField, EntryStage } from "./types";

type Props = {
  stage: Exclude<EntryStage, "editor">;
  fields: Record<EntryField, string>;
  onField: (field: EntryField, value: string) => void;
  error: string;
  busy: boolean;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onCreateOrganization: (event: FormEvent<HTMLFormElement>) => void;
  onStartOrganization: () => void;
  onBackToLogin: () => void;
};

/** Sign-in and organization onboarding screens shown before the workspace. */
export function EntryScreen({ stage, fields, onField, error, busy, onLogin, onCreateOrganization, onStartOrganization, onBackToLogin }: Props) {
  const step = stage === "login" ? "01 / ACCESS" : "02 / ORGANIZATION";
  return (
    <main className="entry-shell">
      <div className="entry-brand"><span className="netmoni-logo">N</span><span>netmoni</span></div>
      <div className="entry-frame">
        <div className="entry-aside">
          <span className="overline">NETWORK AUTOMATION</span>
          <h1>Monitor the network. Automate the response.</h1>
          <p>Detect failures, evaluate fault conditions and dispatch notifications through workflow automation.</p>
          <div className="entry-aside-line" />
          <small>Private by design. Your organization data lives in one managed PostgreSQL database.</small>
        </div>
        <section className="entry-card">
          <span className="overline">{step}</span>
          {stage === "login" && <>
            <h2>Welcome back</h2><p className="entry-lede">Sign in to your NetMoni workspace.</p>
            <form className="entry-form" onSubmit={onLogin}>
              <label>Email address<input type="email" value={fields.email} onChange={(e) => onField("email", e.target.value)} placeholder="you@company.com" required /></label>
              <label>Password<input type="password" value={fields.password} onChange={(e) => onField("password", e.target.value)} placeholder="Enter your password" required /></label>
              {error && <div className="entry-error">{error}</div>}
              <button className="entry-submit" type="submit" disabled={busy}>{busy ? "Signing in..." : "Continue"}<span>{"->"}</span></button>
            </form>
            <div className="entry-foot">New to NetMoni? <button type="button" onClick={onStartOrganization}>Create an organization</button></div>
          </>}
          {stage === "organization" && <>
            <h2>Create your organization</h2><p className="entry-lede">Your organization is the boundary for members, workflows, credentials, and data.</p>
            <form className="entry-form" onSubmit={onCreateOrganization}>
              <label>Organization name<input value={fields.organizationName} onChange={(e) => onField("organizationName", e.target.value)} placeholder="Acme Ltd" required /></label>
              <div className="owner-section"><span className="owner-section-title">System owner</span><p>This account will manage members, credentials, and organization access.</p>
                <label>Your name<input value={fields.ownerName} onChange={(e) => onField("ownerName", e.target.value)} placeholder="Maya Chen" required /></label>
                <label>Owner email<input type="email" value={fields.ownerEmail} onChange={(e) => onField("ownerEmail", e.target.value)} placeholder="you@company.com" required /></label>
                <label>Create password<input type="password" minLength={8} value={fields.ownerPassword} onChange={(e) => onField("ownerPassword", e.target.value)} placeholder="At least 8 characters" required /></label>
                <label>Confirm password<input type="password" minLength={8} value={fields.confirmOwnerPassword} onChange={(e) => onField("confirmOwnerPassword", e.target.value)} placeholder="Repeat your password" required /></label>
              </div>
              {error && <div className="entry-error">{error}</div>}
              <button className="entry-submit" type="submit" disabled={busy}>{busy ? "Creating owner account..." : "Create organization and owner"}<span>{"->"}</span></button>
            </form>
            <button className="back-link" type="button" onClick={onBackToLogin}>Back to sign in</button>
          </>}
        </section>
      </div>
    </main>
  );
}
