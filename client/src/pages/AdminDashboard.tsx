import { upload } from "@vercel/blob/client";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { BarChart3, BookOpen, CheckCircle2, ClipboardCheck, FilePlus2, FileText, GraduationCap, LayoutDashboard, Link2, PlayCircle, Plus, Send, Sparkles, Upload, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const menu = [
  { icon: LayoutDashboard, label: "لوحة الإدارة", path: "/admin" },
  { icon: BookOpen, label: "المسارات والدروس", path: "/admin" },
  { icon: ClipboardCheck, label: "الاختبارات والنتائج", path: "/admin" },
  { icon: Users, label: "متابعة الطلاب", path: "/admin" },
];

type PathChoice = { id: number; title: string };
type StudentChoice = { id: number; name: string | null };
type AssessmentChoice = { id: number; title: string };

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.overview.useQuery(undefined, { enabled: user?.role === "admin" });
  const refresh = () => {
    utils.admin.overview.invalidate();
    utils.catalog.paths.invalidate();
  };
  const publishPath = trpc.admin.publishPath.useMutation({ onSuccess: refresh });
  const publishLesson = trpc.admin.publishLesson.useMutation({ onSuccess: refresh });
  const publishAssessment = trpc.admin.publishAssessment.useMutation({ onSuccess: refresh });

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/student");
  }, [user, setLocation]);

  if (user && user.role !== "admin") return null;

  return (
    <DashboardLayout menuItems={menu} title="لوحة المعلمة">
      <div className="dashboard-page">
        <div className="dashboard-intro admin-intro">
          <div>
            <div className="eyebrow soft"><Sparkles className="size-4" />إدارة أكاديمية دعاء سلطان</div>
            <h1>صباح الإبداع، <em>{user?.name?.split(" ")[0] || "دعاء"}.</em></h1>
            <p>أديري التجربة التعليمية واطلعي على المسارات والمحتوى ونتائج الطالبات من لوحة واحدة.</p>
          </div>
          <div className="admin-actions">
            <CreatePathDialog onDone={refresh} />
            <CreateLessonDialog paths={data?.paths ?? []} onDone={refresh} />
          </div>
        </div>

        {isLoading ? (
          <div className="stat-grid">{[1, 2, 3, 4].map(x => <div className="metric-card skeleton" key={x} />)}</div>
        ) : data ? (
          <>
            <section className="stat-grid">
              <AdminMetric label="الطالبات" value={String(data.students.length)} icon={Users} tone="violet" />
              <AdminMetric label="المسارات" value={String(data.paths.length)} icon={GraduationCap} tone="cyan" />
              <AdminMetric label="الدروس" value={String(data.lessons.filter(lesson => lesson.lessonType !== "video").length)} icon={BookOpen} tone="orange" />
              <AdminMetric label="النتائج المنشورة" value={String(data.results.length)} icon={ClipboardCheck} tone="rose" />
            </section>

            <section className="admin-main-grid">
              <div className="panel content-panel">
                <div className="panel-heading"><div><span>مكتبة الأكاديمية</span><h2>المسارات التعليمية</h2></div><CreatePathDialog onDone={refresh} /></div>
                {data.paths.length ? <div className="admin-list">{data.paths.map(path => (
                  <article className="admin-item" key={path.id}>
                    <div className="admin-item-icon"><GraduationCap /></div>
                    <div className="min-w-0"><div className="admin-item-title"><h3>{path.title}</h3><Badge variant={path.isPublished ? "default" : "secondary"}>{path.isPublished ? "منشور" : "مسودة"}</Badge></div><p>{path.level} · {path.estimatedHours} ساعة · {data.lessons.filter(lesson => lesson.pathId === path.id).length} عنصر محتوى</p></div>
                    <Button variant="outline" size="sm" onClick={() => publishPath.mutate({ pathId: path.id, isPublished: !path.isPublished })}>{path.isPublished ? "إخفاء" : "نشر"}</Button>
                  </article>
                ))}</div> : <AdminEmpty icon={GraduationCap} title="ابدئي بإضافة أول مسار" text="أنشئي مساراً ثم أضيفي إليه الدروس والفيديوهات والاختبارات." />}
              </div>
              <div className="panel quick-panel">
                <div className="panel-heading"><div><span>إضافة سريعة</span><h2>بناء المحتوى</h2></div></div>
                <div className="quick-actions">
                  <CreateLessonDialog paths={data.paths} onDone={refresh} />
                  <CreateVideoDialog paths={data.paths} onDone={refresh} />
                  <CreateAssessmentDialog paths={data.paths} onDone={refresh} />
                </div>
                <div className="process-note"><div><CheckCircle2 /><span>خط سير النشر</span></div><p>أنشئي المسار، ارفعي الدرس أو الفيديو من جهازك، وسيظهر للطالبات فور نجاح الحفظ. يمكنكِ إخفاؤه لاحقاً من القائمة.</p></div>
              </div>
            </section>

            <section className="admin-main-grid bottom-grid">
              <div className="panel results-panel">
                <div className="panel-heading"><div><span>متابعة الأداء</span><h2>نتائج الاختبارات</h2></div><CreateResultDialog students={data.students} assessments={data.assessments} onDone={refresh} /></div>
                {data.results.length ? <div className="score-list">{data.results.slice(0, 5).map(({ result, assessment, student }) => <div className="score-row" key={result.id}><div className="score-icon"><ClipboardCheck /></div><div><b>{student.name || "طالبة"} — {assessment.title}</b><p>{result.feedback || "نتيجة منشورة"}</p></div><strong>{result.score}<small>/{assessment.maxScore}</small></strong></div>)}</div> : <AdminEmpty icon={ClipboardCheck} title="لا توجد نتائج منشورة" text="أضيفي روابط الاختبارات، ثم انشري درجات الطالبات عند التصحيح." />}
              </div>
              <div className="panel students-panel">
                <div className="panel-heading"><div><span>متابعة مباشرة</span><h2>الطالبات</h2></div></div>
                {data.students.length ? <div className="student-list">{data.students.slice(0, 5).map(student => <div key={student.id} className="student-mini"><span>{student.name?.[0] ?? "ط"}</span><div><b>{student.name || "طالبة الأكاديمية"}</b><p>{student.currentLevel} · {student.progress}% إنجاز · {student.averageScore === null ? "لا درجات" : `${student.averageScore}% متوسط`}</p><Progress value={student.progress} /></div><CreateReportDialog student={student} onDone={refresh} /></div>)}</div> : <AdminEmpty icon={Users} title="ستظهر الطالبات هنا بعد التسجيل" text="يمكنكِ متابعة تقدمهن ونتائجهن فور انضمامهن للمسارات." />}
              </div>
            </section>

            <section className="panel lesson-library">
              <div className="panel-heading"><div><span>محتوى الدروس</span><h2>الدروس المضافة</h2></div><CreateLessonDialog paths={data.paths} onDone={refresh} /></div>
              {data.lessons.filter(lesson => lesson.lessonType !== "video").length ? <div className="lesson-admin-table">{data.lessons.filter(lesson => lesson.lessonType !== "video").slice(0, 8).map(lesson => <div className="lesson-admin-row" key={lesson.id}><FileText /><div><b>{lesson.title}</b><p>{data.paths.find(path => path.id === lesson.pathId)?.title ?? "مسار غير محدد"} · {lesson.durationMinutes} دقيقة</p>{lesson.attachmentUrl && <a className="file-open-link" href={lesson.attachmentUrl} target="_blank" rel="noreferrer"><FileText className="size-3" /> فتح PDF</a>}</div><Badge variant={lesson.isPublished ? "default" : "secondary"}>{lesson.isPublished ? "منشور" : "مسودة"}</Badge><Button variant="outline" size="sm" onClick={() => publishLesson.mutate({ lessonId: lesson.id, isPublished: !lesson.isPublished })}>{lesson.isPublished ? "إخفاء" : "نشر"}</Button></div>)}</div> : <AdminEmpty icon={FilePlus2} title="مكتبة الدروس فارغة" text="أضيفي درساً وارفعِي ملف PDF من جهازك لربطه بالمسار." />}
            </section>

            <section className="panel video-library">
              <div className="panel-heading"><div><span>محتوى مرئي</span><h2>الفيديوهات المضافة</h2></div><CreateVideoDialog paths={data.paths} onDone={refresh} /></div>
              {data.lessons.filter(lesson => lesson.lessonType === "video").length ? <div className="lesson-admin-table">{data.lessons.filter(lesson => lesson.lessonType === "video").slice(0, 8).map(video => <div className="lesson-admin-row video-admin-row" key={video.id}><PlayCircle /><div><b>{video.title}</b><p>{data.paths.find(path => path.id === video.pathId)?.title ?? "مسار غير محدد"} · {video.durationMinutes} دقيقة · ملف مرفوع من الجهاز</p>{video.sourceUrl && <a className="file-open-link" href={video.sourceUrl} target="_blank" rel="noreferrer"><PlayCircle className="size-3" /> تشغيل الملف</a>}</div><Badge variant={video.isPublished ? "default" : "secondary"}>{video.isPublished ? "منشور" : "مسودة"}</Badge><Button variant="outline" size="sm" onClick={() => publishLesson.mutate({ lessonId: video.id, isPublished: !video.isPublished })}>{video.isPublished ? "إخفاء" : "نشر"}</Button></div>)}</div> : <AdminEmpty icon={PlayCircle} title="لا توجد فيديوهات مضافة" text="ارفعي ملف فيديو من جهازك ثم انشريه ليظهر للطالبات." />}
            </section>

            <section className="panel assessment-library">
              <div className="panel-heading"><div><span>روابط الاختبارات</span><h2>الاختبارات المضافة</h2></div><CreateAssessmentDialog paths={data.paths} onDone={refresh} /></div>
              {data.assessments.length ? <div className="lesson-admin-table">{data.assessments.slice(0, 8).map(assessment => <div className="lesson-admin-row" key={assessment.id}><Link2 /><div><b>{assessment.title}</b><p>{data.paths.find(path => path.id === assessment.pathId)?.title ?? "مسار غير محدد"} · الدرجة الكلية {assessment.maxScore}</p></div><Badge variant={assessment.isPublished ? "default" : "secondary"}>{assessment.isPublished ? "منشور" : "مسودة"}</Badge><Button variant="outline" size="sm" onClick={() => publishAssessment.mutate({ assessmentId: assessment.id, isPublished: !assessment.isPublished })}>{assessment.isPublished ? "إخفاء" : "نشر"}</Button></div>)}</div> : <AdminEmpty icon={Link2} title="لم تتم إضافة اختبارات" text="أضيفي رابط اختبار واربطِيه بالمسار، ثم انشريه للطالبات." />}
            </section>
          </>
        ) : <div className="panel"><AdminEmpty icon={BarChart3} title="تعذر تحميل لوحة الإدارة" text="يرجى إعادة المحاولة بعد التحقق من الاتصال." /></div>}
      </div>
    </DashboardLayout>
  );
}

