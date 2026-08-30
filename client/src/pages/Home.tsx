import { useAuth } from "@/_core/hooks/useAuth";
import { BrandMark } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BarChart3, BookOpen, CheckCircle2, Code2, FileText, GraduationCap, LayoutDashboard, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

const capabilities = [
  { icon: BookOpen, title: "مسارات منظمة", text: "رتّبي الدروس والموارد وروابط الاختبارات ضمن رحلة تعلم واضحة." },
  { icon: BarChart3, title: "تقدم قابل للقياس", text: "تعرّفي على نسبة الإنجاز، الدرجات، ومستوى المهارة من لوحة واحدة." },
  { icon: ShieldCheck, title: "إدارة آمنة", text: "حسابات محمية وصلاحيات مخصصة للمعلمة وللطالبة داخل المنصة." },
];

const accentMap: Record<string, string> = { violet: "path-violet", cyan: "path-cyan", orange: "path-orange", rose: "path-rose" };

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: paths, isLoading } = trpc.catalog.paths.useQuery();
  const [, setLocation] = useLocation();
  const dashboardPath = user?.role === "admin" ? "/admin" : "/student";
  return <div className="public-page" dir="rtl">
    <nav className="public-nav"><BrandMark /><div className="nav-links"><a href="#features">لماذا الأكاديمية؟</a><a href="#paths">المسارات</a><Button className="nav-login" onClick={() => isAuthenticated ? setLocation(dashboardPath) : startLogin()}>{isAuthenticated ? "فتح لوحتي" : "تسجيل الدخول"}</Button></div></nav>
    <main>
      <section className="hero-section"><div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" /><div className="hero-copy"><div className="eyebrow"><Sparkles className="size-4" />تعليم برمجة عربي بهوية مختلفة</div><h1>اكتبي مستقبلكِ<br /><em>سطرًا بعد سطر.</em></h1><p>أكاديمية دعاء سلطان للبرمجة مساحة تعليمية منظمة تجمع الدروس والاختبارات والمتابعة الدقيقة في تجربة واحدة مصممة لكِ.</p><div className="hero-actions"><Button className="academy-button" onClick={() => isAuthenticated ? setLocation(dashboardPath) : startLogin()}>ابدئي رحلتك الآن <ArrowLeft className="size-4" /></Button><a href="#paths" className="text-cta">استكشفي المسارات</a></div><div className="trust-line"><CheckCircle2 className="size-4" />دروس مركزة، تقييمات واضحة، وتقارير متابعة شخصية.</div></div>
        <div className="hero-visual"><div className="code-window"><div className="window-bar"><span /><span /><span /><b>learn.ts</b></div><pre><code><i>const</i> <strong>myFuture</strong> = {'{'}<br />&nbsp;&nbsp;curiosity: <mark>true</mark>,<br />&nbsp;&nbsp;practice: <mark>"daily"</mark>,<br />&nbsp;&nbsp;result: <mark>"growth"</mark><br />{'}'};</code></pre><div className="window-footer"><span>●</span> رحلة التعلّم نشطة</div></div><div className="floating-card card-progress"><div className="float-icon"><BarChart3 /></div><span>تقدمكِ يتحدث عنكِ</span><b>كل خطوة لها أثر</b></div><div className="floating-card card-resource"><FileText className="size-5" /><span>ملفات الدروس في مكان واحد</span></div></div>
      </section>
      <section id="features" className="feature-section"><div className="section-label">التجربة التعليمية</div><div className="section-head"><h2>كل ما تحتاجينه لتتعلمي<br />وتتقدمي بثقة.</h2><p>نظام يوازن بين المحتوى العملي والمتابعة التي تجعل تقدّمكِ مرئياً ومفيداً.</p></div><div className="capability-grid">{capabilities.map(item => <article key={item.title} className="capability-card"><item.icon /><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
      <section id="paths" className="paths-section"><div className="paths-heading"><div><div className="section-label">ابدئي من حيث أنتِ</div><h2>المسارات التعليمية</h2></div><p>تظهر المسارات المنشورة من لوحة المعلمة هنا تلقائياً.</p></div>{isLoading ? <div className="paths-empty">يتم تحميل المسارات...</div> : paths && paths.length > 0 ? <div className="paths-grid">{paths.map((path, index) => <Link href={`/paths/${path.id}`} key={path.id} className={`path-card ${accentMap[path.accent] ?? "path-violet"}`}><span className="path-number">0{index + 1}</span><Code2 /><span className="path-level">{path.level}</span><h3>{path.title}</h3><p>{path.description || "مسار تدريبي منظم داخل الأكاديمية."}</p><div className="path-bottom"><span>{path.estimatedHours} ساعة تقريباً</span><ArrowLeft className="size-4" /></div></Link>)}</div> : <div className="paths-empty"><GraduationCap /><h3>المسارات التعليمية ستظهر هنا</h3><p>يمكن للمعلمة إضافة المسارات ونشرها من لوحة الإدارة.</p></div>}</section>
      <section className="cta-section"><div><span>خطوتكِ التالية</span><h2>التعلّم لا يحتاج إلى تشتيت.<br />يحتاج إلى مسار واضح.</h2></div><Button className="academy-button light" onClick={() => isAuthenticated ? setLocation(dashboardPath) : startLogin()}>انضمي إلى الأكاديمية <ArrowLeft className="size-4" /></Button></section>
    </main><footer><BrandMark /><p>أكاديمية دعاء سلطان للبرمجة — منصة عربية للتعلم والنمو.</p></footer>
  </div>;
}
