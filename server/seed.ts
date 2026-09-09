/**
 * Demo seed for a fresh database (e.g. TiDB Cloud Starter).
 *
 * Usage:
 *   DATABASE_URL="mysql://..." npm run db:seed
 *
 * Idempotent: existing path/lessons/student are reused, never duplicated.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { hashPassword, normalizeEmail, validatePassword } from "./_core/auth.js";
import {
  completeLesson,
  createLearningPath,
  createLesson,
  createUser,
  enrollStudent,
  getDb,
  getLearningPaths,
  getLessonsByPath,
  getUserByEmail,
  setPathPublished,
} from "./db.js";

const SEED_PATH_SLUG = "web-fundamentals";

async function ensureSeedPath() {
  const paths = await getLearningPaths(false);
  const existing = paths.find(path => path.slug === SEED_PATH_SLUG);
  if (existing) {
    console.log(`[Seed] المسار "${existing.title}" موجود بالفعل — تم تخطي الإنشاء.`);
    return existing;
  }
  const { id } = await createLearningPath({
    slug: SEED_PATH_SLUG,
    title: "أساسيات تطوير الويب",
    description: "مسار تجريبي يعرفكِ على HTML وCSS وأدوات المطور من الصفر.",
    level: "مبتدئ",
    accent: "violet",
    estimatedHours: 6,
  });
  await setPathPublished(id, true);
  const created = (await getLearningPaths(false)).find(path => path.id === id);
  if (!created) throw new Error("تعذر قراءة المسار بعد إنشائه.");
  console.log(`[Seed] تم إنشاء المسار "${created.title}" ونشره.`);
  return created;
}

async function ensureSeedLessons(pathId: number) {
  const existing = await getLessonsByPath(pathId, false);
  if (existing.length > 0) {
    console.log(`[Seed] توجد ${existing.length} دروس في المسار — تم تخطي إنشاء الدروس.`);
    return existing;
  }
  await createLesson({
    pathId,
    title: "تعرفي على HTML",
    summary: "ما هي لغة HTML وكيف تُبنى الصفحة الأولى؟",
    content: "درس تجريبي: ابدئي ببنية الصفحة الأساسية ثم أضيفي العناوين والفقرات والروابط.",
    lessonType: "article",
    durationMinutes: 20,
    position: 1,
  });
  await createLesson({
    pathId,
    title: "جولة في أدوات المطور (فيديو تجريبي)",
    summary: "فيديو تجريبي يوضح مشغّل الفيديو داخل المسار.",
    lessonType: "video",
    sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    durationMinutes: 10,
    position: 2,
  });
  await createLesson({
    pathId,
    title: "ملف مراجعة CSS",
    summary: "أهم خصائص التنسيق في ملف واحد للمراجعة السريعة.",
    content: "درس تجريبي: يمكن للمعلمة إرفاق ملف PDF من لوحة الإدارة ليظهر هنا.",
    lessonType: "resource",
    durationMinutes: 15,
    position: 3,
  });
  const created = await getLessonsByPath(pathId, false);
  console.log(`[Seed] تم إنشاء ${created.length} دروس تجريبية ونشرها.`);
  return created;
}

async function ensureSeedStudent(pathId: number, firstLessonId: number | null) {
  const email = normalizeEmail(process.env.SEED_STUDENT_EMAIL || "student@demo.test");
  const password = process.env.SEED_STUDENT_PASSWORD || "Demo1234";
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(`SEED_STUDENT_PASSWORD غير صالح: ${passwordError}`);

  let student = await getUserByEmail(email);
  if (!student) {
    const passwordHash = await hashPassword(password);
    await createUser({
      openId: `seed-${crypto.randomUUID()}`,
      name: "طالبة تجريبية",
      email,
      loginMethod: "password",
      role: "user",
      passwordHash,
    });
    student = await getUserByEmail(email);
    if (!student) throw new Error("تعذر قراءة الحساب التجريبي بعد إنشائه.");
    console.log(`[Seed] تم إنشاء حساب الطالبة التجريبية: ${email}`);
  } else {
    console.log(`[Seed] حساب الطالبة ${email} موجود بالفعل.`);
  }

  await enrollStudent(student.id, pathId);
  if (firstLessonId) {
    await completeLesson(student.id, firstLessonId);
    console.log("[Seed] تم تسجيل الطالبة في المسار واحتساب أول درس كمكتمل.");
  }
  return { email, password };
}

async function main() {
  const db = await getDb();
  if (!db) {
    console.error("[Seed] تعذر الاتصال بقاعدة البيانات. تأكدي من ضبط DATABASE_URL ثم أعيدي المحاولة.");
    process.exitCode = 1;
    return;
  }
  const path = await ensureSeedPath();
  const lessons = await ensureSeedLessons(path.id);
  const ordered = [...lessons].sort((a, b) => a.position - b.position);
  const credentials = await ensureSeedStudent(path.id, ordered[0]?.id ?? null);

  console.log("");
  console.log("تمت التعبئة التجريبية بنجاح.");
  console.log(`- المسار: ${path.title} (id: ${path.id})`);
  console.log(`- حساب الطالبة: ${credentials.email} / ${credentials.password}`);
  console.log("- حساب المعلمة يُنشأ تلقائياً من ADMIN_EMAIL وADMIN_PASSWORD عند تشغيل الموقع.");
}

main().catch(error => {
  console.error("[Seed] فشلت التعبئة:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
