import { describe, expect, it, vi } from "vitest";
import { createLessonWithDb } from "./db";
import { lessons } from "../drizzle/schema";

describe("lesson persistence after upload", () => {
  it("saves the storage reference and publishes the lesson", async () => {
    const values = vi.fn().mockResolvedValue([{ insertId: 77 }]);
    const database = { insert: vi.fn(() => ({ values })) };
    const result = await createLessonWithDb(database, {
      pathId: 3,
      title: "درس PDF محفوظ",
      summary: "مادة دراسية",
      lessonType: "article",
      attachmentUrl: "/uploads/academy/1/lesson.pdf",
      attachmentName: "lesson.pdf",
      durationMinutes: 10,
      position: 1,
    });
    expect(result).toEqual({ id: 77 });
    expect(database.insert).toHaveBeenCalledWith(lessons);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      attachmentUrl: "/uploads/academy/1/lesson.pdf",
      attachmentName: "lesson.pdf",
      isPublished: true,
    }));
  });
});
