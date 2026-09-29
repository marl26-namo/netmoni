CREATE TABLE `automation_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_edges_automation_idx` ON `automation_edges` (`automation_id`);--> statement-breakpoint
CREATE TABLE `automation_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`position_x` integer DEFAULT 0 NOT NULL,
	`position_y` integer DEFAULT 0 NOT NULL,
	`device_name` text,
	`ip_address` text,
	`subnet` text,
	`location` text,
	`poll_interval_seconds` integer,
	`timeout_seconds` integer,
	`email` text,
	`config` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_nodes_automation_idx` ON `automation_nodes` (`automation_id`);--> statement-breakpoint
CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`status` text DEFAULT 'succeeded' NOT NULL,
	`trigger` text DEFAULT 'schedule' NOT NULL,
	`devices_checked` integer DEFAULT 0 NOT NULL,
	`faults_detected` integer DEFAULT 0 NOT NULL,
	`faults_resolved` integer DEFAULT 0 NOT NULL,
	`emails_sent` integer DEFAULT 0 NOT NULL,
	`email_status` text,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automation_runs_automation_idx` ON `automation_runs` (`automation_id`);--> statement-breakpoint
CREATE INDEX `automation_runs_started_at_idx` ON `automation_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text DEFAULT 'local' NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`schedule_label` text DEFAULT 'every 30 seconds' NOT NULL,
	`cron` text,
	`interval_seconds` integer DEFAULT 30 NOT NULL,
	`schedule_kind` text DEFAULT 'interval' NOT NULL,
	`daily_at` text,
	`last_run_at` text,
	`next_run_at` text,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `automations_org_idx` ON `automations` (`organization_id`);--> statement-breakpoint
CREATE INDEX `automations_enabled_idx` ON `automations` (`enabled`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`role` text DEFAULT 'access' NOT NULL,
	`ip_address` text NOT NULL,
	`subnet` text DEFAULT '192.168.1.0/24' NOT NULL,
	`mac_address` text,
	`location` text DEFAULT 'campus' NOT NULL,
	`vendor` text DEFAULT 'Cisco' NOT NULL,
	`model` text,
	`snmp_community` text DEFAULT 'public' NOT NULL,
	`snmp_version` text DEFAULT '2c' NOT NULL,
	`poll_interval_seconds` integer DEFAULT 30 NOT NULL,
	`timeout_seconds` integer DEFAULT 5 NOT NULL,
	`latency_baseline_ms` real DEFAULT 1 NOT NULL,
	`congestion_threshold` integer DEFAULT 80 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_ip_address_unique` ON `devices` (`ip_address`);--> statement-breakpoint
CREATE INDEX `devices_status_idx` ON `devices` (`status`);--> statement-breakpoint
CREATE INDEX `devices_location_idx` ON `devices` (`location`);--> statement-breakpoint
CREATE TABLE `diagnoses` (
	`id` text PRIMARY KEY NOT NULL,
	`fault_id` text NOT NULL,
	`fault_type` text NOT NULL,
	`cause` text NOT NULL,
	`summary` text NOT NULL,
	`evidence` text NOT NULL,
	`affected_device_ids` text NOT NULL,
	`confidence_pct` real DEFAULT 0 NOT NULL,
	`diagnosed_at` text NOT NULL,
	FOREIGN KEY (`fault_id`) REFERENCES `faults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `diagnoses_fault_idx` ON `diagnoses` (`fault_id`);--> statement-breakpoint
CREATE TABLE `email_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`email` text NOT NULL,
	`label` text DEFAULT 'Administrator' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_recipients_automation_idx` ON `email_recipients` (`automation_id`);--> statement-breakpoint
CREATE TABLE `faults` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`severity` text DEFAULT 'critical' NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`device_id` text,
	`link_id` text,
	`scenario_id` text,
	`trial_id` text,
	`detection_time_ms` real,
	`detected_at` text NOT NULL,
	`detected_by` text DEFAULT 'prototype' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` text,
	`resolution_time_ms` real,
	`resolution_note` text,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trial_id`) REFERENCES `trials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `faults_type_idx` ON `faults` (`type`);--> statement-breakpoint
CREATE INDEX `faults_status_idx` ON `faults` (`status`);--> statement-breakpoint
CREATE INDEX `faults_detected_at_idx` ON `faults` (`detected_at`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source_device_id` text NOT NULL,
	`target_device_id` text NOT NULL,
	`medium` text DEFAULT 'ethernet' NOT NULL,
	`speed_mbps` integer DEFAULT 1000 NOT NULL,
	`status` text DEFAULT 'up' NOT NULL,
	`up` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`source_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `links_source_idx` ON `links` (`source_device_id`);--> statement-breakpoint
CREATE INDEX `links_target_idx` ON `links` (`target_device_id`);--> statement-breakpoint
CREATE TABLE `metric_samples` (
	`id` text PRIMARY KEY NOT NULL,
	`trial_id` text,
	`device_id` text,
	`recorded_at` text NOT NULL,
	`response_time_ms` real,
	`latency_ms` real,
	`packet_loss_pct` real,
	`bandwidth_util_pct` real,
	FOREIGN KEY (`trial_id`) REFERENCES `trials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `metric_samples_trial_idx` ON `metric_samples` (`trial_id`);--> statement-breakpoint