function AdminMetric({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Users; tone: string }) {
  return <article className={`metric-card ${tone}`}><div><span>{label}</span><strong>{value}</strong></div><div className="metric-icon"><Icon /></div></article>;
}

function AdminEmpty({ icon: Icon, title, text }: { icon: typeof Users; title: string; text: string }) {
  return <div className="empty-state"><Icon /><h3>{title}</h3><p>{text}</p></div>;
}

function CreatePathDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const create = trpc.admin.createPath.useMutation({ onSuccess: () => { toast.success("تم إنشاء المسار كمسودة."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState({ title: "", slug: "", description: "", level: "مبتدئ" as "مبتدئ" | "متوسط" | "متقدم", accent: "violet" as "violet" | "cyan" | "orange" | "rose", estimatedHours: 8 });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({ ...form, slug: form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `path-${Date.now()}` });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className="academy-button small"><Plus /> مسار جديد</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>إنشاء مسار تعليمي</DialogTitle><DialogDescription>ابدئي بمعلومات المسار الأساسية، ثم أضيفي الدروس والفيديوهات والاختبارات.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={submit}><Field label="اسم المسار"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: أساسيات الويب" /></Field><Field label="المعرّف المختصر (بالإنجليزية)"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="web-fundamentals" /></Field><Field label="وصف موجز"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><div className="form-row"><Field label="المستوى"><Select value={form.level} onValueChange={(level: "مبتدئ" | "متوسط" | "متقدم") => setForm({ ...form, level })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="مبتدئ">مبتدئ</SelectItem><SelectItem value="متوسط">متوسط</SelectItem><SelectItem value="متقدم">متقدم</SelectItem></SelectContent></Select></Field><Field label="الساعات التقديرية"><Input required type="number" min="0" value={form.estimatedHours} onChange={e => setForm({ ...form, estimatedHours: Number(e.target.value) })} /></Field></div><Button className="academy-button" type="submit" disabled={create.isPending}>{create.isPending ? "يتم الحفظ..." : "حفظ كمسودة"}</Button></form></DialogContent></Dialog>;
}

function CreateLessonDialog({ paths, onDone }: { paths: PathChoice[]; onDone: () => void }) {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("dialog") === "lesson");
  const create = trpc.admin.createLesson.useMutation({ onSuccess: () => { toast.success("تمت إضافة الدرس وملفه ونشره للطالبات."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState({ pathId: 0, title: "", summary: "", lessonType: "article" as "article" | "workshop" | "resource", attachmentUrl: "", attachmentName: "", durationMinutes: 20, position: 1 });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({ ...form, sourceUrl: undefined, attachmentUrl: form.attachmentUrl || undefined, attachmentName: form.attachmentName || undefined });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="quick-button" disabled={!paths.length}><FilePlus2 /> إضافة درس</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة درس وملف PDF</DialogTitle><DialogDescription>ارفعي ملف PDF مباشرةً من جهازك؛ يُربط بالدرس تلقائياً ولا يلزم نسخ أي رابط.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={submit}><Field label="المسار"><PathSelect paths={paths} value={form.pathId} onChange={pathId => setForm({ ...form, pathId })} /></Field><Field label="عنوان الدرس"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field><Field label="ملخص قصير"><Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></Field><DirectFileUpload mode="document" currentFileName={form.attachmentName} onUploaded={({ url, name }) => setForm({ ...form, attachmentUrl: url, attachmentName: name })} /><div className="form-row"><Field label="نوع المحتوى"><Select value={form.lessonType} onValueChange={(lessonType: "article" | "workshop" | "resource") => setForm({ ...form, lessonType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="article">مقال</SelectItem><SelectItem value="workshop">ورشة</SelectItem><SelectItem value="resource">مورد</SelectItem></SelectContent></Select></Field><Field label="المدة بالدقائق"><Input type="number" min="1" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field></div><Button className="academy-button" type="submit" disabled={create.isPending || !form.pathId || !form.attachmentUrl}>{create.isPending ? "يتم الحفظ..." : "حفظ ونشر الدرس"}</Button></form></DialogContent></Dialog>;
}

function CreateVideoDialog({ paths, onDone }: { paths: PathChoice[]; onDone: () => void }) {
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("dialog") === "video");
  const create = trpc.admin.createLesson.useMutation({ onSuccess: () => { toast.success("تمت إضافة الفيديو ونشره للطالبات."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState({ pathId: 0, title: "", summary: "", sourceUrl: "", durationMinutes: 15, position: 1 });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.sourceUrl) { toast.error("ارفعي ملف الفيديو من جهازك أولاً."); return; }
    create.mutate({ ...form, lessonType: "video", attachmentUrl: undefined, attachmentName: undefined });
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="quick-button" disabled={!paths.length}><PlayCircle /> إضافة فيديو</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>رفع فيديو جديد</DialogTitle><DialogDescription>اختاري ملف الفيديو من جهازك. بعد اكتمال الرفع، يُربط تلقائياً بالفيديو ولا تحتاجين إلى رابط خارجي.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={submit}><Field label="المسار"><PathSelect paths={paths} value={form.pathId} onChange={pathId => setForm({ ...form, pathId })} /></Field><Field label="عنوان الفيديو"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: مقدمة إلى HTML" /></Field><Field label="وصف مختصر"><Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="ما الذي ستتعلمه الطالبة من الفيديو؟" /></Field><DirectFileUpload mode="video" currentFileName={form.sourceUrl ? "تم رفع ملف الفيديو" : ""} onUploaded={({ url }) => setForm({ ...form, sourceUrl: url })} /><Field label="مدة الفيديو بالدقائق"><Input required type="number" min="1" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></Field><Button className="academy-button" type="submit" disabled={create.isPending || !form.pathId || !form.sourceUrl}>{create.isPending ? "يتم الحفظ..." : "حفظ ونشر الفيديو"}</Button></form></DialogContent></Dialog>;
}

function DirectFileUpload({ mode, currentFileName, onUploaded }: { mode: "document" | "video"; currentFileName: string; onUploaded: (file: { url: string; name: string }) => void }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const isVideo = mode === "video";
  const accepted = isVideo ? ["video/mp4", "video/webm", "video/ogg", "video/quicktime"] : ["application/pdf"];
  const acceptAttribute = isVideo ? "video/mp4,video/webm,video/ogg,video/quicktime" : "application/pdf";
  const chooseFile = async (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const detectedType = file.type || (extension === "pdf" ? "application/pdf" : extension === "mp4" ? "video/mp4" : extension === "webm" ? "video/webm" : extension === "ogg" ? "video/ogg" : extension === "mov" ? "video/quicktime" : "");
    if (!accepted.includes(detectedType)) { toast.error(isVideo ? "الصيغ المدعومة: MP4 أو WEBM أو OGG أو MOV." : "يرجى اختيار ملف PDF فقط."); return; }
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size < 1) { toast.error("الملف فارغ أو غير صالح."); return; }
    if (file.size > maxBytes) { toast.error(isVideo ? "الحد الأقصى لحجم الفيديو هو 100 ميغابايت." : "الحد الأقصى لحجم ملف PDF هو 50 ميغابايت."); return; }
    setUploading(true); setUploadProgress(0);
    try {
      const result = await uploadFileDirect(file, detectedType, value => setUploadProgress(value));
      onUploaded({ url: result.url, name: file.name });
      setUploadProgress(100);
      toast.success("تم رفع الملف بنجاح. يمكنكِ الآن حفظه ونشره.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر رفع الملف حالياً.");
      setUploadProgress(0);
    } finally { setUploading(false); }
  };
  return <Label className="upload-dropzone"><Upload /><span>{uploading ? `يتم رفع الملف... ${uploadProgress}%` : currentFileName || (isVideo ? "اختاري ملف فيديو من جهازك" : "اختاري ملف PDF من جهازك")}</span><small>{isVideo ? "MP4 · WEBM · OGG · MOV · حتى 100 ميغابايت" : "PDF · حتى 50 ميغابايت"}</small>{uploading && <span className="upload-progress"><i style={{ width: `${uploadProgress}%` }} /></span>}<Input type="file" accept={acceptAttribute} className="hidden" onChange={e => void chooseFile(e.target.files?.[0])} disabled={uploading} /></Label>;
}

function uploadFileDirect(file: File, mimeType: string, onProgress: (value: number) => void): Promise<{ url: string; key: string; name: string }> {
  return new Promise((resolve, reject) => {
    upload(`academy/${Date.now()}-${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
    })
      .then(blob => resolve({ url: blob.url, key: blob.pathname, name: file.name }))
      .catch(error => reject(error instanceof Error ? error : new Error("تعذر رفع الملف حالياً.")));
  });
}

function encodeUploadChunk(buffer: ArrayBuffer) {
  const input = new Uint8Array(buffer);
  const encoded = new Uint8Array(input.length);
  for (let index = 0; index < input.length; index += 1) encoded[index] = input[index] ^ 90;
  let binary = "";
  for (let index = 0; index < encoded.length; index += 1) binary += String.fromCharCode(encoded[index]);
  return btoa(binary);
}

function PathSelect({ paths, value, onChange }: { paths: PathChoice[]; value: number; onChange: (value: number) => void }) {
  return <Select value={String(value)} onValueChange={value => onChange(Number(value))}><SelectTrigger><SelectValue placeholder="اختاري المسار" /></SelectTrigger><SelectContent>{paths.map(path => <SelectItem key={path.id} value={String(path.id)}>{path.title}</SelectItem>)}</SelectContent></Select>;
}

function CreateAssessmentDialog({ paths, onDone }: { paths: PathChoice[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const create = trpc.admin.createAssessment.useMutation({ onSuccess: () => { toast.success("تمت إضافة الاختبار كمسودة."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  const [form, setForm] = useState({ pathId: 0, title: "", description: "", externalUrl: "", maxScore: 100, position: 1 });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="quick-button" disabled={!paths.length}><Link2 /> رابط اختبار</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>إضافة اختبار خارجي</DialogTitle><DialogDescription>أضيفي رابط نموذج الاختبار أو منصته، ثم انشريه داخل المسار.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={e => { e.preventDefault(); create.mutate(form); }}><Field label="المسار"><PathSelect paths={paths} value={form.pathId} onChange={pathId => setForm({ ...form, pathId })} /></Field><Field label="عنوان الاختبار"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field><Field label="الرابط الخارجي"><Input required type="url" value={form.externalUrl} onChange={e => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://..." /></Field><Field label="الدرجة الكلية"><Input type="number" min="1" value={form.maxScore} onChange={e => setForm({ ...form, maxScore: Number(e.target.value) })} /></Field><Button className="academy-button" type="submit" disabled={create.isPending || !form.pathId}>{create.isPending ? "يتم الحفظ..." : "إضافة كمسودة"}</Button></form></DialogContent></Dialog>;
}

function CreateResultDialog({ students, assessments, onDone }: { students: StudentChoice[]; assessments: AssessmentChoice[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ studentId: 0, assessmentId: 0, score: 0, feedback: "" });
  const release = trpc.admin.releaseResult.useMutation({ onSuccess: () => { toast.success("نُشرت النتيجة وأُضيف إشعار للطالب."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" size="sm" disabled={!students.length || !assessments.length}>نشر نتيجة</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>نشر نتيجة اختبار</DialogTitle><DialogDescription>يتطلب نشر النتيجة اختيار الاختبار والطالب. يظهر إشعار تلقائياً في لوحة الطالب.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={e => { e.preventDefault(); release.mutate(form); }}><Field label="الطالبة"><Select value={String(form.studentId)} onValueChange={value => setForm({ ...form, studentId: Number(value) })}><SelectTrigger><SelectValue placeholder="اختاري الطالبة" /></SelectTrigger><SelectContent>{students.map(s => <SelectItem value={String(s.id)} key={s.id}>{s.name || "طالبة"}</SelectItem>)}</SelectContent></Select></Field><Field label="الاختبار"><Select value={String(form.assessmentId)} onValueChange={value => setForm({ ...form, assessmentId: Number(value) })}><SelectTrigger><SelectValue placeholder="اختاري الاختبار" /></SelectTrigger><SelectContent>{assessments.map(item => <SelectItem value={String(item.id)} key={item.id}>{item.title}</SelectItem>)}</SelectContent></Select></Field><Field label="الدرجة"><Input required type="number" min="0" value={form.score} onChange={e => setForm({ ...form, score: Number(e.target.value) })} /></Field><Field label="ملاحظات"><Textarea value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} /></Field><Button className="academy-button" type="submit" disabled={release.isPending || !form.studentId || !form.assessmentId}>{release.isPending ? "يتم النشر..." : "نشر النتيجة وإشعار الطالبة"}</Button></form></DialogContent></Dialog>;
}

function CreateReportDialog({ student, onDone }: { student: StudentChoice; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "تقرير التقدم", summary: "", currentLevel: "مبتدئ" as "مبتدئ" | "متوسط" | "متقدم", overallProgress: 0 });
  const publish = trpc.admin.publishReport.useMutation({ onSuccess: () => { toast.success("نُشر التقرير وأُضيف إشعار للطالب."); setOpen(false); onDone(); }, onError: error => toast.error(error.message) });
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="sm"><Send className="size-4" /> تقرير</Button></DialogTrigger><DialogContent dir="rtl"><DialogHeader><DialogTitle>تقرير تقدم {student.name || "الطالبة"}</DialogTitle><DialogDescription>يُعرض التقرير للطالب في لوحته فور نشره.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={e => { e.preventDefault(); publish.mutate({ ...form, studentId: student.id, skills: [] }); }}><Field label="عنوان التقرير"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field><Field label="ملاحظات المعلمة"><Textarea required value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></Field><div className="form-row"><Field label="المستوى"><Select value={form.currentLevel} onValueChange={(currentLevel: "مبتدئ" | "متوسط" | "متقدم") => setForm({ ...form, currentLevel })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="مبتدئ">مبتدئ</SelectItem><SelectItem value="متوسط">متوسط</SelectItem><SelectItem value="متقدم">متقدم</SelectItem></SelectContent></Select></Field><Field label="نسبة الإنجاز"><Input type="number" min="0" max="100" value={form.overallProgress} onChange={e => setForm({ ...form, overallProgress: Number(e.target.value) })} /></Field></div><Button className="academy-button" type="submit" disabled={publish.isPending}>{publish.isPending ? "يتم النشر..." : "نشر التقرير وإشعار الطالبة"}</Button></form></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="form-field"><span>{label}</span>{children}</label>;
}
