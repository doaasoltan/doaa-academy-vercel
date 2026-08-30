import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, Code2, LogIn, UserPlus } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get("mode") === "register" ? "register" : "login";
  const nextParam = params.get("next");
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login" ? { email, password } : { name, email, password };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "تعذر إكمال العملية.");
      toast.success(mode === "login" ? "تم تسجيل الدخول بنجاح." : "تم إنشاء الحساب بنجاح.");
      const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/student";
      const destination = data.user?.role === "admin" ? "/admin" : safeNext;
      setLocation(destination);
      window.location.href = destination;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إكمال العملية.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-page" dir="rtl">
    <div className="auth-card">
      <div className="auth-brand"><div className="brand-icon"><Code2 /></div><div><b>دعاء سلطان</b><small>أكاديمية البرمجة</small></div></div>
      <div className="auth-heading"><span>{mode === "login" ? "مرحبًا بعودتكِ" : "انضمي إلى الأكاديمية"}</span><h1>{mode === "login" ? "تسجيل الدخول" : "إنشاء حساب طالبة"}</h1><p>{mode === "login" ? "أدخلي بيانات حسابك للوصول إلى مساحتك التعليمية." : "أنشئي حسابك للوصول إلى المسارات والدروس المنشورة."}</p></div>
      <form onSubmit={submit} className="auth-form">
        {mode === "register" && <div><Label htmlFor="name">الاسم الكامل</Label><Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="اكتبي اسمك" autoComplete="name" required /></div>}
        <div><Label htmlFor="email">البريد الإلكتروني</Label><Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="email" required /></div>
        <div><Label htmlFor="password">كلمة المرور</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8 أحرف على الأقل" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required /></div>
        <Button className="academy-button w-full" disabled={loading}>{loading ? "جارٍ التنفيذ..." : mode === "login" ? <><LogIn className="size-4" /> تسجيل الدخول</> : <><UserPlus className="size-4" /> إنشاء الحساب</>}</Button>
      </form>
      <div className="auth-switch">{mode === "login" ? <>ليس لديكِ حساب؟ <button onClick={() => setMode("register")}>إنشاء حساب طالبة</button></> : <>لديكِ حساب بالفعل؟ <button onClick={() => setMode("login")}>تسجيل الدخول</button></>}</div>
      <button className="auth-back" onClick={() => setLocation("/")}><ArrowRight className="size-4" /> العودة للأكاديمية</button>
    </div>
  </div>;
}
