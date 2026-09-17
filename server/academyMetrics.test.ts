import { describe, expect, it } from "vitest";
import { calculateOverallProgress, calculateTrackProgress, findNextLesson, gradeLabel, levelFromProgress } from "./academyMetrics.js";

describe("academy progress metrics", () => {
  it("calculates path completion safely and clamps invalid values", () => {
    expect(calculateTrackProgress({ lessonCount: 8, completedLessonCount: 3 })).toBe(38);
    expect(calculateTrackProgress({ lessonCount: 0, completedLessonCount: 0 })).toBe(0);
    expect(calculateTrackProgress({ lessonCount: 4, completedLessonCount: 9 })).toBe(100);
  });

  it("averages path progress and maps it to the correct learning level", () => {
    expect(calculateOverallProgress([25, 75, 100])).toBe(67);
    expect(calculateOverallProgress([])).toBe(0);
    expect(levelFromProgress(0)).toBe("مبتدئ");
    expect(levelFromProgress(35)).toBe("متوسط");
    expect(levelFromProgress(75)).toBe("متقدم");
  });

  it("uses consistent Arabic labels for score reports", () => {
    expect(gradeLabel(96)).toBe("متميز");
    expect(gradeLabel(82)).toBe("متقن");
    expect(gradeLabel(61)).toBe("جيد");
    expect(gradeLabel(45)).toBe("يحتاج مراجعة");
  });

  it("finds the first incomplete lesson by position for resume learning", () => {
    const lessons = [
      { id: 1, position: 1 },
      { id: 2, position: 2 },
      { id: 3, position: 3 },
    ];
    expect(findNextLesson(lessons, new Set([1]))).toMatchObject({ id: 2 });
    expect(findNextLesson(lessons, [])).toMatchObject({ id: 1 });
    expect(findNextLesson(lessons, new Set([1, 2, 3]))).toBeNull();
    expect(findNextLesson([], new Set())).toBeNull();
  });

  it("respects lesson ordering even when rows arrive unsorted", () => {
    const lessons = [
      { id: 9, position: 3 },
      { id: 7, position: 1 },
      { id: 8, position: 2 },
    ];
    expect(findNextLesson(lessons, new Set([7]))).toMatchObject({ id: 8 });
  });
});
