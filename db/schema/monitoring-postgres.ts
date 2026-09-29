/**
 * MUBAS NetWatch — network monitoring schema (PostgreSQL dialect).
 * Mirrors monitoring-sqlite.ts so organizations can bring their own Postgres.
 */
import { boolean, doublePrecision, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const devices = pgTable(
  "devices",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    role: text("role").notNull().default("access"),
    ipAddress: text("ip_address").notNull().unique(),
    subnet: text("subnet").notNull().default("192.168.1.0/24"),
    macAddress: text("mac_address"),
    location: text("location").notNull().default("campus"),
    vendor: text("vendor").notNull().default("Cisco"),
    model: text("model"),
    snmpCommunity: text("snmp_community").notNull().default("public"),
    snmpVersion: text("snmp_version").notNull().default("2c"),
    pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
    timeoutSeconds: integer("timeout_seconds").notNull().default(5),
    latencyBaselineMs: doublePrecision("latency_baseline_ms").notNull().default(1),
    congestionThreshold: integer("congestion_threshold").notNull().default(80),
    enabled: boolean("enabled").notNull().default(true),
    status: text("status").notNull().default("unknown"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    statusIdx: index("devices_status_idx").on(table.status),
    locationIdx: index("devices_location_idx").on(table.location),
  }),
);

export const links = pgTable(
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
    medium: text("medium").notNull().default("ethernet"),
    speedMbps: integer("speed_mbps").notNull().default(1000),
    status: text("status").notNull().default("up"),
    up: boolean("up").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    sourceIdx: index("links_source_idx").on(table.sourceDeviceId),
    targetIdx: index("links_target_idx").on(table.targetDeviceId),
  }),
);

