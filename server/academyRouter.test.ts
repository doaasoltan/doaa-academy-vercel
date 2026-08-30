import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getStudentDashboard: vi.fn(),
  createLesson: vi.fn(),
  releaseAssessmentResult: vi.fn(),
  publishStudentReport: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const original = await importOriginal<typeof import("./db")>();
  return { ...original, ...dbMocks };
});

import { appRouter } from "./routers";
import { gradeNotificationPayload, reportNotificationPayload } from "./notificationPayloads";

function context(role: "user" | "admin"): TrpcContext {
  return {
    user: {
      id: role === "admin" ? 10 : 22,
      openId: `${role}-open-id`,
      name: role === "admin" ? "دعاء" : "طالبة",
      email: "academy@example.test",
      loginMethod: "local",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("academy router permissions and publication workflows", () => {
  beforeEach(() => vi.clearAllMocks());

  it("prevents a student from creating a learning path", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.admin.createPath({ slug: "web-foundations", title: "أساسيات الويب", level: "مبتدئ", accent: "violet", estimatedHours: 8 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("loads a dashboard using the authenticated student identity", async () => {
    dbMocks.getStudentDashboard.mockResolvedValue({ overallProgress: 40 });
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.student.dashboard()).resolves.toEqual({ overallProgress: 40 });
    expect(dbMocks.getStudentDashboard).toHaveBeenCalledWith(22);
  });

  it("records the admin identity when releasing a result", async () => {
    dbMocks.releaseAssessmentResult.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.releaseResult({ assessmentId: 6, studentId: 22, score: 91, feedback: "أداء متقن" });
    expect(dbMocks.releaseAssessmentResult).toHaveBeenCalledWith({ assessmentId: 6, studentId: 22, score: 91, feedback: "أداء متقن", reviewedById: 10 });
  });

  it("allows the admin to add a video lesson as a draft", async () => {
    dbMocks.createLesson.mockResolvedValue({ id: 9 });
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.createLesson({ pathId: 3, title: "مدخل إلى HTML", summary: "فيديو تأسيسي", lessonType: "video", sourceUrl: "https://www.youtube.com/watch?v=academy", durationMinutes: 15, position: 1 })).resolves.toEqual({ id: 9 });
    expect(dbMocks.createLesson).toHaveBeenCalledWith(expect.objectContaining({ pathId: 3, lessonType: "video" }));
  });

  it("accepts internal storage URLs for uploaded video and PDF content", async () => {
    dbMocks.createLesson.mockResolvedValue({ id: 10 });
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.createLesson({ pathId: 3, title: "درس PDF", summary: "مادة مرفوعة", lessonType: "article", attachmentUrl: "/uploads/academy/10/lesson.pdf", attachmentName: "lesson.pdf", durationMinutes: 10, position: 2 });
    await caller.admin.createLesson({ pathId: 3, title: "فيديو مرفوع", summary: "فيديو", lessonType: "video", sourceUrl: "/uploads/academy/10/video.mp4", durationMinutes: 20, position: 3 });
    expect(dbMocks.createLesson).toHaveBeenNthCalledWith(1, expect.objectContaining({ attachmentUrl: "/uploads/academy/10/lesson.pdf", attachmentName: "lesson.pdf" }));
    expect(dbMocks.createLesson).toHaveBeenNthCalledWith(2, expect.objectContaining({ sourceUrl: "/uploads/academy/10/video.mp4", lessonType: "video" }));
  });

  it("records the admin identity when publishing a student report", async () => {
    dbMocks.publishStudentReport.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(context("admin"));
    await caller.admin.publishReport({ studentId: 22, title: "تقرير التقدم", summary: "تقدم جيد في أساسيات HTML.", currentLevel: "متوسط", overallProgress: 56, skills: [{ label: "HTML", value: 80 }] });
    expect(dbMocks.publishStudentReport).toHaveBeenCalledWith({ studentId: 22, authorId: 10, title: "تقرير التقدم", summary: "تقدم جيد في أساسيات HTML.", currentLevel: "متوسط", overallProgress: 56, skills: [{ label: "HTML", value: 80 }] });
  });

  it("uses clear in-platform notifications for both result and report publishing", () => {
    expect(gradeNotificationPayload()).toMatchObject({ type: "grade", link: "/student" });
    expect(reportNotificationPayload()).toMatchObject({ type: "report", link: "/student" });
  });
});
