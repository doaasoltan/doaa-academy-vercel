import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Same isolation pattern as demoStoreDelete.test.ts: the demo store persists
 * under the cwd, so each test gets a fresh module instance in a temp dir.
 */
describe("demoStore content notifications", () => {
  let tmpDir: string;
  let originalCwd: string;
  let demoStore: typeof import("./demoStore.js").demoStore;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-notify-test-"));
    originalCwd = process.cwd();
    process.env.DEMO_MODE = "true";
    vi.resetModules();
    process.chdir(tmpDir);
    ({ demoStore } = await import("./demoStore.js"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.DEMO_MODE;
    vi.resetModules();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function studentNotifications() {
    return demoStore.getStudentDashboard(1).then(data => data.notifications);
  }

  it("notifies enrolled students when a video is created", async () => {
    await demoStore.createLesson({
      pathId: 1,
      title: "فيديو: بنية الصفحة",
      lessonType: "video",
      sourceUrl: "https://www.youtube.com/watch?v=abc",
      durationMinutes: 12,
      position: 4,
    });

    const notifications = await studentNotifications();
    const videoNote = notifications.find(n => n.title.includes("فيديو جديد"));
    expect(videoNote).toBeDefined();
    expect(videoNote!.type).toBe("lesson");
    expect(videoNote!.link).toBe("/paths/1");
    expect(videoNote!.message).toContain("أساسيات تطوير الويب");
  });

  it("does not notify for non-video lessons (PDF articles)", async () => {
    await demoStore.createLesson({
      pathId: 1,
      title: "مقال HTML",
      lessonType: "article",
      durationMinutes: 10,
      position: 4,
    });

    const before = (await studentNotifications()).length;
    const notifications = await studentNotifications();
    expect(notifications.length).toBe(before);
    expect(notifications.find(n => n.title.includes("مقال HTML"))).toBeUndefined();
  });

  it("notifies only when an assessment transitions from draft to published", async () => {
    const { id } = await demoStore.createAssessment({
      pathId: 1,
      title: "اختبار CSS",
      externalUrl: "https://forms.example.com/css",
      maxScore: 50,
      position: 2,
    });

    // Draft stage: no notification yet.
    let notifications = await studentNotifications();
    expect(notifications.find(n => n.title.includes("اختبار CSS"))).toBeUndefined();

    // Publishing notifies with a link to the path.
    await demoStore.setAssessmentPublished(id, true);
    notifications = await studentNotifications();
    const note = notifications.find(n => n.title.includes("اختبار جديد"));
    expect(note).toBeDefined();
    expect(note!.link).toBe("/paths/1");
    const countAfterPublish = notifications.length;

    // Re-publishing (already published) must not duplicate the notification.
    await demoStore.setAssessmentPublished(id, true);
    notifications = await studentNotifications();
    expect(notifications.length).toBe(countAfterPublish);
  });

  it("does not notify students who are not enrolled in the path", async () => {
    // Add a second student who is not enrolled in path 1.
    await demoStore.createUser({ openId: "extra-student", name: "طالبة أخرى", role: "user" });
    const overview = await demoStore.getAdminOverview();
    const extraStudent = overview.students.find(student => student.openId === "extra-student");
    expect(extraStudent).toBeDefined();

    await demoStore.createLesson({
      pathId: 1,
      title: "فيديو جديد",
      lessonType: "video",
      durationMinutes: 5,
      position: 4,
    });

    const extraNotifications = (await demoStore.getStudentDashboard(extraStudent!.id)).notifications;
    expect(extraNotifications.find(n => n.title.includes("فيديو جديد"))).toBeUndefined();
  });
});