CREATE INDEX `metric_samples_recorded_at_idx` ON `metric_samples` (`recorded_at`);--> statement-breakpoint
CREATE TABLE `monitoring_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`device_id` text,
	`fault_id` text,
	`trial_id` text,
	`payload` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fault_id`) REFERENCES `faults`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`trial_id`) REFERENCES `trials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `monitoring_events_kind_idx` ON `monitoring_events` (`kind`);--> statement-breakpoint
CREATE INDEX `monitoring_events_created_at_idx` ON `monitoring_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`fault_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`severity` text DEFAULT 'critical' NOT NULL,
	`channel` text DEFAULT 'in-app' NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`fault_id`) REFERENCES `faults`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notifications_fault_idx` ON `notifications` (`fault_id`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);--> statement-breakpoint
CREATE TABLE `poll_results` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`cycle` integer NOT NULL,
	`polled_at` text NOT NULL,
	`responded` integer NOT NULL,
	`within_timeout` integer NOT NULL,
	`response_time_ms` real,
	`latency_ms` real,
	`jitter_ms` real,
	`packet_loss_pct` real,
	`bandwidth_util_pct` real,
	`cpu_load_pct` real,
	`memory_load_pct` real,
	`uptime_seconds` integer,
	`error_code` text,
	`error_message` text,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `poll_results_device_idx` ON `poll_results` (`device_id`);--> statement-breakpoint
CREATE INDEX `poll_results_cycle_idx` ON `poll_results` (`cycle`);--> statement-breakpoint
CREATE INDEX `poll_results_polled_at_idx` ON `poll_results` (`polled_at`);--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`diagnosis_id` text NOT NULL,
	`fault_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`priority` text DEFAULT 'high' NOT NULL,
	`action_class` text DEFAULT 'manual' NOT NULL,
	`acknowledged_at` text,
	FOREIGN KEY (`diagnosis_id`) REFERENCES `diagnoses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recommendations_diagnosis_idx` ON `recommendations` (`diagnosis_id`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`target_device_id` text,
	`target_link_id` text,
	`intensity` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`target_device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_link_id`) REFERENCES `links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trials` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`trial_number` integer NOT NULL,
	`monitor` text DEFAULT 'prototype' NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`detected_at` text,
	`detection_time_ms` real,
	`diagnosis_time_ms` real,
	`recovery_time_ms` real,
	`diagnosis_accuracy` integer,
	`detected_fault_type` text,
	`packet_loss_pct` real,
	`avg_response_time_ms` real,
	`status` text DEFAULT 'running' NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `trials_scenario_idx` ON `trials` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `trials_monitor_idx` ON `trials` (`monitor`);