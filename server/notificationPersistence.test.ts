import { describe, expect, it, vi } from "vitest";
import { notifications } from "../drizzle/schema";
import { publishStudentReportWithDb, releaseAssessmentResultWithDb } from "./db";

function writerSpy() {
  const inserted: unknown[] = [];
  const database = {
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => {
        inserted.push(value);
        return { onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) };
      }),
    })),
  };
  return { database, inserted };
}

describe("notification persistence on academic publications", () => {
  it("inserts a grade notification after saving an assessment result", async () => {
    const { database, inserted } = writerSpy();
    await releaseAssessmentResultWithDb(database, { assessmentId: 4, studentId: 22, score: 88, feedback: "عمل ممتاز", reviewedById: 10 });
    expect(database.insert).toHaveBeenNthCalledWith(2, notifications);
    expect(inserted[1]).toMatchObject({ recipientId: 22, type: "grade", link: "/student" });
  });

  it("inserts a report notification after publishing the report", async () => {
    const { database, inserted } = writerSpy();
    await publishStudentReportWithDb(database, { studentId: 22, authorId: 10, title: "تقرير التقدم", summary: "ثبات جيد في التدريب.", currentLevel: "متوسط", overallProgress: 54 });
    expect(database.insert).toHaveBeenNthCalledWith(2, notifications);
    expect(inserted[1]).toMatchObject({ recipientId: 22, type: "report", link: "/student" });
  });
});
