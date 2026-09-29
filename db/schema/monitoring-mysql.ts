/**
 * MUBAS NetWatch — network monitoring schema (MySQL dialect).
 * Mirrors monitoring-sqlite.ts so organizations can bring their own MySQL.
 */
import { boolean, double, index, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const devices = mysqlTable(
  "devices",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    kind: varchar("kind", { length: 32 }).notNull(),
    role: varchar("role", { length: 32 }).notNull().default("access"),
    ipAddress: varchar("ip_address", { length: 45 }).notNull().unique(),
    subnet: varchar("subnet", { length: 64 }).notNull().default("192.168.1.0/24"),
    macAddress: varchar("mac_address", { length: 32 }),
    location: varchar("location", { length: 128 }).notNull().default("campus"),
    vendor: varchar("vendor", { length: 128 }).notNull().default("Cisco"),
    model: varchar("model", { length: 128 }),
    snmpCommunity: varchar("snmp_community", { length: 128 }).notNull().default("public"),
    snmpVersion: varchar("snmp_version", { length: 8 }).notNull().default("2c"),
    pollIntervalSeconds: int("poll_interval_seconds").notNull().default(30),
    timeoutSeconds: int("timeout_seconds").notNull().default(5),
    latencyBaselineMs: double("latency_baseline_ms").notNull().default(1),
    congestionThreshold: int("congestion_threshold").notNull().default(80),
    enabled: boolean("enabled").notNull().default(true),
    status: varchar("status", { length: 32 }).notNull().default("unknown"),
    lastSeenAt: timestamp("last_seen_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    statusIdx: index("devices_status_idx").on(table.status),
    locationIdx: index("devices_location_idx").on(table.location),
  }),
);

export const links = mysqlTable(
  "links",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    sourceDeviceId: varchar("source_device_id", { length: 64 })
      .notNull()
      .references(() => devices.id),
    targetDeviceId: varchar("target_device_id", { length: 64 })
      .notNull()
      .references(() => devices.id),
    medium: varchar("medium", { length: 32 }).notNull().default("ethernet"),
    speedMbps: int("speed_mbps").notNull().default(1000),
    status: varchar("status", { length: 32 }).notNull().default("up"),
    up: boolean("up").notNull().default(true),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    sourceIdx: index("links_source_idx").on(table.sourceDeviceId),
    targetIdx: index("links_target_idx").on(table.targetDeviceId),
  }),
);

export const pollResults = mysqlTable(
  "poll_results",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    deviceId: varchar("device_id", { length: 64 })
      .notNull()
      .references(() => devices.id),
    cycle: int("cycle").notNull(),
    polledAt: timestamp("polled_at").notNull(),
    responded: boolean("responded").notNull(),
    withinTimeout: boolean("within_timeout").notNull(),
    responseTimeMs: double("response_time_ms"),
    latencyMs: double("latency_ms"),
    jitterMs: double("jitter_ms"),
    packetLossPct: double("packet_loss_pct"),
    bandwidthUtilPct: double("bandwidth_util_pct"),
    cpuLoadPct: double("cpu_load_pct"),
    memoryLoadPct: double("memory_load_pct"),
    uptimeSeconds: int("uptime_seconds"),
    errorCode: varchar("error_code", { length: 64 }),
    errorMessage: text("error_message"),
  },
  (table) => ({
    deviceIdx: index("poll_results_device_idx").on(table.deviceId),
    cycleIdx: index("poll_results_cycle_idx").on(table.cycle),
    polledAtIdx: index("poll_results_polled_at_idx").on(table.polledAt),
  }),
);

