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
