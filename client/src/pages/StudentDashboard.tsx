import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Award, Bell, BookOpen, CheckCircle2, ClipboardCheck, Compass, FileText, GraduationCap, LayoutDashboard, LockKeyhole, Sparkles, Target } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useEffect } from "react";

const menu = [{ icon: LayoutDashboard, label: "نظرة عامة", path: "/student" }, { icon: Compass, label: "مساراتي", path: "/student" }, { icon: ClipboardCheck, label: "درجاتي", path: "/student" }, { icon: FileText, label: "تقاريري", path: "/student" }];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.student.dashboard.useQuery(undefined, { enabled: !!user && user.role !== "admin" });
  const markRead = trpc.student.markNotificationRead.useMutation({ onSuccess: () => utils.student.dashboard.invalidate() });
  const completeLesson = trpc.student.completeLesson.useMutation({ onSuccess: () => { utils.student.dashboard.invalidate(); toast.success("تم تسجيل إنجاز الدرس."); } });
  useEffect(() => { if (user?.role === "admin") setLocation("/admin"); }, [user?.role, setLocation]);
  if (user?.role === "admin") return null;
  return <DashboardLayout menuItems={menu} title="مساحة الطالب"><div className="dashboard-page"><div className="dashboard-intro"><div><div className="eyebrow soft"><Sparkles className="size-4" />مساحتك التعليمية</div><h1>أهلاً {user?.name?.split(" ")[0] || "بكِ"}، <em>لنواصل التقدم.</em></h1><p>كل درس تكملينه يقربكِ من هدفكِ. هنا تجدين مساراتكِ ونتائجكِ وتقريركِ الأحدث.</p></div><div className="intro-mark"><GraduationCap /></div></div>
    {isLoading ? <DashboardLoading /> : data ? <>
      <section className="stat-grid"><Metric label="نسبة الإنجاز" value={`${data.overallProgress}%`} icon={Target} tone="violet" /><Metric label="المستوى الحالي" value={data.currentLevel} icon={Award} tone="orange" /><Metric label="متوسط الدرجات" value={data.averageScore === null ? "—" : `${data.averageScore}%`} icon={ClipboardCheck} tone="cyan" /><Metric label="مسارات مسجلة" value={String(data.paths.length)} icon={BookOpen} tone="rose" /></section>
      <section className="dashboard-grid"><div className="panel track-panel"><div className="panel-heading"><div><span>تعلم مستمر</span><h2>مساراتك التعليمية</h2></div><Link href="/" className="panel-link">استكشفي المزيد</Link></div>{data.paths.length ? <div className="student-track-list">{data.paths.map(path => <article key={path.id} className="student-track"><div className="track-icon"><BookOpen /></div><div className="track-info"><div><h3>{path.title}</h3><Badge variant="secondary">{path.level}</Badge></div><p>{path.completedLessonCount} من {path.lessonCount} دروس مكتملة</p><Progress value={path.progress} /></div><Link href={`/paths/${path.id}`} className="small-action">متابعة</Link></article>)}</div> : <EmptyState icon={Compass} title="لم تنضمي إلى مسار بعد" text="استكشفي المسارات المنشورة واختاري نقطة البداية المناسبة لكِ." action="استكشفي المسارات" onClick={() => setLocation("/")} />}</div>
        <div className="panel notification-panel"><div className="panel-heading"><div><span>آخر المستجدات</span><h2>الإشعارات</h2></div><Bell className="text-muted-foreground size-5" /></div>{data.notifications.length ? <div className="notification-list">{data.notifications.slice(0, 4).map(notification => <button key={notification.id} className={`notification-item ${notification.isRead ? "read" : ""}`} onClick={() => { if (!notification.isRead) markRead.mutate({ notificationId: notification.id }); }}><span className="notification-dot" /><div><b>{notification.title}</b><p>{notification.message}</p></div></button>)}</div> : <EmptyState icon={Bell} title="لا توجد إشعارات جديدة" text="ستصلكِ تنبيهات عند نشر نتيجة أو تحديث تقرير تقدمكِ." />}</div></section>
      <section className="dashboard-grid bottom-grid"><div className="panel results-panel"><div className="panel-heading"><div><span>قياس المعرفة</span><h2>أحدث النتائج</h2></div></div>{data.recentResults.length ? <div className="score-list">{data.recentResults.slice(0, 4).map(({ result, assessment }) => <div className="score-row" key={result.id}><div className="score-icon"><ClipboardCheck /></div><div><b>{assessment.title}</b><p>{result.feedback || "تم نشر نتيجتكِ بنجاح."}</p></div><strong>{result.score}<small>/{assessment.maxScore}</small></strong></div>)}</div> : <EmptyState icon={ClipboardCheck} title="لا توجد نتائج منشورة" text="ستظهر درجات الاختبارات هنا فور قيام المعلمة بنشرها." />}</div>
        <div className="panel report-panel"><div className="panel-heading"><div><span>تقرير نموكِ</span><h2>التقييم الأخير</h2></div><FileText className="text-primary size-5" /></div>{data.latestReport ? <div className="report-content"><Badge>{data.latestReport.currentLevel}</Badge><h3>{data.latestReport.title}</h3><p>{data.latestReport.summary}</p><div className="skill-bars">{(data.latestReport.skills || []).slice(0, 3).map(skill => <div key={skill.label}><span>{skill.label}<b>{skill.value}%</b></span><Progress value={skill.value} /></div>)}</div></div> : <EmptyState icon={FileText} title="تقريركِ قيد المتابعة" text="عند نشر تقرير من المعلمة ستجدين التقييم والنقاط التالية هنا." />}</div></section>
      <section className="panel lesson-completion"><div><span className="section-label">إنجاز سريع</span><h2>أكملي دروسكِ من داخل المسار</h2><p>حدّدي الدرس كمكتمل بعد الانتهاء، وسيُحدّث تقدمك تلقائياً.</p></div><div>{data.paths.flatMap(path => Array.from({ length: Math.max(path.lessonCount - path.completedLessonCount, 0) }, (_, index) => ({ path, index }))).slice(0, 1).map(item => <Button key={item.path.id} className="academy-button" onClick={() => toast.info("افتحي المسار وحددي الدرس بعد المراجعة.")}>فتح المسار <CheckCircle2 className="size-4" /></Button>)}</div></section>
    </> : <div className="panel"><EmptyState icon={LockKeyhole} title="تعذر تحميل مساحة الطالب" text="تحققي من الاتصال ثم أعيدي المحاولة." /></div>}</div></DashboardLayout>;
}

function Metric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Target; tone: string }) { return <article className={`metric-card ${tone}`}><div><span>{label}</span><strong>{value}</strong></div><div className="metric-icon"><Icon /></div></article>; }
function EmptyState({ icon: Icon, title, text, action, onClick }: { icon: typeof Target; title: string; text: string; action?: string; onClick?: () => void }) { return <div className="empty-state"><Icon /><h3>{title}</h3><p>{text}</p>{action && <Button variant="outline" onClick={onClick}>{action}</Button>}</div>; }
function DashboardLoading() { return <div className="stat-grid">{[1, 2, 3, 4].map(item => <div className="metric-card skeleton" key={item} />)}</div>; }
