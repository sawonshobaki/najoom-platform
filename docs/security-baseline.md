# Najoom Platform Security Baseline

## 1. Security goals

منصة نجوم تتعامل مع بيانات طالبات مدرسية، لذلك يجب أن تحقق المبادئ التالية:

1. أقل قدر ممكن من الصلاحيات لكل مستخدم.
2. التحقق من الصلاحيات على الخادم دائمًا.
3. عدم الثقة في بيانات المتصفح أو معرفات URL.
4. تقليل البيانات المخزنة والمرسلة.
5. عدم تخزين أسرار أو كلمات مرور بصيغة قابلة للقراءة.
6. عدم السماح لأي خدمة ذكاء اصطناعي بالوصول المباشر إلى قاعدة البيانات.
7. الحفاظ على سرعة المنصة وخفتها على الهواتف.
8. جعل الكود الأمني مركزيًا وواضحًا وقابلًا للاختبار.

---

## 2. User roles

### STUDENT

يمكن للطالبة الوصول إلى:

- حسابها الشخصي.
- بياناتها التعليمية.
- واجباتها.
- اختباراتها.
- نتائجها عندما تسمح المعلمة بعرضها.
- بطاقاتها التعليمية.
- خططها العلاجية المسموح بعرضها.
- تقدمها وإنجازاتها.
- إشعاراتها.
- ترتيب شعبتها بالمعلومات العامة المسموحة.

لا يمكن للطالبة:

- مشاهدة بيانات طالبة أخرى الخاصة.
- تعديل الدرجات.
- تعديل النقاط.
- تعديل نتائج الاختبارات.
- إنشاء مستخدمين.
- تغيير الصف أو الشعبة بنفسها.
- الوصول إلى لوحات المعلمة أو المدير.

---

### TEACHER

يمكن للمعلمة:

- إدارة المحتوى التعليمي.
- إنشاء وإدارة الاختبارات.
- إنشاء وإدارة الواجبات.
- تصحيح الواجبات يدويًا.
- مراجعة نتائج الطالبات.
- مشاهدة تحليلات الطالبات.
- إدارة الخطط العلاجية.
- إنشاء وإدارة الموارد.
- إرسال الإشعارات.
- مراجعة المحتوى المقترح بالذكاء الاصطناعي.

لا يمكن للمعلمة:

- تجاوز صلاحيات ADMIN.
- الوصول إلى أسرار النظام.
- قراءة كلمات المرور.
- قراءة session tokens.
- تعديل Audit Logs.

---

### ADMIN

يمكن للمدير:

- إدارة المستخدمين.
- تفعيل وتعطيل الحسابات.
- إعادة تعيين كلمات المرور.
- إدارة إعدادات النظام المسموحة.
- تنفيذ العمليات الإدارية الحساسة.

لا يمكن للمدير:

- قراءة كلمات المرور الحالية.
- قراءة session tokens الخام.
- قراءة API keys من التطبيق.
- تعديل Audit Logs القديمة.

---

## 3. Authentication strategy

سيتم استخدام نظام جلسات Server-Side Sessions.

لن نستخدم JWT مخزنًا في localStorage.

الجلسة ستعمل بالشكل التالي:

Browser
→ Secure HttpOnly Cookie
→ Random Session Token
→ Hash Token
→ Session Record in Database
→ User

سيتم تخزين hash للـ session token فقط داخل قاعدة البيانات.

لن يتم تخزين session token الخام في قاعدة البيانات.

---

## 4. Session cookie policy

كوكي الجلسة يجب أن تكون:

- HttpOnly
- Secure في بيئة الإنتاج
- SameSite=Lax أو أكثر صرامة حسب الحاجة
- Path=/
- لها مدة انتهاء واضحة

لا يمكن لـ JavaScript في المتصفح قراءة session cookie.

---

## 5. Multiple device support

يسمح للمستخدم بتسجيل الدخول من أكثر من جهاز.

كل جهاز يحصل على Session مستقل.

يجب أن يكون النظام قادرًا على:

- إنهاء جلسة واحدة.
- إنهاء جميع جلسات المستخدم.
- إنهاء الجلسات عند تعطيل الحساب.
- إنهاء الجلسات المناسبة بعد إعادة تعيين كلمة المرور.

