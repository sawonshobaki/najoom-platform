# Najoom Platform Threat Model

## 1. Purpose

هذا المستند يحدد التهديدات الأمنية الرئيسية لمنصة نجوم، والأصول الحساسة التي يجب حمايتها، ونقاط الدخول المحتملة، والضوابط الأمنية التي ستستخدم لتقليل مخاطر الاختراق.

الهدف ليس افتراض أن النظام لا يمكن اختراقه، بل بناء طبقات دفاع تقلل احتمالية الاختراق وتحد من أثره إذا حدث.

---

## 2. Assets to protect

الأصول الأكثر حساسية في منصة نجوم هي:

- حسابات الطالبات.
- حساب المعلمة.
- حساب المدير.
- كلمات المرور المخزنة كـ Password Hash.
- جلسات المستخدمين.
- بيانات الطالبات التعليمية.
- الدرجات ونتائج الاختبارات.
- الواجبات والتغذية الراجعة.
- التحليلات التعليمية.
- نقاط القوة والضعف.
- الخطط العلاجية.
- النقاط والأوسمة.
- بيانات ترتيب الشعب.
- الإشعارات.
- Audit Logs.
- قاعدة البيانات.
- مفاتيح API.
- Gemini API Key.
- DATABASE_URL.
- أسرار الجلسات.
- إعدادات النظام.
- ملفات migrations.
- المستودع البرمجي.
- بيئة الإنتاج.

---

## 3. Trust boundaries

هناك عدة حدود ثقة داخل النظام.

### Browser → Application Server

كل ما يأتي من المتصفح يعتبر غير موثوق.

يشمل ذلك:

- URL parameters.
- query parameters.
- form data.
- cookies.
- headers.
- JSON bodies.
- IDs.
- role claims القادمة من الواجهة.

الخادم هو المسؤول عن التحقق من:

- الهوية.
- الجلسة.
- الصلاحيات.
- صحة البيانات.

---

### Application Server → Database

الوصول إلى قاعدة البيانات يتم فقط من خلال التطبيق.

المستخدم لا يصل مباشرة إلى PostgreSQL.

أي وصول إلى البيانات يجب أن يمر عبر:

- Authentication.
- Authorization.
- Validation.
- Business rules.

---

### Application Server → Gemini

Gemini خدمة خارجية غير موثوقة بالكامل.

لا يسمح لها بالوصول المباشر إلى قاعدة البيانات.

يجب أن تمر البيانات عبر:

Application
→ Data Sanitizer
→ Prompt Builder
→ Gemini Adapter
→ Output Validator
→ Application

---

### Application Server → External URLs

الموارد التعليمية قد تحتوي روابط خارجية.

أي URL يتم جلبه مستقبلًا من الخادم يعتبر مدخلًا غير موثوق.

يجب تطبيق ضوابط SSRF.

---

## 4. Likely attacker profiles

### External attacker

شخص من خارج المدرسة يحاول:

- تخمين كلمات المرور.
- استغلال ثغرة في API.
- سرقة جلسات.
- استغلال XSS.
- استغلال dependency vulnerable.
- اكتشاف endpoints غير محمية.
- استغلال إعدادات خاطئة.

---

### Compromised student account

حساب طالبة تم اختراقه.

المهاجم قد يحاول:

- الوصول إلى بيانات طالبات أخريات.
- رؤية الدرجات الخاصة.
- تغيير النقاط.
- تعديل نتائج الاختبارات.
- الوصول إلى لوحة المعلمة.
- استغلال معرفات IDs.

النظام يجب أن يحد الضرر إلى بيانات الحساب نفسه فقط قدر الإمكان.

---

### Malicious authenticated student

طالبة مسجلة تحاول تجاوز صلاحياتها عمدًا.

أمثلة:

- تعديل studentId في الطلب.
- الوصول المباشر إلى endpoint خاص بالمعلمة.
- تغيير assignmentId.
- تغيير assessmentId.
- محاولة تعديل score.
- إرسال حقول إضافية في JSON.

---

### Compromised teacher account

اختراق حساب المعلمة أكثر خطورة من حساب الطالبة.

قد يحاول المهاجم:

- الوصول إلى بيانات كل الطالبات.
- تعديل درجات.
- إنشاء اختبارات.
- إرسال إشعارات.
- إنشاء موارد ضارة.
- تعديل خطط علاجية.

يجب ألا يعطي حساب المعلمة صلاحيات ADMIN.

---

### Compromised admin account

هذا من أخطر السيناريوهات.

قد يسمح للمهاجم بـ:

- إنشاء مستخدمين.
- تعطيل حسابات.
- إعادة تعيين كلمات مرور.
- تغيير إعدادات النظام.

لهذا يجب حماية حساب ADMIN بأشد الضوابط.

---

## 5. Main attack surfaces

### Login page

المخاطر:

- brute force.
- credential stuffing.
- username enumeration.
- timing attacks.
- automated login attempts.

الضوابط:

- Rate limiting.
- Generic login errors.
- Strong password hashing.
- Security event logging.
- Optional progressive delays.
- No permanent IP-only lockout.

---

### Session handling

المخاطر:

- session theft.
- session fixation.
- session replay.
- expired sessions remaining active.
- sessions not revoked after reset.

الضوابط:

- Random session token.
- Store token hash only.
- HttpOnly cookie.
- Secure cookie in production.
- SameSite.
- Session expiration.
- Session revocation.
- Logout single session.
- Logout all sessions.

---

### Student profile endpoints

المخاطر:

- IDOR.
- Broken Object Level Authorization.
- data exposure.

مثال:

طالبة تغير:

studentId=ST-0001

إلى:

studentId=ST-0002

الضابط:

الخادم لا يعتمد على studentId وحده.

يجب مقارنة المستخدم الحالي بالطالب المطلوب أو التحقق من صلاحية المعلمة أو المدير.

---

## 6. Authorization threats

أخطر تهديد للمنصة هو Broken Access Control.

يجب ألا تعتمد الصلاحيات على:

- إخفاء زر.
- route name.
- frontend state.
- client role.
- URL structure.

كل عملية حساسة يجب أن تتحقق Server-Side.

المبدأ:

Default Deny

---

## 7. Mass assignment

مثال غير آمن:

```ts
await prisma.student.update({
  where: { id },
  data: requestBody,
})