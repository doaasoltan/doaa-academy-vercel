import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { finalizeChunkedUpload, MAX_UPLOAD_CHUNKS, storeUploadChunk } from "./chunkedUpload.js";

const levelSchema = z.enum(["مبتدئ", "متوسط", "متقدم"]);
const pathInput = z.object({
  slug: z.string().min(3).max(160).regex(/^[a-z0-9-]+$/, "استخدمي أحرفاً إنجليزية صغيرة وأرقاماً وشرطة فقط."),
  title: z.string().min(3).max(180),
  description: z.string().max(2000).optional(),
  level: levelSchema,
  accent: z.enum(["violet", "cyan", "orange", "rose"]).default("violet"),
  estimatedHours: z.number().int().min(0).max(1000),
});

const lessonInput = z.object({
  pathId: z.number().int().positive(),
  title: z.string().min(3).max(220),
  summary: z.string().max(1000).optional(),
  content: z.string().max(30000).optional(),
  lessonType: z.enum(["video", "article", "workshop", "resource"]),
  sourceUrl: z.string().max(1200).refine(value => value === "" || value.startsWith("/uploads/") || /^https?:\/\//.test(value), "رابط الفيديو غير صالح.").optional(),
  attachmentUrl: z.string().max(1200).optional(),
  attachmentName: z.string().max(220).optional(),
  durationMinutes: z.number().int().min(1).max(1000),
  position: z.number().int().min(1).max(1000),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: router({
    paths: publicProcedure.query(() => db.getLearningPaths(true)),
    pathContent: publicProcedure.input(z.object({ pathId: z.number().int().positive() })).query(async ({ input }) => {
      const [path] = (await db.getLearningPaths(false)).filter(item => item.id === input.pathId && item.isPublished);
      if (!path) throw new TRPCError({ code: "NOT_FOUND", message: "المسار غير متاح حالياً." });
      const [lessonRows, assessmentRows] = await Promise.all([db.getLessonsByPath(path.id, true), db.getAssessmentsByPath(path.id, true)]);
      return { path, lessons: lessonRows, assessments: assessmentRows };
    }),
  }),
  student: router({
    dashboard: protectedProcedure.query(({ ctx }) => db.getStudentDashboard(ctx.user.id)),
    enroll: protectedProcedure.input(z.object({ pathId: z.number().int().positive() })).mutation(({ ctx, input }) => db.enrollStudent(ctx.user.id, input.pathId)),
    completeLesson: protectedProcedure.input(z.object({ lessonId: z.number().int().positive() })).mutation(({ ctx, input }) => db.completeLesson(ctx.user.id, input.lessonId)),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => db.markNotificationRead(input.notificationId, ctx.user.id)),
  }),
  admin: router({
    overview: adminProcedure.query(() => db.getAdminOverview()),
    createPath: adminProcedure.input(pathInput).mutation(({ input }) => db.createLearningPath(input)),
    publishPath: adminProcedure.input(z.object({ pathId: z.number().int().positive(), isPublished: z.boolean() })).mutation(({ input }) => db.setPathPublished(input.pathId, input.isPublished)),
    createLesson: adminProcedure.input(lessonInput).mutation(({ input }) => db.createLesson({ ...input, sourceUrl: input.sourceUrl || undefined })),
    publishLesson: adminProcedure.input(z.object({ lessonId: z.number().int().positive(), isPublished: z.boolean() })).mutation(({ input }) => db.setLessonPublished(input.lessonId, input.isPublished)),
    createAssessment: adminProcedure.input(z.object({
      pathId: z.number().int().positive(),
      title: z.string().min(3).max(220),
      description: z.string().max(2000).optional(),
      externalUrl: z.string().url(),
      maxScore: z.number().int().min(1).max(1000),
      position: z.number().int().min(1).max(1000),
    })).mutation(({ input }) => db.createAssessment(input)),
    publishAssessment: adminProcedure.input(z.object({ assessmentId: z.number().int().positive(), isPublished: z.boolean() })).mutation(({ input }) => db.setAssessmentPublished(input.assessmentId, input.isPublished)),
    releaseResult: adminProcedure.input(z.object({
      assessmentId: z.number().int().positive(),
      studentId: z.number().int().positive(),
      score: z.number().int().min(0).max(1000),
      feedback: z.string().max(3000).optional(),
    })).mutation(({ ctx, input }) => db.releaseAssessmentResult({ ...input, reviewedById: ctx.user.id })),
    publishReport: adminProcedure.input(z.object({
      studentId: z.number().int().positive(),
      title: z.string().min(3).max(220),
      summary: z.string().min(3).max(5000),
      currentLevel: levelSchema,
      overallProgress: z.number().int().min(0).max(100),
      skills: z.array(z.object({ label: z.string().min(1).max(50), value: z.number().int().min(0).max(100) })).max(10).optional(),
    })).mutation(({ ctx, input }) => db.publishStudentReport({ ...input, authorId: ctx.user.id })),
    uploadChunk: adminProcedure.input(z.object({
      uploadId: z.string().uuid(),
      chunkIndex: z.number().int().min(0).max(MAX_UPLOAD_CHUNKS),
      chunkData: z.string().min(4).max(720_000),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await storeUploadChunk({ ...input, userId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر رفع دفعة الملف." });
      }
    }),
    finalizeUpload: adminProcedure.input(z.object({
      uploadId: z.string().uuid(),
      fileName: z.string().min(1).max(220),
      mimeType: z.enum(["application/pdf", "video/mp4", "video/webm", "video/ogg", "video/quicktime"]),
      chunkKeys: z.array(z.string().min(1)).min(1).max(MAX_UPLOAD_CHUNKS),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await finalizeChunkedUpload({ ...input, userId: ctx.user.id });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "تعذر تجميع الملف المرفوع." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
