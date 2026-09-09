/**
 * Demo-mode data store.
 *
 * Used ONLY when DEMO_MODE=true (local/preview demos without MySQL).
 * Mirrors the API of server/db.ts with a file-persisted in-memory store.
 * Production (Vercel + TiDB) never touches this file.
 */
import fs from "node:fs";
import path from "node:path";
import { lessonProgress } from "../drizzle/schema.js";
import type {
  Assessment,
  AssessmentResult,
  Enrollment,
  InsertUser,
  LearningPath,
  Lesson,
  Notification,
  StudentReport,
  User,
} from "../drizzle/schema.js";
import { calculateOverallProgress, calculateTrackProgress, levelFromProgress } from "./academyMetrics.js";
import { gradeNotificationPayload, reportNotificationPayload } from "./notificationPayloads.js";
import { ENV } from "./_core/env.js";

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

type LessonProgressRow = typeof lessonProgress.$inferSelect;

type DemoState = {
  users: User[];
  learningPaths: LearningPath[];
  lessons: Lesson[];
  assessments: Assessment[];
  enrollments: Enrollment[];
  lessonProgress: LessonProgressRow[];
  assessmentResults: AssessmentResult[];
  studentReports: StudentReport[];
  notifications: Notification[];
  seq: Record<string, number>;
};

const DATA_FILE = path.resolve(process.cwd(), "uploads/.demo-data.json");

// scrypt hash of "Demo1234" (demo student password).
const DEMO_STUDENT_PASSWORD_HASH =
  "scrypt$0ec5abc444c7de88e898b26941f639aa$6150ccc7695bb51f546d8ccde08b3871faa0ad81a44d2e785df7f785043a0d8d93e2f0e4193cac985b46027404d0852d9edd916d55f4c52d5a40e245c9034193";

function encodeDates(value: unknown): unknown {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeDates);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encodeDates(entry)]));
  }
  return value;
}

function decodeDates(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeDates);
  if (value && typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$date === "string" && Object.keys(obj).length === 1) return new Date(obj.$date);
    return Object.fromEntries(Object.entries(obj).map(([key, entry]) => [key, decodeDates(entry)]));
  }
  return value;
}

function toProtectedBlobUrl(value: string | null | undefined) {
  if (!value) return value;
  if (value.startsWith("/api/blob-file?")) return value;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".private.blob.vercel-storage.com")) {
      const pathname = url.pathname.replace(/^\/+/, "");
      return `/api/blob-file?pathname=${encodeURIComponent(pathname)}`;
    }
  } catch {
    // Keep non-URL values unchanged.
  }
  return value;
}

let state: DemoState | null = null;
let announced = false;