export const pollResults = pgTable(
  "poll_results",
  {
    id: text("id").primaryKey(),
    deviceId: text("device_id")
      .notNull()
      .references(() => devices.id),
    cycle: integer("cycle").notNull(),
    polledAt: timestamp("polled_at", { withTimezone: true }).notNull(),
    responded: boolean("responded").notNull(),
    withinTimeout: boolean("within_timeout").notNull(),
    responseTimeMs: doublePrecision("response_time_ms"),
    latencyMs: doublePrecision("latency_ms"),
    jitterMs: doublePrecision("jitter_ms"),
    packetLossPct: doublePrecision("packet_loss_pct"),
    bandwidthUtilPct: doublePrecision("bandwidth_util_pct"),
    cpuLoadPct: doublePrecision("cpu_load_pct"),
    memoryLoadPct: doublePrecision("memory_load_pct"),
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

export const faults = pgTable(
  "faults",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("critical"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    deviceId: text("device_id").references(() => devices.id),
    linkId: text("link_id").references(() => links.id),
    scenarioId: text("scenario_id").references(() => scenarios.id),
    trialId: text("trial_id").references(() => trials.id),
    detectionTimeMs: doublePrecision("detection_time_ms"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    detectedBy: text("detected_by").notNull().default("prototype"),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionTimeMs: doublePrecision("resolution_time_ms"),
    resolutionNote: text("resolution_note"),
  },
  (table) => ({
    typeIdx: index("faults_type_idx").on(table.type),
    statusIdx: index("faults_status_idx").on(table.status),
    detectedAtIdx: index("faults_detected_at_idx").on(table.detectedAt),
  }),
);

export const diagnoses = pgTable(
  "diagnoses",
  {
    id: text("id").primaryKey(),
    faultId: text("fault_id")
      .notNull()
      .references(() => faults.id),
    faultType: text("fault_type").notNull(),
    cause: text("cause").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").$type<Array<Record<string, unknown>>>().notNull(),
    affectedDeviceIds: jsonb("affected_device_ids").$type<Array<string>>().notNull(),
    confidencePct: doublePrecision("confidence_pct").notNull().default(0),
    diagnosedAt: timestamp("diagnosed_at", { withTimezone: true }).notNull(),
  },
  (table) => ({ faultIdx: index("diagnoses_fault_idx").on(table.faultId) }),
);

export const recommendations = pgTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    diagnosisId: text("diagnosis_id")
      .notNull()
      .references(() => diagnoses.id),
    faultType: text("fault_type").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    priority: text("priority").notNull().default("high"),
    actionClass: text("action_class").notNull().default("manual"),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (table) => ({ diagnosisIdx: index("recommendations_diagnosis_idx").on(table.diagnosisId) }),
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    faultId: text("fault_id").references(() => faults.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    severity: text("severity").notNull().default("critical"),
    channel: text("channel").notNull().default("in-app"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    faultIdx: index("notifications_fault_idx").on(table.faultId),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

export const scenarios = pgTable("scenarios", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  targetDeviceId: text("target_device_id").references(() => devices.id),
  targetLinkId: text("target_link_id").references(() => links.id),
  intensity: integer("intensity").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const trials = pgTable(
  "trials",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id),
    trialNumber: integer("trial_number").notNull(),
    monitor: text("monitor").notNull().default("prototype"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true }),
    detectionTimeMs: doublePrecision("detection_time_ms"),
    diagnosisTimeMs: doublePrecision("diagnosis_time_ms"),
    recoveryTimeMs: doublePrecision("recovery_time_ms"),
    diagnosisAccuracy: boolean("diagnosis_accuracy"),
    detectedFaultType: text("detected_fault_type"),
    packetLossPct: doublePrecision("packet_loss_pct"),
    avgResponseTimeMs: doublePrecision("avg_response_time_ms"),
    status: text("status").notNull().default("running"),
  },
  (table) => ({
    scenarioIdx: index("trials_scenario_idx").on(table.scenarioId),
    monitorIdx: index("trials_monitor_idx").on(table.monitor),
  }),
);

export const metricSamples = pgTable(
  "metric_samples",
  {
    id: text("id").primaryKey(),
    trialId: text("trial_id").references(() => trials.id),
    deviceId: text("device_id").references(() => devices.id),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    responseTimeMs: doublePrecision("response_time_ms"),
    latencyMs: doublePrecision("latency_ms"),
    packetLossPct: doublePrecision("packet_loss_pct"),
    bandwidthUtilPct: doublePrecision("bandwidth_util_pct"),
  },
  (table) => ({
    trialIdx: index("metric_samples_trial_idx").on(table.trialId),
    recordedAtIdx: index("metric_samples_recorded_at_idx").on(table.recordedAt),
  }),
);

export const automations = pgTable(
  "automations",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull().default("local"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    scheduleLabel: text("schedule_label").notNull().default("every 30 seconds"),
    cron: text("cron"),
    intervalSeconds: integer("interval_seconds").notNull().default(30),
    scheduleKind: text("schedule_kind").notNull().default("interval"),
    dailyAt: text("daily_at"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    orgIdx: index("automations_org_idx").on(table.organizationId),
    enabledIdx: index("automations_enabled_idx").on(table.enabled),
  }),
);

export const automationNodes = pgTable(
  "automation_nodes",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    deviceName: text("device_name"),
    ipAddress: text("ip_address"),
    subnet: text("subnet"),
    location: text("location"),
    pollIntervalSeconds: integer("poll_interval_seconds"),
    timeoutSeconds: integer("timeout_seconds"),
    email: text("email"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    automationIdx: index("automation_nodes_automation_idx").on(table.automationId),
  }),
);

export const automationEdges = pgTable(
  "automation_edges",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({ automationIdx: index("automation_edges_automation_idx").on(table.automationId) }),
);

export const emailRecipients = pgTable(
  "email_recipients",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    label: text("label").notNull().default("Administrator"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({ automationIdx: index("email_recipients_automation_idx").on(table.automationId) }),
);

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: text("id").primaryKey(),
    automationId: text("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("succeeded"),
    trigger: text("trigger").notNull().default("schedule"),
    devicesChecked: integer("devices_checked").notNull().default(0),
    faultsDetected: integer("faults_detected").notNull().default(0),
    faultsResolved: integer("faults_resolved").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
    emailStatus: text("email_status"),
    durationMs: integer("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    automationIdx: index("automation_runs_automation_idx").on(table.automationId),
    startedAtIdx: index("automation_runs_started_at_idx").on(table.startedAt),
  }),
);

export const monitoringEvents = pgTable(
  "monitoring_events",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    deviceId: text("device_id").references(() => devices.id),
    faultId: text("fault_id").references(() => faults.id),
    trialId: text("trial_id").references(() => trials.id),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    kindIdx: index("monitoring_events_kind_idx").on(table.kind),
    createdAtIdx: index("monitoring_events_created_at_idx").on(table.createdAt),
  }),
);