export const faults = mysqlTable(
  "faults",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    type: varchar("type", { length: 32 }).notNull(),
    severity: varchar("severity", { length: 32 }).notNull().default("critical"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    deviceId: varchar("device_id", { length: 64 }).references(() => devices.id),
    linkId: varchar("link_id", { length: 64 }).references(() => links.id),
    scenarioId: varchar("scenario_id", { length: 64 }).references(() => scenarios.id),
    trialId: varchar("trial_id", { length: 64 }).references(() => trials.id),
    detectionTimeMs: double("detection_time_ms"),
    detectedAt: timestamp("detected_at").notNull(),
    detectedBy: varchar("detected_by", { length: 32 }).notNull().default("prototype"),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    resolvedAt: timestamp("resolved_at"),
    resolutionTimeMs: double("resolution_time_ms"),
    resolutionNote: text("resolution_note"),
  },
  (table) => ({
    typeIdx: index("faults_type_idx").on(table.type),
    statusIdx: index("faults_status_idx").on(table.status),
    detectedAtIdx: index("faults_detected_at_idx").on(table.detectedAt),
  }),
);

export const diagnoses = mysqlTable(
  "diagnoses",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    faultId: varchar("fault_id", { length: 64 })
      .notNull()
      .references(() => faults.id),
    faultType: varchar("fault_type", { length: 32 }).notNull(),
    cause: varchar("cause", { length: 32 }).notNull(),
    summary: text("summary").notNull(),
    evidence: json("evidence").notNull(),
    affectedDeviceIds: json("affected_device_ids").notNull(),
    confidencePct: double("confidence_pct").notNull().default(0),
    diagnosedAt: timestamp("diagnosed_at").notNull(),
  },
  (table) => ({ faultIdx: index("diagnoses_fault_idx").on(table.faultId) }),
);

export const recommendations = mysqlTable(
  "recommendations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    diagnosisId: varchar("diagnosis_id", { length: 64 })
      .notNull()
      .references(() => diagnoses.id),
    faultType: varchar("fault_type", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    detail: text("detail").notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("high"),
    actionClass: varchar("action_class", { length: 16 }).notNull().default("manual"),
    acknowledgedAt: timestamp("acknowledged_at"),
  },
  (table) => ({ diagnosisIdx: index("recommendations_diagnosis_idx").on(table.diagnosisId) }),
);

export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    faultId: varchar("fault_id", { length: 64 }).references(() => faults.id),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    severity: varchar("severity", { length: 32 }).notNull().default("critical"),
    channel: varchar("channel", { length: 32 }).notNull().default("in-app"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    faultIdx: index("notifications_fault_idx").on(table.faultId),
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
  }),
);

export const scenarios = mysqlTable("scenarios", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  description: text("description").notNull(),
  targetDeviceId: varchar("target_device_id", { length: 64 }).references(() => devices.id),
  targetLinkId: varchar("target_link_id", { length: 64 }).references(() => links.id),
  intensity: int("intensity").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull(),
});

export const trials = mysqlTable(
  "trials",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    scenarioId: varchar("scenario_id", { length: 64 })
      .notNull()
      .references(() => scenarios.id),
    trialNumber: int("trial_number").notNull(),
    monitor: varchar("monitor", { length: 16 }).notNull().default("prototype"),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at"),
    detectedAt: timestamp("detected_at"),
    detectionTimeMs: double("detection_time_ms"),
    diagnosisTimeMs: double("diagnosis_time_ms"),
    recoveryTimeMs: double("recovery_time_ms"),
    diagnosisAccuracy: boolean("diagnosis_accuracy"),
    detectedFaultType: varchar("detected_fault_type", { length: 32 }),
    packetLossPct: double("packet_loss_pct"),
    avgResponseTimeMs: double("avg_response_time_ms"),
    status: varchar("status", { length: 16 }).notNull().default("running"),
  },
  (table) => ({
    scenarioIdx: index("trials_scenario_idx").on(table.scenarioId),
    monitorIdx: index("trials_monitor_idx").on(table.monitor),
  }),
);

