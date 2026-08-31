import { and, desc, eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  assessmentResults,
  assessments,
  enrollments,
  InsertUser,
  learningPaths,
  lessonProgress,
  lessons,
  notifications,
  studentReports,
  users,
} from "../drizzle/schema.js";
import { calculateOverallProgress, calculateTrackProgress, levelFromProgress } from "./academyMetrics.js";
import { gradeNotificationPayload, reportNotificationPayload } from "./notificationPayloads.js";
import { ENV } from "./_core/env.js";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      const sslMode = url.searchParams.get("sslaccept");
      url.searchParams.delete("sslaccept");

      _db = drizzle({
        connection: {
          uri: url.toString(),
          ssl: sslMode === "strict"
            ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
            : undefined,
        },
      });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}


export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createUser(user: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const result = await db.insert(users).values(user);
  return Number(result[0].insertId);
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getLearningPaths(publishedOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(learningPaths);
  return publishedOnly
    ? query.where(eq(learningPaths.isPublished, true)).orderBy(desc(learningPaths.createdAt))
    : query.orderBy(desc(learningPaths.createdAt));
}

export async function createLearningPath(input: {
  slug: string;
  title: string;
  description?: string;
  level: "مبتدئ" | "متوسط" | "متقدم";
  accent: string;
  estimatedHours: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const result = await db.insert(learningPaths).values({ ...input, isPublished: false });
  return { id: Number(result[0].insertId) };
}

export async function setPathPublished(pathId: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await db.update(learningPaths).set({ isPublished }).where(eq(learningPaths.id, pathId));
}

export async function getLessonsByPath(pathId: number, publishedOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(lessons).where(eq(lessons.pathId, pathId));
  const result = await query.orderBy(lessons.position);
  return publishedOnly ? result.filter(lesson => lesson.isPublished) : result;
}

export async function createLesson(input: {
  pathId: number;
  title: string;
  summary?: string;
  content?: string;
  lessonType: "video" | "article" | "workshop" | "resource";
  sourceUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  durationMinutes: number;
  position: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  return createLessonWithDb(db, input);
}

export async function createLessonWithDb(db: any, input: {
  pathId: number;
  title: string;
  summary?: string;
  content?: string;
  lessonType: "video" | "article" | "workshop" | "resource";
  sourceUrl?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  durationMinutes: number;
  position: number;
}) {
  const result = await db.insert(lessons).values({ ...input, isPublished: true });
  return { id: Number(result[0].insertId) };
}

export async function setLessonPublished(lessonId: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await db.update(lessons).set({ isPublished }).where(eq(lessons.id, lessonId));
}

export async function createAssessment(input: {
  pathId: number;
  title: string;
  description?: string;
  externalUrl: string;
  maxScore: number;
  position: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const result = await db.insert(assessments).values({ ...input, isPublished: false });
  return { id: Number(result[0].insertId) };
}

export async function setAssessmentPublished(assessmentId: number, isPublished: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await db.update(assessments).set({ isPublished }).where(eq(assessments.id, assessmentId));
}

export async function getAssessmentsByPath(pathId: number, publishedOnly = true) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(assessments).where(eq(assessments.pathId, pathId)).orderBy(assessments.position);
  return publishedOnly ? rows.filter(item => item.isPublished) : rows;
}

export async function enrollStudent(studentId: number, pathId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await db.insert(enrollments).values({ studentId, pathId }).onDuplicateKeyUpdate({ set: { studentId } });
}

export async function completeLesson(studentId: number, lessonId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  const lesson = (await db.select({ id: lessons.id, pathId: lessons.pathId, isPublished: lessons.isPublished }).from(lessons).where(eq(lessons.id, lessonId)).limit(1))[0];
  if (!lesson?.isPublished) throw new Error("الدرس غير متاح للتسجيل حالياً");
  const enrollment = (await db.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.studentId, studentId), eq(enrollments.pathId, lesson.pathId))).limit(1))[0];
  if (!enrollment) throw new Error("سجّلي في المسار قبل تحديد الدرس كمكتمل");
  const completedAt = new Date();
  await db.insert(lessonProgress).values({ studentId, lessonId, completedAt }).onDuplicateKeyUpdate({ set: { completedAt } });
}

