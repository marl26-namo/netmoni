"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Mode = "signin" | "signup";

function AuthCard() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("returnTo") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // sign-in fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // sign-up fields
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("MUBAS ICT Directorate");
  const [confirmPassword, setConfirmPassword] = useState("");

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { session?: unknown; error?: string };
    if (!response.ok || !data.session) {
      setError(data.error ?? "Sign-in failed — check your email and password.");
      setBusy(false);
      return;
    }
    router.push(returnTo);
    router.refresh();
  };

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: organizationName, ownerName: name, ownerEmail: email, ownerPassword: password, confirmPassword }),
    });
    const data = (await response.json().catch(() => ({}))) as { session?: unknown; error?: string };
    if (!response.ok || !data.session) {
      setError(data.error ?? "Could not create the account.");
      setBusy(false);
      return;
    }
    router.push(returnTo);
    router.refresh();
  };

  return (
    <div className="nw-shell" style={{ display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "min(440px, 100%)" }}>
        <Link href="/" className="nw-logo" style={{ justifyContent: "center", marginBottom: 22, display: "flex" }}>
          <span className="nw-logo-dot" />
          MUBAS&nbsp;NetWatch
        </Link>

        <div className="nw-tile" style={{ padding: 26 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              type="button"
              className={`nw-button ${mode === "signin" ? "" : "ghost"}`}
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => { setMode("signin"); setError(""); }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`nw-button ${mode === "signup" ? "" : "ghost"}`}
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Create account
            </button>
          </div>

          {mode === "signin" ? (
            <form onSubmit={signIn} style={{ display: "grid", gap: 12 }}>
              <label style={labelStyle}>
                Email
                <input className="nw-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@mubas.ac.mw" />
              </label>
              <label style={labelStyle}>
                Password
                <input className="nw-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
              </label>
              {error ? <span className="nw-badge crit">{error}</span> : null}
              <button className="nw-button" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
                {busy ? "Signing in…" : "Sign in to the console"}
              </button>
            </form>
          ) : (
            <form onSubmit={signUp} style={{ display: "grid", gap: 12 }}>
              <label style={labelStyle}>
                Your name
                <input className="nw-input" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Tumwitike Mapoma" />
              </label>
              <label style={labelStyle}>
                Organization / unit
                <input className="nw-input" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
              </label>
              <label style={labelStyle}>
                Email
                <input className="nw-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@mubas.ac.mw" />
              </label>
              <label style={labelStyle}>
                Password
                <input className="nw-input" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              </label>
              <label style={labelStyle}>
                Confirm password
                <input className="nw-input" type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              </label>
              {error ? <span className="nw-badge crit">{error}</span> : null}
              <button className="nw-button" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
                {busy ? "Creating…" : "Create admin account"}
              </button>
            </form>
          )}
        </div>

        <p style={{ color: "var(--nw-muted)", fontSize: 12, textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
          The administrator account owns the monitoring workspace. Sessions are HTTP-only and
          expire after 24 hours.
        </p>
      </div>
    </div>
  );
}

const labelStyle = { display: "grid", gap: 6, color: "var(--nw-muted)", fontSize: 12, fontWeight: 600 } as const;

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="nw-shell" />}>
      <AuthCard />
    </Suspense>
  );
}
