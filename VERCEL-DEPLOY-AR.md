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
- Build Command: `npm run build:vercel`
- Output Directory: `dist/client`
- Install Command: `npm ci` (تلقائي عند وجود `package-lock.json`)

الملف `vercel.json` موجود بالفعل.

## ملاحظة

لا يوجد داخل هذه الحزمة حساب MySQL أو Blob حقيقي، لأن بياناتهما مرتبطة بحسابك ولا ينبغي تضمينها في ZIP أو GitHub.

## استكشاف الأخطاء: «No blob credentials found»

إذا ظهر في سجلات Vercel خطأ على `/api/blob-file` أو `/api/blob-upload` بالشكل التالي:

```
[VercelBlob] Private file read failed BlobError: Vercel Blob: No blob credentials found.
Pass a `token` option, set `BLOB_READ_WRITE_TOKEN`, or use `oidcToken` ...
```

فهذا يعني أن التطبيق لا يجد بيانات اعتماد Vercel Blob. عند حدوثه تظهر الصفحة رسالة عربية واضحة (كود 503)
بدلاً من كود 500، ويُطبع تحذير في بداية سجلات الدالة.

الخطوات:

1. تأكدي من وجود **Blob Store** مربوط بالمشروع: لوحة Vercel ← مشروعك ← **Storage** ← Vercel Blob.
   إن لم يوجد أنشئي واحداً واربطيه بالمشروع.
2. أضيفي متغير البيئة `BLOB_READ_WRITE_TOKEN` بقيمته (يظهر في صفحة الـ Blob Store) للبيئات Production وPreview وDevelopment.
   - بديل بلا توكن دائم: أضيفي متغير `BLOB_STORE_ID` فقط (معرف المخزن)؛ Vercel يوفر `VERCEL_OIDC_TOKEN`
     تلقائياً داخل الدوال فلا حاجة لتوكن يدوي.
3. أعيدي النشر (Redeploy) حتى تُقرأ المتغيرات الجديدة.
4. الملفات التي لم ينجح رفعها قبل الإصلاح يجب إعادة رفعها من لوحة الأدمن.