export async function getStudentDashboard(studentId: number) {
  const db = await getDb();
  if (!db) return null;

  const [enrollmentRows, allLessons, progressRows, resultRows, reportRows, notificationRows] = await Promise.all([
    db.select({ path: learningPaths, enrollment: enrollments }).from(enrollments).innerJoin(learningPaths, eq(enrollments.pathId, learningPaths.id)).where(eq(enrollments.studentId, studentId)),
    db.select().from(lessons).where(eq(lessons.isPublished, true)),
    db.select().from(lessonProgress).where(and(eq(lessonProgress.studentId, studentId), isNotNull(lessonProgress.completedAt))),
    db.select({ result: assessmentResults, assessment: assessments }).from(assessmentResults).innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id)).where(eq(assessmentResults.studentId, studentId)).orderBy(desc(assessmentResults.releasedAt)),
    db.select().from(studentReports).where(and(eq(studentReports.studentId, studentId), eq(studentReports.isPublished, true))).orderBy(desc(studentReports.publishedAt)),
    db.select().from(notifications).where(eq(notifications.recipientId, studentId)).orderBy(desc(notifications.createdAt)),
  ]);

  const completedIds = new Set(progressRows.map(row => row.lessonId));
  const paths = enrollmentRows.map(({ path }) => {
    const pathLessons = allLessons.filter(lesson => lesson.pathId === path.id);
    const completedLessonCount = pathLessons.filter(lesson => completedIds.has(lesson.id)).length;
    return { ...path, lessonCount: pathLessons.length, completedLessonCount, progress: calculateTrackProgress({ lessonCount: pathLessons.length, completedLessonCount }) };
  });
  const overallProgress = calculateOverallProgress(paths.map(path => path.progress));
  const averageScore = resultRows.length ? Math.round(resultRows.reduce((total, row) => total + row.result.score, 0) / resultRows.length) : null;
  return {
    paths,
    overallProgress,
    currentLevel: levelFromProgress(overallProgress),
    averageScore,
    recentResults: resultRows,
    latestReport: reportRows[0] ?? null,
    notifications: notificationRows,
    completedLessonIds: Array.from(completedIds),
  };
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return null;
  const [studentRows, pathRows, lessonRows, assessmentRows, resultRows, reportRows, enrollmentRows, progressRows] = await Promise.all([
    db.select().from(users).where(eq(users.role, "user")).orderBy(desc(users.lastSignedIn)),
    db.select().from(learningPaths).orderBy(desc(learningPaths.createdAt)),
    db.select().from(lessons),
    db.select().from(assessments),
    db.select({ result: assessmentResults, assessment: assessments, student: users }).from(assessmentResults).innerJoin(assessments, eq(assessmentResults.assessmentId, assessments.id)).innerJoin(users, eq(assessmentResults.studentId, users.id)).orderBy(desc(assessmentResults.releasedAt)),
    db.select().from(studentReports).orderBy(desc(studentReports.updatedAt)),
    db.select().from(enrollments),
    db.select().from(lessonProgress).where(isNotNull(lessonProgress.completedAt)),
  ]);
  const students = studentRows.map(student => {
    const enrolledPathIds = new Set(enrollmentRows.filter(item => item.studentId === student.id).map(item => item.pathId));
    const completedLessonIds = new Set(progressRows.filter(item => item.studentId === student.id).map(item => item.lessonId));
    const trackProgress = Array.from(enrolledPathIds).map(pathId => {
      const pathLessons = lessonRows.filter(lesson => lesson.pathId === pathId && lesson.isPublished);
      return calculateTrackProgress({ lessonCount: pathLessons.length, completedLessonCount: pathLessons.filter(lesson => completedLessonIds.has(lesson.id)).length });
    });
    const progress = calculateOverallProgress(trackProgress);
    const studentResults = resultRows.filter(item => item.result.studentId === student.id);
    const averageScore = studentResults.length ? Math.round(studentResults.reduce((sum, item) => sum + item.result.score, 0) / studentResults.length) : null;
    return { ...student, progress, averageScore, currentLevel: levelFromProgress(progress), enrolledPathCount: enrolledPathIds.size };
  });
  return { students, paths: pathRows, lessons: lessonRows, assessments: assessmentRows, results: resultRows, reports: reportRows };
}

export async function releaseAssessmentResult(input: {
  assessmentId: number;
  studentId: number;
  score: number;
  feedback?: string;
  reviewedById: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await releaseAssessmentResultWithDb(db, input);
}

export async function releaseAssessmentResultWithDb(db: any, input: {
  assessmentId: number;
  studentId: number;
  score: number;
  feedback?: string;
  reviewedById: number;
}) {
  const releasedAt = new Date();
  await db.insert(assessmentResults).values({ ...input, releasedAt }).onDuplicateKeyUpdate({ set: { score: input.score, feedback: input.feedback ?? null, reviewedById: input.reviewedById, releasedAt, notifiedAt: null } });
  await db.insert(notifications).values({ recipientId: input.studentId, ...gradeNotificationPayload() });
}

export async function publishStudentReport(input: {
  studentId: number;
  authorId: number;
  title: string;
  summary: string;
  currentLevel: "مبتدئ" | "متوسط" | "متقدم";
  overallProgress: number;
  skills?: Array<{ label: string; value: number }>;
}) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حالياً");
  await publishStudentReportWithDb(db, input);
}

export async function publishStudentReportWithDb(db: any, input: {
  studentId: number;
  authorId: number;
  title: string;
  summary: string;
  currentLevel: "مبتدئ" | "متوسط" | "متقدم";
  overallProgress: number;
  skills?: Array<{ label: string; value: number }>;
}) {
  const publishedAt = new Date();
  await db.insert(studentReports).values({ ...input, skills: input.skills ?? [], isPublished: true, publishedAt });
  await db.insert(notifications).values({ recipientId: input.studentId, ...reportNotificationPayload() });
}

export async function markNotificationRead(notificationId: number, studentId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, studentId)));
}
