# نسخة أكاديمية دعاء سلطان — Vercel Ready

هذه النسخة مهيأة للنشر على Vercel مع:

- React + Vite للواجهة.
- Express + tRPC عبر Vercel Function في `api/index.ts`.
- Drizzle ORM + MySQL عبر `DATABASE_URL`.
- Vercel Blob لرفع ملفات PDF والفيديو.
- تسجيل الدخول المحلي بالبريد وكلمة المرور عبر `LOCAL_AUTH=false` في الإنتاج.

## قبل أول Deploy

لا تضعي كلمات المرور أو مفاتيح Blob داخل الملفات.

أضيفي في Vercel Environment Variables:

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST/DATABASE?sslaccept=strict
JWT_SECRET=ضع_مفتاحا_سريا_طويلا_وعشوائيا
ADMIN_EMAIL=البريد_الذي_ستستخدمه_المديرة
ADMIN_PASSWORD=كلمة_مرور_قوية
ADMIN_NAME=مديرة الأكاديمية
LOCAL_AUTH=false
BLOB_READ_WRITE_TOKEN=يتم توفيره عند ربط Vercel Blob
```

## قاعدة البيانات

المشروع لا ينشئ MySQL بنفسه. يجب ربط قاعدة MySQL سحابية متوافقة مع `mysql2`، ثم وضع `DATABASE_URL` في Vercel.

بعد توفير قاعدة البيانات يمكن تطبيق migrations الخاصة بالمشروع باستخدام:

```bash
pnpm db:push
```

أو تنفيذ ملفات SQL الموجودة في مجلد `drizzle/` حسب سياسة مزود قاعدة البيانات.

## التخزين

رفع PDF والفيديو في لوحة الأدمن يستخدم Vercel Blob عند وجود:

```env
BLOB_READ_WRITE_TOKEN=...
```

ولا يعتمد على مجلد `uploads` لتخزين الملفات الدائمة في الإنتاج.

## إعدادات Vercel المقترحة

- Framework Preset: Vite أو Other
- Build Command: `pnpm build:vercel`
- Output Directory: `dist/client`
- Install Command: `pnpm install --frozen-lockfile`

الملف `vercel.json` موجود بالفعل.

## ملاحظة

لا يوجد داخل هذه الحزمة حساب MySQL أو Blob حقيقي، لأن بياناتهما مرتبطة بحسابك ولا ينبغي تضمينها في ZIP أو GitHub.
