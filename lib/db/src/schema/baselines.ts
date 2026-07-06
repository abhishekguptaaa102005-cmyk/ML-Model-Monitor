import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { modelVersionsTable } from "./models";

export const predictionBaselinesTable = pgTable("prediction_baselines", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => modelVersionsTable.id),
  bin: text("bin").notNull(),
  label: text("label").notNull(),
  count: real("count").notNull(),
  proportion: real("proportion").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type PredictionBaseline = typeof predictionBaselinesTable.$inferSelect;