function buildSeed(): DemoState {
  const now = new Date();
  return {
    users: [
      {
        id: 1,
        openId: "seed-demo-student",
        name: "طالبة تجريبية",
        email: "student@demo.test",
        passwordHash: DEMO_STUDENT_PASSWORD_HASH,
        loginMethod: "password",
        role: "user",
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      },
    ],
    learningPaths: [
      {
        id: 1,
        slug: "web-fundamentals",
        title: "أساسيات تطوير الويب",
        description: "مسار تجريبي يعرفكِ على HTML وCSS وأدوات المطور من الصفر.",
        level: "مبتدئ",
        accent: "violet",
        icon: "Code2",
        coverImageUrl: null,
        estimatedHours: 6,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    lessons: [
      {
        id: 1,
        pathId: 1,
        title: "تعرفي على HTML",
        summary: "ما هي لغة HTML وكيف تُبنى الصفحة الأولى؟",
        content: "درس تجريبي: ابدئي ببنية الصفحة الأساسية ثم أضيفي العناوين والفقرات والروابط.",
        lessonType: "article",
        sourceUrl: null,
        attachmentUrl: null,
        attachmentName: null,
        coverImageUrl: null,
        durationMinutes: 20,
        position: 1,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        pathId: 1,
        title: "جولة في أدوات المطور (فيديو تجريبي)",
        summary: "فيديو تجريبي يوضح مشغّل الفيديو داخل المسار.",
        content: null,
        lessonType: "video",
        sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        attachmentUrl: null,
        attachmentName: null,
        coverImageUrl: null,
        durationMinutes: 10,
        position: 2,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        pathId: 1,
        title: "ملف مراجعة CSS",
        summary: "أهم خصائص التنسيق في ملف واحد للمراجعة السريعة.",
        content: "درس تجريبي: يمكن للمعلمة إرفاق ملف PDF من لوحة الإدارة ليظهر هنا.",
        lessonType: "resource",
        sourceUrl: null,
        attachmentUrl: null,
        attachmentName: null,
        coverImageUrl: null,
        durationMinutes: 15,
        position: 3,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    assessments: [
      {
        id: 1,
        pathId: 1,
        title: "اختبار أساسيات الويب",
        description: "اختبار تجريبي — تستبدله المعلمة برابط الاختبار الحقيقي.",
        externalUrl: "https://www.google.com/forms/about/",
        maxScore: 100,
        position: 1,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    enrollments: [{ id: 1, studentId: 1, pathId: 1, enrolledAt: now }],
    lessonProgress: [{ id: 1, studentId: 1, lessonId: 1, completedAt: now, updatedAt: now }],
    assessmentResults: [
      {
        id: 1,
        assessmentId: 1,
        studentId: 1,
        score: 85,
        feedback: "نتيجة تجريبية: أداء جميل، واصلي التقدم.",
        reviewedById: 2,
        releasedAt: now,
        notifiedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    studentReports: [
      {
        id: 1,
        studentId: 1,
        authorId: 2,
        title: "تقرير التقدم الأول",
        summary: "تقرير تجريبي يوضح شكل تقارير المعلمة في لوحة الطالبة.",
        currentLevel: "مبتدئ",
        overallProgress: 33,
        skills: [{ label: "HTML", value: 70 }],
        isPublished: true,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    notifications: [
      {
        id: 1,
        recipientId: 1,
        type: "grade",
        title: "أصبحت نتيجة اختبارك متاحة",
        message: "راجعي لوحة التقدم للاطلاع على الدرجة والملاحظات.",
        link: "/student",
        isRead: false,
        createdAt: now,
      },
      {
        id: 2,
        recipientId: 1,
        type: "report",
        title: "تم تحديث تقرير تقدمك",
        message: "أضافت المعلمة تقريراً جديداً عن مستواك والخطوة القادمة.",
        link: "/student",
        isRead: false,
        createdAt: now,
      },
    ],
    seq: {
      users: 2,
      learningPaths: 2,
      lessons: 4,
      assessments: 2,
      enrollments: 2,
      lessonProgress: 2,
      assessmentResults: 2,
      studentReports: 2,
      notifications: 3,
    },
  };
}

function getState(): DemoState {
  if (state) return state;
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    state = decodeDates(JSON.parse(raw)) as DemoState;
  } catch {
    state = buildSeed();
    persist();
  }
  if (isDemoMode() && !announced) {
    announced = true;
    console.log("[Demo] وضع العرض التجريبي مفعّل — البيانات محفوظة محلياً في uploads/.demo-data.json");
  }
  return state;
}

function persist() {
  if (!state) return;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(encodeDates(state)));
}

function nextId(table: keyof DemoState["seq"]) {
  const current = getState().seq[table] ?? 1;
  getState().seq[table] = current + 1;
  return current;
}

async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const store = getState();
  const existing = store.users.find(item => item.openId === user.openId);
  if (!existing) {
    const id = nextId("users");
    const now = new Date();
    store.users.push({
      id,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      passwordHash: user.passwordHash ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"),
      createdAt: now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    });
    persist();
    return;
  }
  if (user.name !== undefined) existing.name = user.name ?? null;
  if (user.email !== undefined) existing.email = user.email ?? null;
  if (user.loginMethod !== undefined) existing.loginMethod = user.loginMethod ?? null;
  if (user.passwordHash !== undefined) existing.passwordHash = user.passwordHash ?? null;
  existing.lastSignedIn = user.lastSignedIn ?? new Date();
  if (user.role !== undefined) existing.role = user.role;
  else if (user.openId === ENV.ownerOpenId) existing.role = "admin";
  existing.updatedAt = new Date();
  persist();
}

async function getUserByEmail(email: string) {
  return getState().users.find(item => item.email === email);
}

async function createUser(user: InsertUser) {
  const store = getState();
  const id = nextId("users");
  const now = new Date();
  store.users.push({
    id,
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    passwordHash: user.passwordHash ?? null,
    loginMethod: user.loginMethod ?? null,
    role: user.role ?? "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now,
  });
  persist();
  return id;
}

async function getUserByOpenId(openId: string) {
  return getState().users.find(item => item.openId === openId);
}

async function getLearningPaths(publishedOnly = true) {
  const rows = [...getState().learningPaths].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return publishedOnly ? rows.filter(item => item.isPublished) : rows;
}

async function createLearningPath(input: {
  slug: string;
  title: string;
  description?: string;
  level: "مبتدئ" | "متوسط" | "متقدم";
  accent: string;
  estimatedHours: number;
}) {
  const id = nextId("learningPaths");
  const now = new Date();
  getState().learningPaths.push({
    id,
    slug: input.slug,
    title: input.title,
    description: input.description ?? null,
    level: input.level,
    accent: input.accent,
    icon: "Code2",
    coverImageUrl: null,
    estimatedHours: input.estimatedHours,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  });
  persist();
  return { id };
}

async function setPathPublished(pathId: number, isPublished: boolean) {
  const found = getState().learningPaths.find(item => item.id === pathId);
  if (found) {
    found.isPublished = isPublished;
    found.updatedAt = new Date();
    persist();
  }
}

async function getLessonsByPath(pathId: number, publishedOnly = true) {
  const rows = getState()
    .lessons.filter(item => item.pathId === pathId)
    .sort((a, b) => a.position - b.position);
  const visible = publishedOnly ? rows.filter(lesson => lesson.isPublished) : rows;
  return visible.map(lesson => ({ ...lesson, sourceUrl: toProtectedBlobUrl(lesson.sourceUrl), attachmentUrl: toProtectedBlobUrl(lesson.attachmentUrl) }));
}

async function createLesson(input: {
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
  const id = nextId("lessons");
  const now = new Date();
  getState().lessons.push({
    id,
    pathId: input.pathId,
    title: input.title,
    summary: input.summary ?? null,
    content: input.content ?? null,
    lessonType: input.lessonType,
    sourceUrl: input.sourceUrl ?? null,
    attachmentUrl: input.attachmentUrl ?? null,
    attachmentName: input.attachmentName ?? null,
    coverImageUrl: null,
    durationMinutes: input.durationMinutes,
    position: input.position,
    isPublished: true,
    createdAt: now,
    updatedAt: now,
  });
  persist();
  return { id };
}

async function setLessonPublished(lessonId: number, isPublished: boolean) {
  const found = getState().lessons.find(item => item.id === lessonId);
  if (found) {
    found.isPublished = isPublished;
    found.updatedAt = new Date();
    persist();
  }
}

async function createAssessment(input: {
  pathId: number;
  title: string;
  description?: string;
  externalUrl: string;
  maxScore: number;
  position: number;
}) {
  const id = nextId("assessments");
  const now = new Date();
  getState().assessments.push({
    id,
    pathId: input.pathId,
    title: input.title,
    description: input.description ?? null,
    externalUrl: input.externalUrl,
    maxScore: input.maxScore,
    position: input.position,
    isPublished: false,
    createdAt: now,
    updatedAt: now,
  });
  persist();
  return { id };
}

async function setAssessmentPublished(assessmentId: number, isPublished: boolean) {
  const found = getState().assessments.find(item => item.id === assessmentId);
  if (found) {
    found.isPublished = isPublished;
    found.updatedAt = new Date();
    persist();
  }
}

async function getAssessmentsByPath(pathId: number, publishedOnly = true) {
  const rows = getState()
    .assessments.filter(item => item.pathId === pathId)
    .sort((a, b) => a.position - b.position);
  return publishedOnly ? rows.filter(item => item.isPublished) : rows;
}

async function enrollStudent(studentId: number, pathId: number) {
  const store = getState();
  const existing = store.enrollments.find(item => item.studentId === studentId && item.pathId === pathId);
  if (existing) return;
  store.enrollments.push({ id: nextId("enrollments"), studentId, pathId, enrolledAt: new Date() });
  persist();
}

async function completeLesson(studentId: number, lessonId: number) {
  const store = getState();
  const lesson = store.lessons.find(item => item.id === lessonId);
  if (!lesson?.isPublished) throw new Error("الدرس غير متاح للتسجيل حالياً");
  const enrollment = store.enrollments.find(item => item.studentId === studentId && item.pathId === lesson.pathId);
  if (!enrollment) throw new Error("سجّلي في المسار قبل تحديد الدرس كمكتمل");
  const completedAt = new Date();
  const existing = store.lessonProgress.find(item => item.studentId === studentId && item.lessonId === lessonId);
  if (existing) {
    existing.completedAt = completedAt;
    existing.updatedAt = new Date();
  } else {
    store.lessonProgress.push({ id: nextId("lessonProgress"), studentId, lessonId, completedAt, updatedAt: new Date() });
  }
  persist();
}

async function getStudentDashboard(studentId: number) {
  const store = getState();
  const enrollmentRows = store.enrollments
    .filter(item => item.studentId === studentId)
    .map(enrollment => ({ path: store.learningPaths.find(item => item.id === enrollment.pathId)!, enrollment }))
    .filter(item => item.path);
  const allLessons = store.lessons.filter(lesson => lesson.isPublished);
  const progressRows = store.lessonProgress.filter(item => item.studentId === studentId && item.completedAt);
  const resultRows = store.assessmentResults
    .filter(item => item.studentId === studentId)
    .map(result => ({ result, assessment: store.assessments.find(item => item.id === result.assessmentId)! }))
    .filter(item => item.assessment)
    .sort((a, b) => b.result.releasedAt.getTime() - a.result.releasedAt.getTime());
  const reportRows = store.studentReports
    .filter(item => item.studentId === studentId && item.isPublished)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const notificationRows = store.notifications
    .filter(item => item.recipientId === studentId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

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

async function getAdminOverview() {
  const store = getState();
  const studentRows = store.users
    .filter(item => item.role === "user")
    .sort((a, b) => b.lastSignedIn.getTime() - a.lastSignedIn.getTime());
  const pathRows = [...store.learningPaths].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const lessonRows = store.lessons;
  const assessmentRows = store.assessments;
  const resultRows = store.assessmentResults
    .map(result => ({
      result,
      assessment: store.assessments.find(item => item.id === result.assessmentId)!,
      student: store.users.find(item => item.id === result.studentId)!,
    }))
    .filter(item => item.assessment && item.student)
    .sort((a, b) => b.result.releasedAt.getTime() - a.result.releasedAt.getTime());
  const reportRows = [...store.studentReports].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const enrollmentRows = store.enrollments;
  const progressRows = store.lessonProgress.filter(item => item.completedAt);

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
  const protectedLessons = lessonRows.map(lesson => ({ ...lesson, sourceUrl: toProtectedBlobUrl(lesson.sourceUrl), attachmentUrl: toProtectedBlobUrl(lesson.attachmentUrl) }));
  return { students, paths: pathRows, lessons: protectedLessons, assessments: assessmentRows, results: resultRows, reports: reportRows };
}

async function releaseAssessmentResult(input: {
  assessmentId: number;
  studentId: number;
  score: number;
  feedback?: string;
  reviewedById: number;
}) {
  const store = getState();
  const releasedAt = new Date();
  const existing = store.assessmentResults.find(item => item.assessmentId === input.assessmentId && item.studentId === input.studentId);
  if (existing) {
    existing.score = input.score;
    existing.feedback = input.feedback ?? null;
    existing.reviewedById = input.reviewedById;
    existing.releasedAt = releasedAt;
    existing.notifiedAt = null;
    existing.updatedAt = new Date();
  } else {
    store.assessmentResults.push({
      id: nextId("assessmentResults"),
      assessmentId: input.assessmentId,
      studentId: input.studentId,
      score: input.score,
      feedback: input.feedback ?? null,
      reviewedById: input.reviewedById,
      releasedAt,
      notifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  store.notifications.push({
    id: nextId("notifications"),
    recipientId: input.studentId,
    ...gradeNotificationPayload(),
    isRead: false,
    createdAt: new Date(),
  });
  persist();
}

async function publishStudentReport(input: {
  studentId: number;
  authorId: number;
  title: string;
  summary: string;
  currentLevel: "مبتدئ" | "متوسط" | "متقدم";
  overallProgress: number;
  skills?: Array<{ label: string; value: number }>;
}) {
  const store = getState();
  const publishedAt = new Date();
  store.studentReports.push({
    id: nextId("studentReports"),
    studentId: input.studentId,
    authorId: input.authorId,
    title: input.title,
    summary: input.summary,
    currentLevel: input.currentLevel,
    overallProgress: input.overallProgress,
    skills: input.skills ?? [],
    isPublished: true,
    publishedAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.notifications.push({
    id: nextId("notifications"),
    recipientId: input.studentId,
    ...reportNotificationPayload(),
    isRead: false,
    createdAt: new Date(),
  });
  persist();
}

async function markNotificationRead(notificationId: number, studentId: number) {
  const found = getState().notifications.find(item => item.id === notificationId && item.recipientId === studentId);
  if (found) {
    found.isRead = true;
    persist();
  }
}

export const demoStore = {
  upsertUser,
  getUserByEmail,
  createUser,
  getUserByOpenId,
  getLearningPaths,
  createLearningPath,
  setPathPublished,
  getLessonsByPath,
  createLesson,
  setLessonPublished,
  createAssessment,
  setAssessmentPublished,
  getAssessmentsByPath,
  enrollStudent,
  completeLesson,
  getStudentDashboard,
  getAdminOverview,
  releaseAssessmentResult,
  publishStudentReport,
  markNotificationRead,
};
