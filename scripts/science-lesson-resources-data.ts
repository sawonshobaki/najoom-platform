import type { LessonResourceType } from "../src/generated/prisma/enums";

export const RESOURCE_ACADEMIC_YEAR = "2026-2027";
export type ScienceLessonResource = {
  grade: string;
  semester: string;
  unit: string;
  lesson: string;
  sourceHost: "phet.colorado.edu" | "spaceplace.nasa.gov";
  title: string;
  url: string;
  type: LessonResourceType;
  language: string;
  isFree: boolean;
  sortOrder: number;
  instructionsArabic: string;
};

export const scienceLessonResources: ScienceLessonResource[] = [
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الأول", unit: "المادة", lesson: "الذرات والجزيئات",
    sourceHost: "phet.colorado.edu", title: "بناء ذرة - PhET",
    url: "https://phet.colorado.edu/sims/html/build-an-atom/latest/build-an-atom_ar_SA.html",
    type: "SIMULATION", language: "العربية", isFree: true, sortOrder: 1,
    instructionsArabic: "عندي لكِ تحدي صغير: كوّني ذرات مختلفة بإضافة البروتونات والنيوترونات والإلكترونات، وراقبي كيف يتغيّر اسم العنصر وشحنته وكتلته.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الأول", unit: "الشغل والطاقة", lesson: "الطاقة الميكانيكية",
    sourceHost: "phet.colorado.edu", title: "منتزه التزلج والطاقة - PhET",
    url: "https://phet.colorado.edu/ar_SA/simulations/energy-skate-park-basics",
    type: "SIMULATION", language: "العربية", isFree: true, sortOrder: 1,
    instructionsArabic: "حرّكي المتزلجة على المسار وراقبي طاقة الحركة وطاقة الوضع. جرّبي تغيير ارتفاع المسار ولاحظي ماذا يحدث للطاقة والسرعة.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الثاني", unit: "علوم الفضاء", lesson: "المجرات",
    sourceHost: "spaceplace.nasa.gov", title: "أنواع المجرات - NASA Space Place",
    url: "https://spaceplace.nasa.gov/galactic-explorer/en/",
    type: "ARTICLE", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "شوفي أشكال المجرات المختلفة، وركّزي على الفرق بين المجرات الحلزونية والبيضاوية وغير المنتظمة. بعد ما تخلصي، حاولي تميّزي شكل مجرتنا درب التبانة.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الثاني", unit: "علوم الفضاء", lesson: "الفضاء والكون",
    sourceHost: "spaceplace.nasa.gov", title: "استكشاف الكون - NASA Space Place",
    url: "https://spaceplace.nasa.gov/menu/space/",
    type: "ARTICLE", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "اختاري موضوعًا واحدًا عن الكون واستكشفيه، مثل النجوم أو الثقوب السوداء أو المجرات. ركّزي على معلومة جديدة تقدري تحكيها لعُلا بعد ما ترجعي.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الثاني", unit: "علوم الفضاء", lesson: "الفضاء والكون",
    sourceHost: "spaceplace.nasa.gov", title: "ألعاب وأنشطة الفضاء - NASA Space Place",
    url: "https://spaceplace.nasa.gov/en/menu/kids/",
    type: "GAME", language: "الإنجليزية", isFree: true, sortOrder: 2,
    instructionsArabic: "اختاري لعبة أو نشاطًا عن الفضاء وجربيه. لا يهم تخلصي كل شيء؛ ركّزي على فكرة علمية واحدة جديدة تتعلميها من النشاط.",
  },
];
