# MUBAS NetWatch

**MUBAS NetWatch** is a prototype **network monitoring application for fault detection and management** at the Malawi University of Business and Applied Sciences, built from the CIS-PRJ-411 research proposal (`tumwi.pdf`).

It upgrades manual, Cacti-style graph watching into an automated pipeline: **real-time status → fault detection → diagnosis → recommendation → notification → reporting**, tested against a simulated Cisco Packet Tracer campus network.

## Why

At MUBAS, monitoring currently means an administrator logging in and reading Cacti graphs by hand. Nothing alerts, locates, diagnoses, or advises — so faults and congestion persist long after they appear. NetWatch closes that gap.

## The six modules (proposal §3.2.2)

| Module | What it does |
| --- | --- |
| **Network Status** | Polls every router, switch, PC, and the server every **30 s** via SNMP GET, showing live availability and response times. |
| **Fault Detection** | Raises a fault when a device fails to respond within **5 s**; records timestamp, affected device, and fault type. |
| **Fault Diagnosis** | Pattern analysis: one unreachable PC → **link failure**; unresponsive router/switch → **device failure**; campus-wide high response times → **congestion**. |
| **Recommendation** | Attaches the corrective action for the diagnosed fault type. |
| **Notification** | In-application alerts the moment a fault is detected. |
| **Reporting** | Logs all events and computes the research statistics, including the independent samples t-test (α = 0.05). |

## Research experiment (proposal §3.4–3.7)

The console at `/dashboard` doubles as the experimental apparatus:

1. **Inject** a fault scenario into the simulated network — device failure (router/switch power off), link failure (cable disconnect), or congestion (traffic flood).
2. **Run trials** against both arms: the automated `prototype` and a simulated `manual` Cacti-style administrator (which "notices" faults only after minutes).
3. **Report** mean/median/σ/min/max detection times, diagnosis accuracy frequency analysis, recovery times, and the Welch t-test comparing the two arms.

## Screens

* `/` — themed landing page introducing the system and linking into the console.
* `/dashboard` — the NOC console: device status grid, fault console with diagnosis and recommendations, Packet Tracer scenario console, notifications, event log, trial runner, and the research report.

## Bring your own database (BYO-DB)

The monitoring boundary uses **Drizzle ORM** and supports **SQLite (default), PostgreSQL, and MySQL**. The dialect is selected from the URL, exactly like the auth and organization boundaries:

```bash
# SQLite — the default, no external service required
npm run db:generate:monitoring
npm run db:migrate:monitoring

# PostgreSQL
MONITORING_DATABASE_URL=postgresql://user:pass@host:5432/netwatch npm run db:migrate:monitoring

# MySQL
MONITORING_DATABASE_URL=mysql://user:pass@host:3306/netwatch npm run db:migrate:monitoring
```

Per-dialect schemas live in `db/schema/`:

* `monitoring-sqlite.ts` (default)
* `monitoring-postgres.ts`
* `monitoring-mysql.ts`

Drizzle Kit config: `drizzle.monitoring.config.ts` · Migrations: `db/migrations/monitoring/`

## Schema (11 tables)

| Table | Purpose |
| --- | --- |
| `devices` | Simulated topology: kind, role, IP/subnet, campus location, SNMP community/version, poll interval, timeout, congestion threshold, status. |
| `links` | Cables between devices — the object of link-failure scenarios. |
| `poll_results` | One SNMP GET result per device per cycle: response time, latency, jitter, packet loss, bandwidth/CPU/memory, error codes. |
| `faults` | Detected faults with severity, detection time, detected-by (prototype/manual), status, and resolution metrics. |
| `diagnoses` | Pattern-analysis output: cause, summary, evidence JSON, affected devices, confidence. |
| `recommendations` | Corrective actions per diagnosis with priority and action class. |
| `notifications` | In-application alerts linked to faults. |
| `scenarios` | Controlled Packet Tracer fault scenarios. |
| `trials` | Experimental runs per scenario and arm with detection/diagnosis/recovery metrics. |
| `metric_samples` | Optional per-trial time series for charts. |
| `monitoring_events` | Historical event log backing the reporting module. |

## Architecture

```text
                Cisco Packet Tracer (simulated)
                              │  SNMP GET (30 s cycle)
                              ▼
     ┌────────────── Monitoring Engine ──────────────┐
     │ Status → Detection → Diagnosis → Recommendation│
     │              → Notification → Reporting        │
     └───────────────────────┬───────────────────────┘
                             │
                      Monitoring Store
                             │
                        Drizzle ORM
                             │
             ┌───────────────┼───────────────┐
             │               │               │
         PostgreSQL        MySQL         SQLite (default)
```

## API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/monitoring/overview` | GET / POST | Live dashboard snapshot / run a poll cycle now. |
| `/api/monitoring/devices` | GET / POST / DELETE | List, add, or disable devices. |
| `/api/monitoring/faults` | GET / PATCH | List faults; acknowledge or resolve. |
| `/api/monitoring/notifications` | GET / PATCH | Alerts; mark one or all read. |
| `/api/monitoring/scenarios` | GET / POST | List scenarios; inject or clear. |
| `/api/monitoring/trials` | GET / POST | List trials; run a prototype or manual trial. |
| `/api/monitoring/reports` | GET | Statistics, diagnosis frequency, t-test. |
| `/api/monitoring/metrics` | GET | Time-series poll/metric samples. |
| `/api/monitoring/seed` | POST | Bootstrap the simulated MUBAS topology. |

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

Seed and poke the engine:

```bash
curl -X POST localhost:3000/api/monitoring/seed
curl -X POST localhost:3000/api/monitoring/overview            # one poll cycle
curl -X POST localhost:3000/api/monitoring/trials \
  -H 'content-type: application/json' \
  -d '{"scenarioId":"scenario-link-lab","monitor":"prototype"}'
```

Auth/organization persistence from the original platform still defaults to SQLite via `AUTH_DATABASE_URL`; the monitoring boundary is independent via `MONITORING_DATABASE_URL`.

## Status

Implemented: simulated campus topology, polling engine, automated detection/diagnosis/recommendation/notification, scenario injection, trial runner for both experimental arms, statistics + t-test reporting, NOC dashboard UI, and the BYO-DB Drizzle layer across PostgreSQL/MySQL/SQLite.
