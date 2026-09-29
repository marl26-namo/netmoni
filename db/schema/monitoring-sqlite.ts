/**
 * MUBAS NetWatch — network monitoring schema (SQLite dialect).
 *
 * Models the data required by the CIS-PRJ-411 proposal:
 * simulated topology (devices/links), SNMP-style polling, automated fault
 * detection, diagnosis, recommendations, notifications, and the research
 * experiment (scenarios, trials, and detection/recovery metrics used for
 * comparing the prototype against manual monitoring).
 */
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Simulated Packet Tracer devices — routers, switches, PCs, the server. */
export const devices = sqliteTable(
  "devices",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(), // router | switch | pc | server
    role: text("role").notNull().default("access"), // core | distribution | access | endpoint
    ipAddress: text("ip_address").notNull().unique(),
    subnet: text("subnet").notNull().default("192.168.1.0/24"),
    macAddress: text("mac_address"),
    /** Site on campus, e.g. hostel, laboratory, library (proposal §1.1). */
    location: text("location").notNull().default("campus"),
    vendor: text("vendor").notNull().default("Cisco"),
    model: text("model"),
    /** SNMP community string used by the poller (proposal §3.2.1). */
    snmpCommunity: text("snmp_community").notNull().default("public"),
    snmpVersion: text("snmp_version").notNull().default("2c"),
    /** Polling window in seconds (proposal: every 30 seconds). */
    pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
    /** Unresponsive threshold in seconds (proposal: 5 seconds). */
    timeoutSeconds: integer("timeout_seconds").notNull().default(5),
    latencyBaselineMs: real("latency_baseline_ms").notNull().default(1),
    /** Congestion threshold on the 0–100 load scale (proposal §3.2.2c). */
    congestionThreshold: integer("congestion_threshold").notNull().default(80),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    status: text("status").notNull().default("unknown"), // unknown | up | degraded | down
    lastSeenAt: text("last_seen_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    statusIdx: index("devices_status_idx").on(table.status),
    locationIdx: index("devices_location_idx").on(table.location),
  }),
);

/** Cables between simulated devices — link failure is one of the scenarios. */
export const links = sqliteTable(
  "links",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sourceDeviceId: text("source_device_id")
      .notNull()
      .references(() => devices.id),
    targetDeviceId: text("target_device_id")
      .notNull()
      .references(() => devices.id),
    /** ethernet | serial | fiber | wireless */
    medium: text("medium").notNull().default("ethernet"),
    speedMbps: integer("speed_mbps").notNull().default(1000),
    status: text("status").notNull().default("up"), // up | degraded | down
    up: integer("up", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    sourceIdx: index("links_source_idx").on(table.sourceDeviceId),
    targetIdx: index("links_target_idx").on(table.targetDeviceId),
  }),
);

/** One SNMP GET result per device per poll cycle (proposal §3.2.2a). */
export const pollResults = sqliteTable(
  "poll_results",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    cycle: integer("cycle").notNull(),
    polledAt: text("polled_at").notNull(),
    responded: integer("responded", { mode: "boolean" }).notNull(),
    /** Whether the SNMP response arrived inside the 5 s threshold. */
    withinTimeout: integer("within_timeout", { mode: "boolean" }).notNull(),
    responseTimeMs: real("response_time_ms"),
    latencyMs: real("latency_ms"),
    jitterMs: real("jitter_ms"),
    packetLossPct: real("packet_loss_pct"),
    bandwidthUtilPct: real("bandwidth_util_pct"),
    cpuLoadPct: real("cpu_load_pct"),
    memoryLoadPct: real("memory_load_pct"),
    uptimeSeconds: integer("uptime_seconds"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    deviceIdx: index("poll_results_device_idx").on(table.deviceId),
    cycleIdx: index("poll_results_cycle_idx").on(table.cycle),
    polledAtIdx: index("poll_results_polled_at_idx").on(table.polledAt),
  }),
);

