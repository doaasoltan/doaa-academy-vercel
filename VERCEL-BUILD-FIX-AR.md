# إصلاح نشر Vercel

تم تعديل vite.config.ts لأن root الخاص بـ Vite هو مجلد client، لذلك يجب أن يكون outDir هو ../dist/client حتى يكون ناتج البناء في dist/client داخل جذر المستودع.

تم أيضًا إضافة schema و framework: vite إلى vercel.json.
