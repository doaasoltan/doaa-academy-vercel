# أكاديمية دعاء سلطان — نسخة Vercel الجاهزة

هذه النسخة مهيأة لـ Vercel مع React/Vite + Express/tRPC + Drizzle/MySQL.

## قاعدة البيانات

تظل قاعدة البيانات MySQL-compatible كما هي في المشروع. يمكن ربط المشروع من Vercel Marketplace بخدمة مثل PlanetScale أو TiDB Cloud، ثم سيظهر `DATABASE_URL` للمشروع. تكامل PlanetScale في Vercel يوفر `DATABASE_URL` لتطبيقات Node.js، وTiDB Cloud يوفر اتصال MySQL-compatible أيضاً.

## الملفات

تم تجهيز التخزين ليستخدم Vercel Blob عند النشر بدلاً من الاعتماد على مجلد `uploads` المحلي. في الإنتاج يجب ربط Blob Store بالمشروع حتى يتوفر `BLOB_READ_WRITE_TOKEN`.

## المتغيرات

`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `LOCAL_AUTH=false`, و`BLOB_READ_WRITE_TOKEN` عند الحاجة.

لا تضع ملف `.env` الحقيقي في GitHub أو ZIP.

## ما الذي تم تعديله في هذه النسخة؟

- أضيفت نقطة دخول `api/index.ts` لـ Vercel Functions.
- أضيف `vercel.json` مع build/output/rewrites.
- أصبح رفع PDF والفيديو يستخدم Vercel Blob مباشرة من المتصفح، لتجنب تمرير الملفات الكبيرة عبر Function.
- بقي MySQL في Drizzle كما هو، لذلك لا نحتاج لإعادة بناء الجداول من الصفر.
- بقي التشغيل المحلي مدعوماً باستخدام التخزين المحلي إذا لم توجد بيئة Vercel/Blob.