/** A fault raised by the detection module (proposal §3.2.2b). */
export const faults = sqliteTable(
  "faults",
  {
    id: text("id").primaryKey(),
    /** device_failure | link_failure | congestion (proposal §3.4). */
    type: text("type").notNull(),
    severity: text("severity").notNull().default("critical"), // info | warning | critical
    title: text("title").notNull(),
    description: text("description").notNull(),
    deviceId: text("device_id").references(() => devices.id),
    linkId: text("link_id").references(() => links.id),
    /** Simulated scenario that introduced the fault, when applicable. */
    scenarioId: text("scenario_id").references(() => scenarios.id),
    trialId: text("trial_id").references(() => trials.id),
    /** Epoch ms from scenario injection to detection — the headline metric. */
    detectionTimeMs: real("detection_time_ms"),
    detectedAt: text("detected_at").notNull(),
    detectedBy: text("detected_by").notNull().default("prototype"), // prototype | manual
    /** resolved | open | acknowledged */
    status: text("status").notNull().default("open"),
    resolvedAt: text("resolved_at"),
    resolutionTimeMs: real("resolution_time_ms"),
    resolutionNote: text("resolution_note"),
  },
  (table) => ({
    typeIdx: index("faults_type_idx").on(table.type),
    statusIdx: index("faults_status_idx").on(table.status),
    detectedAtIdx: index("faults_detected_at_idx").on(table.detectedAt),
  }),
);

/** Diagnosis output for a fault (proposal §3.2.2c — pattern analysis). */
export const diagnoses = sqliteTable(
  "diagnoses",
  {
    id: text("id").primaryKey(),
    faultId: text("fault_id")
      .notNull()
      .references(() => faults.id),
    /** device_failure | link_failure | congestion */
    faultType: text("fault_type").notNull(),
    /** device | link | congestion | unknown */
    cause: text("cause").notNull(),
    /** Short human-readable explanation, e.g. "only one PC unreachable". */
    summary: text("summary").notNull(),
    /** Observed evidence backing the diagnosis (JSON list of signals). */
    evidence: text("evidence", { mode: "json" }).$type<Array<Record<string, unknown>>>().notNull(),
    /** Unresponsive device ids considered by the diagnosis. */
    affectedDeviceIds: text("affected_device_ids", { mode: "json" }).$type<Array<string>>().notNull(),
    confidencePct: real("confidence_pct").notNull().default(0),
    diagnosedAt: text("diagnosed_at").notNull(),
  },
  (table) => ({ faultIdx: index("diagnoses_fault_idx").on(table.faultId) }),
);

/** Corrective action suggested for a diagnosis (proposal §3.2.2d). */
export const recommendations = sqliteTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    diagnosisId: text("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id),
    faultType: text("fault_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    /** reorder | priority — presentation hint for the dashboard. */
    priority: text("priority").notNull().default("high"),
    /** manual | assisted | automated */
    actionClass: text("action_class").notNull().default("manual"),
    acknowledgedAt: text("acknowledged_at"),
  },
  (table) => ({ diagnosisIdx: index("recommendations_diagnosis_idx").on(table.diagnosisId) }),
);