---

## 6. Password policy

كلمات المرور لا يتم تشفيرها بطريقة قابلة للفك.

يتم تخزين Password Hash باستخدام خوارزمية قوية مخصصة لكلمات المرور.

الخيار المعتمد للمشروع:

Argon2id

لا يتم:

- تخزين كلمة المرور الأصلية.
- تسجيل كلمة المرور في logs.
- تسجيل كلمة المرور في AuditLog.
- إرسال كلمات المرور إلى Gemini.
- إرسال كلمات المرور إلى خدمات خارجية.

يتم منع كلمات المرور الضعيفة جدًا والشائعة.

إعادة تعيين كلمة المرور من المدير تنتج Password Hash جديدًا.

---

## 7. Authorization strategy

Authentication و Authorization مفهومان منفصلان.

كون المستخدم مسجل الدخول لا يعني أنه مخول للوصول إلى أي مورد.

كل عملية حساسة يجب أن تمر عبر تحقق Server-Side.

المبدأ:

Default Deny

إذا لم تكن هناك قاعدة واضحة تسمح بالعملية، يتم رفضها.

---

## 8. Object-level authorization

يجب عدم الاعتماد على معرفات URL أو body وحدها.

مثال غير آمن:

GET /students/{studentId}

ثم إعادة بيانات الطالب مباشرة.

التطبيق يجب أن يتحقق من:

- المستخدم الحالي.
- دوره.
- علاقته بالمورد المطلوب.
- هل يملك صلاحية قراءة هذا الطالب.

معرفة studentId لا تعني امتلاك صلاحية الوصول إليه.

---

## 9. Central authorization layer

لن يتم توزيع شروط الصلاحيات بشكل عشوائي بين الصفحات.

سنستخدم طبقة مركزية مثل:

- requireAuthenticatedUser()
- requireRole()
- canViewStudent()
- canManageAssessment()
- canGradeAssignment()
- canManageUsers()

ويتم اختبار هذه الدوال بوحدات اختبار مستقلة.

---

## 10. Input validation

كل بيانات تدخل من المستخدم تعتبر غير موثوقة.

يتم التحقق منها باستخدام Zod أو validation واضح على الخادم.

يجب تحديد:

- النوع.
- الحد الأدنى.
- الحد الأقصى.
- القيم المسموحة.
- الحقول المسموح تعديلها.

لا يتم تمرير request body مباشرة إلى Prisma update/create.

---

## 11. Rate limiting

سيتم تطبيق Rate Limiting خصوصًا على:

- تسجيل الدخول.
- تغيير كلمة المرور.
- إعادة تعيين كلمة المرور.
- العمليات الإدارية الحساسة.
- طلبات Gemini.

يجب ألا يعتمد الحظر الدائم على IP فقط.

يجب تجنب Lockout يمكن للمهاجم استخدامه لتعطيل حسابات الطالبات.

---

## 12. Login error messages

يجب ألا تكشف رسالة تسجيل الدخول إن كان اسم المستخدم موجودًا أم لا.

مثال:

بيانات الدخول غير صحيحة.

بدل:

اسم المستخدم غير موجود.

أو:

كلمة المرور خاطئة.

---

## 13. Audit logging

AuditLog يستخدم للعمليات الحساسة مثل:

- تعديل الدرجات.
- نقل طالبة بين الشعب.
- تعديل النقاط يدويًا.
- تغيير الإعدادات.
- العمليات الإدارية.
- تغييرات الحسابات الحساسة.

يجب ألا يحتوي AuditLog على:

- كلمات مرور.
- session tokens.
- API keys.
- أسرار.
- بيانات شخصية غير ضرورية.

AuditLog يعامل كسجل Append-Only على مستوى التطبيق.

---

## 14. Security event logging

الأحداث الأمنية تختلف عن AuditLog.

أمثلة:

- Login failure.
- Rate limit triggered.
- Invalid session.
- Authorization denied.
- Suspicious repeated requests.

يجب ألا تحتوي هذه السجلات على أسرار.

---

## 15. XSS protection

يجب تجنب dangerouslySetInnerHTML.

