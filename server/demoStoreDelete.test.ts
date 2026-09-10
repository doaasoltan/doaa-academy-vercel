import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The demo store persists to uploads/.demo-data.json under the current
 * working directory, so each test gets a fresh module instance rooted in a
 * temporary directory (module-level `state` + `DATA_FILE` are reset by
 * vi.resetModules before the dynamic import).
 */
describe("demoStore delete cascades", () => {
  let tmpDir: string;
  let originalCwd: string;
  let demoStore: typeof import("./demoStore.js").demoStore;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-store-test-"));
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

  it("getLessonById returns the lesson and null for unknown ids", async () => {
    const lesson = await demoStore.getLessonById(2);
    expect(lesson?.title).toBe("جولة في أدوات المطور (فيديو تجريبي)");
    expect(await demoStore.getLessonById(999)).toBeNull();
  });

  it("deleteLessonById removes the lesson and its progress rows", async () => {
    await demoStore.deleteLessonById(2);

    const lessons = await demoStore.getLessonsByPath(1, false);
    expect(lessons.map(item => item.id).sort()).toEqual([1, 3]);
  });

  it("deleteAssessmentById removes the assessment and its results", async () => {
    await demoStore.deleteAssessmentById(1);

    const overview = await demoStore.getAdminOverview();
    expect(overview.assessments).toHaveLength(0);
    expect(overview.results).toHaveLength(0);
  });

  it("deleteLearningPath removes the path and everything inside it", async () => {
    await demoStore.deleteLearningPath(1);

    const overview = await demoStore.getAdminOverview();
    expect(overview.paths).toHaveLength(0);
    expect(overview.lessons).toHaveLength(0);
    expect(overview.assessments).toHaveLength(0);
    expect(overview.results).toHaveLength(0);
    expect(overview.students[0].enrolledPathCount).toBe(0);
    expect(overview.students[0].progress).toBe(0);
  });
});
