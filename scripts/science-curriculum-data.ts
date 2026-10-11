export const ACADEMIC_YEAR = "2026-2027";

export type LessonSeed = { title: string; sortOrder: number };
export type UnitSeed = { title: string; sortOrder: number; lessons: LessonSeed[] };
export type SemesterSeed = { name: string; academicYear: string; sortOrder: number; units: UnitSeed[] };
export type GradeSeed = { name: string; sortOrder: number; semesters: SemesterSeed[] };

// العناوين من البيانات الرسمية المقدمة من مالك المشروع؛ لا تتضمن شروحًا أو موارد.
export const scienceCurriculum: GradeSeed[] = [
  {
    name: "الصف الخامس", sortOrder: 5,
    semesters: [
      {
        name: "الفصل الدراسي الأول", academicYear: ACADEMIC_YEAR, sortOrder: 1,
        units: [
          { title: "البيئة", sortOrder: 1, lessons: [
            { title: "مفاهيم النظام البيئي", sortOrder: 1 },
            { title: "أثر تغيرات البيئة في الأنظمة البيئية", sortOrder: 2 },
          ] },
          { title: "تصنيف الكائنات الحية", sortOrder: 2, lessons: [
            { title: "مملكة النباتات", sortOrder: 1 },
            { title: "مملكة الحيوانات", sortOrder: 2 },
            { title: "مملكة الفطريات", sortOrder: 3 },
          ] },
          { title: "الموارد الطبيعية ومصادر الطاقة", sortOrder: 3, lessons: [
            { title: "الموارد الطبيعية", sortOrder: 1 },
            { title: "مصادر الطاقة", sortOrder: 2 },
          ] },
          { title: "العناصر والمركبات الكيميائية", sortOrder: 4, lessons: [
            { title: "العناصر الكيميائية", sortOrder: 1 },
            { title: "المركبات الكيميائية", sortOrder: 2 },
          ] },
          { title: "الضوء والصوت", sortOrder: 5, lessons: [
            { title: "الضوء وخصائصه", sortOrder: 1 },
            { title: "الصوت وخصائصه", sortOrder: 2 },
          ] },
        ],
      },
      {
        name: "الفصل الدراسي الثاني", academicYear: ACADEMIC_YEAR, sortOrder: 2,
        units: [
          { title: "الغذاء والصحة", sortOrder: 1, lessons: [
            { title: "مجموعات الغذاء", sortOrder: 1 },
            { title: "الغذاء المتوازن", sortOrder: 2 },
          ] },
          { title: "أجهزة جسم الإنسان", sortOrder: 2, lessons: [
            { title: "الجهاز الهضمي، والجهاز البولي", sortOrder: 1 },
            { title: "الجهاز التنفسي، وجهاز الدوران", sortOrder: 2 },
            { title: "الجهاز الهيكلي، والجهاز العضلي", sortOrder: 3 },
          ] },
          { title: "المادة", sortOrder: 3, lessons: [
            { title: "الخصائص الفيزيائية للمواد", sortOrder: 1 },
            { title: "تحولات المادة", sortOrder: 2 },
          ] },
          { title: "الحركة والطاقة", sortOrder: 4, lessons: [
            { title: "السرعة", sortOrder: 1 },
            { title: "الطاقة الميكانيكية", sortOrder: 2 },
          ] },
          { title: "الأرض", sortOrder: 5, lessons: [
            { title: "مكونات الأرض", sortOrder: 1 },
            { title: "الأرصاد الجوية", sortOrder: 2 },
          ] },
        ],
      },
    ],
  },
  {
    name: "الصف السادس", sortOrder: 6,
    semesters: [
      {
        name: "الفصل الدراسي الأول", academicYear: ACADEMIC_YEAR, sortOrder: 1,
        units: [
          { title: "من الخلية إلى الجسم", sortOrder: 1, lessons: [
            { title: "الخلية", sortOrder: 1 },
            { title: "نقل المواد والعمليات الحيوية في الخلية", sortOrder: 2 },
            { title: "مستويات التنظيم في الكائنات الحية", sortOrder: 3 },
          ] },
          { title: "المادة", sortOrder: 2, lessons: [
            { title: "الذرات والجزيئات", sortOrder: 1 },
            { title: "الفلزات واللافلزات", sortOrder: 2 },
          ] },
          { title: "الشغل والطاقة", sortOrder: 3, lessons: [
            { title: "الطاقة الميكانيكية", sortOrder: 1 },
            { title: "الآلات البسيطة", sortOrder: 2 },
          ] },
          { title: "الإنسان والأرض", sortOrder: 4, lessons: [
            { title: "العمليات الجيولوجية المؤثرة في سطح الأرض", sortOrder: 1 },
            { title: "التلوث", sortOrder: 2 },
          ] },
        ],
      },
      {
        name: "الفصل الدراسي الثاني", academicYear: ACADEMIC_YEAR, sortOrder: 2,
        units: [
          { title: "البيئة", sortOrder: 1, lessons: [
            { title: "الأنظمة البيئية", sortOrder: 1 },
            { title: "الجماعات الحيوية", sortOrder: 2 },
          ] },
          { title: "المخاليط وطرائق فصلها", sortOrder: 2, lessons: [
            { title: "المواد النقية والمخاليط", sortOrder: 1 },
            { title: "فصل المخاليط", sortOrder: 2 },
          ] },
          { title: "الصوت", sortOrder: 3, lessons: [
            { title: "الموجات", sortOrder: 1 },
            { title: "الصوت والسمع", sortOrder: 2 },
          ] },
          { title: "الحرارة", sortOrder: 4, lessons: [
            { title: "الحرارة وطرائق انتقالها", sortOrder: 1 },
            { title: "الحرارة في حياتنا", sortOrder: 2 },
          ] },
          { title: "علوم الفضاء", sortOrder: 5, lessons: [
            { title: "المجرات", sortOrder: 1 },
            { title: "الفضاء والكون", sortOrder: 2 },
          ] },
        ],
      },
    ],
  },
];
