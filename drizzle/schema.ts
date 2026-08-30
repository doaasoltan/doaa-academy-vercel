import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Unique local/external identifier for the user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const learningPaths = mysqlTable("learningPaths", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 160 }).notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  level: mysqlEnum("level", ["مبتدئ", "متوسط", "متقدم"]).default("مبتدئ").notNull(),
  accent: varchar("accent", { length: 24 }).default("violet").notNull(),
  icon: varchar("icon", { length: 48 }).default("Code2").notNull(),
  coverImageUrl: text("coverImageUrl"),
  estimatedHours: int("estimatedHours").default(0).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  pathId: int("pathId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  summary: text("summary"),
  content: text("content"),
  lessonType: mysqlEnum("lessonType", ["video", "article", "workshop", "resource"]).default("article").notNull(),
  sourceUrl: text("sourceUrl"),
  attachmentUrl: text("attachmentUrl"),
  attachmentName: varchar("attachmentName", { length: 220 }),
  coverImageUrl: text("coverImageUrl"),
  durationMinutes: int("durationMinutes").default(15).notNull(),
  position: int("position").default(1).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  pathId: int("pathId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  description: text("description"),
  externalUrl: text("externalUrl").notNull(),
  maxScore: int("maxScore").default(100).notNull(),
  position: int("position").default(1).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const enrollments = mysqlTable("enrollments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  pathId: int("pathId").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
}, table => [uniqueIndex("enrollment_student_path_idx").on(table.studentId, table.pathId)]);

export const lessonProgress = mysqlTable("lessonProgress", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  lessonId: int("lessonId").notNull(),
  completedAt: timestamp("completedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("lesson_progress_student_lesson_idx").on(table.studentId, table.lessonId)]);

export const assessmentResults = mysqlTable("assessmentResults", {
  id: int("id").autoincrement().primaryKey(),
  assessmentId: int("assessmentId").notNull(),
  studentId: int("studentId").notNull(),
  score: int("score").notNull(),
  feedback: text("feedback"),
  reviewedById: int("reviewedById"),
  releasedAt: timestamp("releasedAt").defaultNow().notNull(),
  notifiedAt: timestamp("notifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("assessment_result_student_assessment_idx").on(table.assessmentId, table.studentId)]);

export const studentReports = mysqlTable("studentReports", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull(),
  authorId: int("authorId").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  summary: text("summary").notNull(),
  currentLevel: mysqlEnum("currentLevel", ["مبتدئ", "متوسط", "متقدم"]).default("مبتدئ").notNull(),
  overallProgress: int("overallProgress").default(0).notNull(),
  skills: json("skills").$type<Array<{ label: string; value: number }>>(),
  isPublished: boolean("isPublished").default(false).notNull(),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  recipientId: int("recipientId").notNull(),
  type: mysqlEnum("type", ["grade", "report", "lesson", "system"]).default("system").notNull(),
  title: varchar("title", { length: 220 }).notNull(),
  message: text("message").notNull(),
  link: text("link"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LearningPath = typeof learningPaths.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type AssessmentResult = typeof assessmentResults.$inferSelect;
export type StudentReport = typeof studentReports.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
