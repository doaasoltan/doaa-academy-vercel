export type TrackProgressInput = {
  lessonCount: number;
  completedLessonCount: number;
};

export function calculateTrackProgress({ lessonCount, completedLessonCount }: TrackProgressInput) {
  if (lessonCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completedLessonCount / lessonCount) * 100)));
}

export function calculateOverallProgress(trackProgress: number[]) {
  if (trackProgress.length === 0) return 0;
  return Math.round(trackProgress.reduce((sum, value) => sum + value, 0) / trackProgress.length);
}

export function levelFromProgress(progress: number): "مبتدئ" | "متوسط" | "متقدم" {
  if (progress >= 75) return "متقدم";
  if (progress >= 35) return "متوسط";
  return "مبتدئ";
}

export function gradeLabel(score: number) {
  if (score >= 90) return "متميز";
  if (score >= 75) return "متقن";
  if (score >= 60) return "جيد";
  return "يحتاج مراجعة";
}
