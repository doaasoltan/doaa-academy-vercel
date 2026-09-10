export type NotificationPayload = {
  type: "grade" | "report" | "lesson" | "system";
  title: string;
  message: string;
  link: string;
};

export function gradeNotificationPayload(): NotificationPayload {
  return {
    type: "grade" as const,
    title: "أصبحت نتيجة اختبارك متاحة",
    message: "راجعي لوحة التقدم للاطلاع على الدرجة والملاحظات.",
    link: "/student",
  };
}

export function reportNotificationPayload(): NotificationPayload {
  return {
    type: "report" as const,
    title: "تم تحديث تقرير تقدمك",
    message: "أضافت المعلمة تقريراً جديداً عن مستواك والخطوة القادمة.",
    link: "/student",
  };
}

export function newVideoNotificationPayload(pathTitle: string, videoTitle: string, pathId: number): NotificationPayload {
  return {
    type: "lesson" as const,
    title: `فيديو جديد: ${videoTitle}`,
    message: `أضافت المعلمة فيديو جديد في «${pathTitle}» — ادخلي لصفحة المسار وشغليه الآن.`,
    link: `/paths/${pathId}`,
  };
}

export function newAssessmentNotificationPayload(pathTitle: string, assessmentTitle: string, pathId: number): NotificationPayload {
  return {
    type: "lesson" as const,
    title: `اختبار جديد: ${assessmentTitle}`,
    message: `أضافت المعلمة اختباراً جديداً في «${pathTitle}» — جهّزي نفسك وأدّيه من صفحة المسار.`,
    link: `/paths/${pathId}`,
  };
}