المحتوى النصي يتم عرضه كنص افتراضيًا.

أي HTML خارجي مستقبلي يحتاج sanitization صريح.

لا يتم تنفيذ محتوى يولده Gemini كـ HTML موثوق.

---

## 16. CSRF protection

العمليات التي تغير البيانات تستخدم HTTP methods الصحيحة.

لا يتم تعديل البيانات باستخدام GET.

يتم الاعتماد على:

- Secure session cookies.
- SameSite cookies.
- Origin validation أو CSRF protection عند الحاجة.

---

## 17. SQL injection protection

يتم استخدام Prisma APIs العادية.

Raw SQL لا يستخدم إلا عند وجود حاجة حقيقية.

أي Raw SQL يجب:

- مراجعته.
- استخدام parameterized queries.
- اختباره أمنيًا.

---

## 18. URL and SSRF safety

روابط الموارد التعليمية تخضع للتحقق.

يجب السماح بالبروتوكولات المناسبة فقط.

إذا احتاج الخادم مستقبلًا إلى جلب URL خارجي:

- يمنع localhost.
- تمنع private network addresses.
- تمنع cloud metadata endpoints.
- تتم مراجعة redirects.
- يتم وضع timeouts وحدود للحجم.

---

## 19. AI security

Gemini لا يصل مباشرة إلى قاعدة البيانات.

المسار المعتمد:

Application
→ Data Sanitizer
→ Prompt Builder
→ Gemini Adapter
→ Output Validator
→ Application

لا يتم إرسال:

- كلمات المرور.
- session tokens.
- API keys.
- بيانات غير ضرورية عن الطالبات.

مخرجات Gemini تعتبر غير موثوقة حتى يتم التحقق منها.

---

## 20. Secrets management

الأسرار تحفظ في Environment Variables فقط.

أمثلة:

- DATABASE_URL
- Gemini API key
- session secrets

لا يتم وضع الأسرار في:

- Git.
- NEXT_PUBLIC_*.
- SystemSetting.
- frontend code.
- AuditLog.

---

## 21. Dependency security

يتم تقليل عدد الحزم قدر الإمكان.

قبل إضافة أي dependency جديدة:

1. يجب أن تكون لها حاجة واضحة.
2. يجب أن تكون maintained.
3. تتم مراجعة حجمها وتأثيرها على الأداء.
4. تتم مراجعة سجلها الأمني.

لا يتم استخدام:

npm audit fix --force

بشكل عشوائي.

---

## 22. Mobile performance security rule

الأمان لا يجب أن يجعل صفحات الطالبات ثقيلة.

المصادقة والتحقق من الجلسة تتم قدر الإمكان Server-Side.

لا يتم تحميل مكتبات أمنية كبيرة داخل المتصفح بدون حاجة.

لا يتم إرسال معلومات المستخدم أو الصلاحيات أكثر مما تحتاجه الصفحة.

---

## 23. Secure coding rules

الكود الأمني يجب أن يكون:

- بسيطًا.
- مركزيًا.
- واضح الأسماء.
- قليل التكرار.
- بدون any إلا عند ضرورة مبررة.
- قابلًا للاختبار.

أسماء جيدة:

- currentUser
- sessionToken
- sessionTokenHash
- authenticatedUser
- studentId
- expiresAt
- canViewStudent

أسماء غير مقبولة:

- x
- tmp
- obj
- d
- data2

---

## 24. Security testing requirements

قبل الإطلاق يجب اختبار:

- Login brute force.
- Invalid passwords.
- Disabled accounts.
- Expired sessions.
- Revoked sessions.
- Session logout.
- Logout from all devices.
- Student accessing another student.
- Student accessing teacher endpoints.
- Teacher accessing admin endpoints.
- ID manipulation.
- Mass assignment.
- XSS payloads.
- Invalid URLs.
- Unauthorized direct API access.
- Rate limiting.
- Password reset behavior.

---

## 25. Incident principle

لا يوجد نظام يمكن اعتباره آمنًا 100%.

الهدف هو:

Prevent
→ Limit
→ Detect
→ Respond
→ Recover

حتى عند حدوث اختراق لحساب واحد، يجب أن تبقى مساحة الضرر محدودة قدر الإمكان.