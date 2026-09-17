export function gradeNotificationPayload() {
  return {
    type: "grade" as const,
    title: "أصبحت نتيجة اختبارك متاحة",
    message: "راجعي لوحة التقدم للاطلاع على الدرجة والملاحظات.",
    link: "/student",
  };
}

export function reportNotificationPayload() {
  return {
    type: "report" as const,
    title: "تم تحديث تقرير تقدمك",
    message: "أضافت المعلمة تقريراً جديداً عن مستواك والخطوة القادمة.",
    link: "/student",
  };
}

export function lessonNotificationPayload(lessonTitle: string, pathTitle: string, pathId: number, isVideo: boolean) {
  return {
    type: "lesson" as const,
    title: isVideo ? "فيديو جديد في مسارك" : "درس جديد في مسارك",
    message: `أُضيف "${lessonTitle}" إلى مسار "${pathTitle}" — تابعيه الآن.`,
    link: `/paths/${pathId}`,
  };
}