/** In-application alert raised when a fault is detected (proposal §3.2.2e). */
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    faultId: text("fault_id").references(() => faults.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: text("severity").notNull().default("critical"),
    channel: text("channel").notNull().default("in-app"), // in-app | email | webhook
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    faultIdx: index("notifications_fault_idx").on(table.faultId),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

/** Controlled Packet Tracer fault scenarios (proposal §3.4). */
export const scenarios = sqliteTable("scenarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** device_failure | link_failure | congestion */
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  /** Device/link targeted by the scenario. */
  targetDeviceId: text("target_device_id").references(() => devices.id),
  targetLinkId: text("target_link_id").references(() => links.id),
  /** Congestion intensity on the 0–100 scale. */
  intensity: integer("intensity").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

/** One experimental run of a scenario (proposal §3.7 — 10 trials each). */
export const trials = sqliteTable(
  "trials",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id),
    trialNumber: integer("trial_number").notNull(),
    /** prototype | manual — the comparison arm of the experiment. */
    monitor: text("monitor").notNull().default("prototype"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    detectedAt: text("detected_at"),
    /** Headline comparison metrics (proposal §3.5). */
    detectionTimeMs: real("detection_time_ms"),
    diagnosisTimeMs: real("diagnosis_time_ms"),
    recoveryTimeMs: real("recovery_time_ms"),
    diagnosisAccuracy: integer("diagnosis_accuracy", { mode: "boolean" }),
    detectedFaultType: text("detected_fault_type"),
    packetLossPct: real("packet_loss_pct"),
    avgResponseTimeMs: real("avg_response_time_ms"),
    status: text("status").notNull().default("running"), // running | completed | failed
  },
  (table) => ({
    scenarioIdx: index("trials_scenario_idx").on(table.scenarioId),
    monitorIdx: index("trials_monitor_idx").on(table.monitor),
  }),
);

/** Optional per-trial time series used by the reporting module charts. */
export const metricSamples = sqliteTable(
  "metric_samples",
  {
    id: text("id").primaryKey(),
    trialId: text("trial_id").references(() => trials.id),
    deviceId: text("device_id").references(() => devices.id),
    recordedAt: text("recorded_at").notNull(),
    responseTimeMs: real("response_time_ms"),
    latencyMs: real("latency_ms"),
    packetLossPct: real("packet_loss_pct"),
    bandwidthUtilPct: real("bandwidth_util_pct"),
  },
  (table) => ({
    trialIdx: index("metric_samples_trial_idx").on(table.trialId),
    recordedAtIdx: index("metric_samples_recorded_at_idx").on(table.recordedAt),
  }),
);

/**
 * A network-watch automation composed on the visual canvas (n8n style).
 * Nodes below belong to exactly one automation; the schedule decides when the
 * engine runs it, and emailRecipients decide who gets alerted.
 */
export const automations = sqliteTable(
  "automations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().default("local"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    /** Human-readable schedule, e.g. "every 30 seconds" or "daily at 07:00". */
    scheduleLabel: text("schedule_label").notNull().default("every 30 seconds"),
    /** cron expression when the user picks cron mode. */
    cron: text("cron"),
    /** Engine cadence in seconds (proposal: 30 s poll cycle). */
    intervalSeconds: integer("interval_seconds").notNull().default(30),
    /** "interval" | "daily" | "cron" */
    scheduleKind: text("schedule_kind").notNull().default("interval"),
    /** Optional daily run time, HH:MM (24h) when scheduleKind = daily. */
    dailyAt: text("daily_at"),
    lastRunAt: text("last_run_at"),
    nextRunAt: text("next_run_at"),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    orgIdx: index("automations_org_idx").on(table.organizationId),
    enabledIdx: index("automations_enabled_idx").on(table.enabled),
  }),
);

/**
 * Canvas nodes: watch_device nodes carry the device name + IP address the
 * admin typed; notify_email nodes carry the admin recipients.
 */
export const automationNodes = sqliteTable(
  "automation_nodes",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    /** trigger | watch_device | notify_email */
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    /** watch_device payload. */
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    subnet: text("subnet"),
    location: text("location"),
    pollIntervalSeconds: integer("poll_interval_seconds"),
    timeoutSeconds: integer("timeout_seconds"),
    /** notify_email payload. */
    email: text("email"),
    /** Extra JSON config for future node types. */
    config: text("config", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    automationIdx: index("automation_nodes_automation_idx").on(table.automationId),
    kindIdx: index("automation_nodes_kind_idx").on(table.kind),
  }),
);

/** Canvas edges (node connections). */
export const automationEdges = sqliteTable(
  "automation_edges",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({ automationIdx: index("automation_edges_automation_idx").on(table.automationId) }),
);

/** Email recipients resolved from notify_email nodes. */
export const emailRecipients = sqliteTable(
  "email_recipients",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    label: text("label").notNull().default("Administrator"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({ automationIdx: index("email_recipients_automation_idx").on(table.automationId) }),
);

/** One engine execution of an automation — the run history feed. */
export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("succeeded"), // running | succeeded | failed
    trigger: text("trigger").notNull().default("schedule"), // schedule | manual
    devicesChecked: integer("devices_checked").notNull().default(0),
    faultsDetected: integer("faults_detected").notNull().default(0),
    faultsResolved: integer("faults_resolved").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
    /** "skipped" | sent ids | error text — surfaced in the run log. */
    emailStatus: text("email_status"),
    durationMs: integer("duration_ms").notNull().default(0),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (table) => ({
    automationIdx: index("automation_runs_automation_idx").on(table.automationId),
    startedAtIdx: index("automation_runs_started_at_idx").on(table.startedAt),
  }),
);

/** Historical event log backing the reporting module (proposal §3.2.2f). */
export const monitoringEvents = sqliteTable(
  "monitoring_events",
  {
    id: text("id").primaryKey(),
    /** poll_cycle | fault_detected | fault_resolved | scenario | notification */
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    deviceId: text("device_id").references(() => devices.id),
    faultId: text("fault_id").references(() => faults.id),
    trialId: text("trial_id").references(() => trials.id),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    kindIdx: index("monitoring_events_kind_idx").on(table.kind),
    createdAtIdx: index("monitoring_events_created_at_idx").on(table.createdAt),
  }),
);
