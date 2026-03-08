import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  concatFilePath: text("concat_file_path"),
  duration: real("duration"),
  mediaType: text("media_type"),
  concatStatus: text("concat_status").default("done"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const sourceFiles = sqliteTable("source_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  duration: real("duration"),
  sortOrder: integer("sort_order").notNull(),
});

export const timelines = sqliteTable("timelines", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  fromTime: real("from_time").notNull(),
  toTime: real("to_time").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const projectSettings = sqliteTable("project_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  outputFormat: text("output_format").notNull().default("copy"),
  mp3Bitrate: text("mp3_bitrate").default("192k"),
});