export const metricSamples = mysqlTable(
  "metric_samples",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    trialId: varchar("trial_id", { length: 64 }).references(() => trials.id),
    deviceId: varchar("device_id", { length: 64 }).references(() => devices.id),
    recordedAt: timestamp("recorded_at").notNull(),
    responseTimeMs: double("response_time_ms"),
    latencyMs: double("latency_ms"),
    packetLossPct: double("packet_loss_pct"),
    bandwidthUtilPct: double("bandwidth_util_pct"),
  },
  (table) => ({
    trialIdx: index("metric_samples_trial_idx").on(table.trialId),
    recordedAtIdx: index("metric_samples_recorded_at_idx").on(table.recordedAt),
  }),
);

export const automations = mysqlTable(
  "automations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    organizationId: varchar("organization_id", { length: 64 }).notNull().default("local"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    scheduleLabel: varchar("schedule_label", { length: 128 }).notNull().default("every 30 seconds"),
    cron: varchar("cron", { length: 128 }),
    intervalSeconds: int("interval_seconds").notNull().default(30),
    scheduleKind: varchar("schedule_kind", { length: 16 }).notNull().default("interval"),
    dailyAt: varchar("daily_at", { length: 8 }),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    createdBy: varchar("created_by", { length: 64 }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    orgIdx: index("automations_org_idx").on(table.organizationId),
    enabledIdx: index("automations_enabled_idx").on(table.enabled),
  }),
);

export const automationNodes = mysqlTable(
  "automation_nodes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    automationId: varchar("automation_id", { length: 64 })
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    positionX: int("position_x").notNull().default(0),
    positionY: int("position_y").notNull().default(0),
    deviceName: varchar("device_name", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    subnet: varchar("subnet", { length: 64 }),
    location: varchar("location", { length: 128 }),
    pollIntervalSeconds: int("poll_interval_seconds"),
    timeoutSeconds: int("timeout_seconds"),
    email: varchar("email", { length: 255 }),
    config: json("config"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    automationIdx: index("automation_nodes_automation_idx").on(table.automationId),
  }),
);

export const automationEdges = mysqlTable(
  "automation_edges",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    automationId: varchar("automation_id", { length: 64 })
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    sourceNodeId: varchar("source_node_id", { length: 64 }).notNull(),
    targetNodeId: varchar("target_node_id", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({ automationIdx: index("automation_edges_automation_idx").on(table.automationId) }),
);

export const emailRecipients = mysqlTable(
  "email_recipients",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    automationId: varchar("automation_id", { length: 64 })
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    label: varchar("label", { length: 128 }).notNull().default("Administrator"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({ automationIdx: index("email_recipients_automation_idx").on(table.automationId) }),
);

export const automationRuns = mysqlTable(
  "automation_runs",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    automationId: varchar("automation_id", { length: 64 })
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("succeeded"),
    trigger: varchar("trigger", { length: 16 }).notNull().default("schedule"),
    devicesChecked: int("devices_checked").notNull().default(0),
    faultsDetected: int("faults_detected").notNull().default(0),
    faultsResolved: int("faults_resolved").notNull().default(0),
    emailsSent: int("emails_sent").notNull().default(0),
    emailStatus: text("email_status"),
    durationMs: int("duration_ms").notNull().default(0),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (table) => ({
    automationIdx: index("automation_runs_automation_idx").on(table.automationId),
    startedAtIdx: index("automation_runs_started_at_idx").on(table.startedAt),
  }),
);

export const monitoringEvents = mysqlTable(
  "monitoring_events",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    kind: varchar("kind", { length: 32 }).notNull(),
    message: text("message").notNull(),
    deviceId: varchar("device_id", { length: 64 }).references(() => devices.id),
    faultId: varchar("fault_id", { length: 64 }).references(() => faults.id),
    trialId: varchar("trial_id", { length: 64 }).references(() => trials.id),
    payload: json("payload"),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => ({
    kindIdx: index("monitoring_events_kind_idx").on(table.kind),
    createdAtIdx: index("monitoring_events_created_at_idx").on(table.createdAt),
  }),
);
