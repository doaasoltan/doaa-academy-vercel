import { describe, expect, it, vi } from "vitest";
import { learningPaths, notifications } from "../drizzle/schema.js";
import { notifyPathStudentsOfNewLesson } from "./db.js";
import { lessonNotificationPayload } from "./notificationPayloads.js";

function mockDb({ enrollmentRows, pathRows }: { enrollmentRows: Array<{ studentId: number }>; pathRows: Array<{ title: string }> }) {
  const values = vi.fn().mockResolvedValue([]);
  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        const rows = table === learningPaths ? pathRows : enrollmentRows;
        return {
          where: vi.fn(() => ({
            limit: vi.fn(async () => rows),
            then: (resolve: (value: unknown) => void) => resolve(rows),
          })),
        };
      }),
    })),
    insert: vi.fn(() => ({ values })),
  };
  return { db, values };
}

describe("new lesson notifications", () => {
  it("builds a lesson notification linking to the path", () => {
    expect(lessonNotificationPayload("مدخل إلى HTML", "أساسيات الويب", 3, false)).toMatchObject({
      type: "lesson",
      title: "درس جديد في مسارك",
      link: "/paths/3",
    });
    expect(lessonNotificationPayload("جولة فيديو", "أساسيات الويب", 3, true).title).toBe("فيديو جديد في مسارك");
    expect(lessonNotificationPayload("مدخل إلى HTML", "أساسيات الويب", 3, false).message).toContain("مدخل إلى HTML");
  });

  it("notifies each enrolled student once when a lesson is published", async () => {
    const { db, values } = mockDb({
      enrollmentRows: [{ studentId: 5 }, { studentId: 7 }, { studentId: 5 }],
      pathRows: [{ title: "أساسيات الويب" }],
    });
    await notifyPathStudentsOfNewLesson(db, 3, "مدخل إلى HTML", "article");
    expect(db.insert).toHaveBeenCalledWith(notifications);
    expect(values).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ recipientId: 5, type: "lesson", link: "/paths/3" }),
      expect.objectContaining({ recipientId: 7, type: "lesson", link: "/paths/3" }),
    ]);
    expect(values.mock.calls[0][0][0].message).toContain("أساسيات الويب");
  });

  it("skips notifications when nobody is enrolled in the path", async () => {
    const { db, values } = mockDb({ enrollmentRows: [], pathRows: [] });
    await notifyPathStudentsOfNewLesson(db, 3, "درس بلا جمهور", "article");
    expect(db.insert).not.toHaveBeenCalled();
    expect(values).not.toHaveBeenCalled();
  });
});
