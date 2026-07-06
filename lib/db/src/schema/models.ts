import { pgTable, serial, text, integer, real, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modelStatusEnum = pgEnum("model_status", ["active", "degraded", "rolled_back", "shadow"]);
export const driftSeverityEnum = pgEnum("drift_severity", ["stable", "warning", "critical"]);
export const featureTypeEnum = pgEnum("feature_type", ["continuous", "categorical"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["warning", "critical"]);
export const alertTypeEnum = pgEnum("alert_type", ["drift", "latency", "null_rate", "schema_mismatch", "prediction_skew"]);
export const alertStatusEnum = pgEnum("alert_status", ["active", "resolved"]);
export const latencyStatusEnum = pgEnum("latency_status", ["normal", "warning", "critical"]);

export const modelVersionsTable = pgTable("model_versions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  status: modelStatusEnum("status").notNull().default("active"),
  deployedAt: timestamp("deployed_at").notNull().defaultNow(),
  dailyUsers: integer("daily_users").notNull().default(0),
  description: text("description"),
});

export const insertModelVersionSchema = createInsertSchema(modelVersionsTable).omit({ id: true });
export type InsertModelVersion = z.infer<typeof insertModelVersionSchema>;
export type ModelVersion = typeof modelVersionsTable.$inferSelect;

export const driftMetricsTable = pgTable("drift_metrics", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  psiScore: real("psi_score").notNull(),
  ksStatistic: real("ks_statistic").notNull(),
  chiSquareStat: real("chi_square_stat").notNull(),
  driftSeverity: driftSeverityEnum("drift_severity").notNull().default("stable"),
  featureCount: integer("feature_count").notNull().default(0),
});

export const insertDriftMetricSchema = createInsertSchema(driftMetricsTable).omit({ id: true });
export type InsertDriftMetric = z.infer<typeof insertDriftMetricSchema>;
export type DriftMetric = typeof driftMetricsTable.$inferSelect;

export const featureDriftScoresTable = pgTable("feature_drift_scores", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  featureName: text("feature_name").notNull(),
  featureType: featureTypeEnum("feature_type").notNull(),
  psiScore: real("psi_score").notNull(),
  ksStatistic: real("ks_statistic").notNull(),
  severity: driftSeverityEnum("severity").notNull().default("stable"),
  nullRate: real("null_rate").notNull().default(0),
  baselineNullRate: real("baseline_null_rate").notNull().default(0),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertFeatureDriftScoreSchema = createInsertSchema(featureDriftScoresTable).omit({ id: true });
export type InsertFeatureDriftScore = z.infer<typeof insertFeatureDriftScoreSchema>;
export type FeatureDriftScore = typeof featureDriftScoresTable.$inferSelect;

export const latencyMetricsTable = pgTable("latency_metrics", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  p50Ms: real("p50_ms").notNull(),
  p95Ms: real("p95_ms").notNull(),
  p99Ms: real("p99_ms").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  errorRate: real("error_rate").notNull().default(0),
});

export const insertLatencyMetricSchema = createInsertSchema(latencyMetricsTable).omit({ id: true });
export type InsertLatencyMetric = z.infer<typeof insertLatencyMetricSchema>;
export type LatencyMetric = typeof latencyMetricsTable.$inferSelect;

export const alertsTable = pgTable("alerts", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  severity: alertSeverityEnum("severity").notNull(),
  type: alertTypeEnum("type").notNull(),
  message: text("message").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  status: alertStatusEnum("status").notNull().default("active"),
  runbookUrl: text("runbook_url"),
});

export const insertAlertSchema = createInsertSchema(alertsTable).omit({ id: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alertsTable.$inferSelect;

export const featureStatsTable = pgTable("feature_stats", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  featureName: text("feature_name").notNull(),
  featureType: featureTypeEnum("feature_type").notNull(),
  nullRate: real("null_rate").notNull().default(0),
  baselineNullRate: real("baseline_null_rate").notNull().default(0),
  schemaMismatch: boolean("schema_mismatch").notNull().default(false),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const insertFeatureStatSchema = createInsertSchema(featureStatsTable).omit({ id: true });
export type InsertFeatureStat = z.infer<typeof insertFeatureStatSchema>;
export type FeatureStat = typeof featureStatsTable.$inferSelect;
