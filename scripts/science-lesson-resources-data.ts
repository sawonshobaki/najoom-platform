import type { LessonResourceType } from "../src/generated/prisma/enums";

export const RESOURCE_ACADEMIC_YEAR = "2026-2027";
export type ScienceLessonResource = {
  grade: string;
  semester: string;
  unit: string;
  lesson: string;
  sourceHost: "phet.colorado.edu" | "spaceplace.nasa.gov" | "education.nationalgeographic.org" | "studywithstem.github.io";
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
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الأول", unit: "من الخلية إلى الجسم", lesson: "نقل المواد والعمليات الحيوية في الخلية",
    sourceHost: "phet.colorado.edu", title: "نقل المواد عبر غشاء الخلية - PhET",
    url: "https://phet.colorado.edu/sims/html/membrane-transport/latest/membrane-transport_all.html",
    type: "SIMULATION", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "جرّبي الشاشات المختلفة ولاحظي كيف تنتقل المواد عبر غشاء الخلية. قارني بين الانتشار البسيط والانتشار الميسّر والنقل النشط، وركّزي على دور بروتينات النقل.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الثاني", unit: "البيئة", lesson: "الأنظمة البيئية",
    sourceHost: "education.nationalgeographic.org", title: "النظام البيئي البري - National Geographic",
    url: "https://education.nationalgeographic.org/resource/terrestrial-ecosystem/",
    type: "ARTICLE", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "اقرئي عن النظام البيئي البري وركّزي على المكونات الحية وغير الحية. لاحظي كيف تؤثر درجة الحرارة والمطر والتربة والضوء في الكائنات التي تعيش في البيئة.",
  },
  {
    grade: "الصف الخامس", semester: "الفصل الدراسي الأول", unit: "البيئة", lesson: "أثر تغيرات البيئة في الأنظمة البيئية",
    sourceHost: "education.nationalgeographic.org", title: "تأثير الإنسان في البيئة - National Geographic",
    url: "https://education.nationalgeographic.org/resource/human-impacts-environment/",
    type: "GAME", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "اختبري معلوماتك عن تأثير الإنسان في البيئة. ركّزي على التلوث والأنواع الدخيلة وتدمير المواطن الطبيعية، وفكّري كيف يمكن لهذه التغيرات أن تؤثر في النظام البيئي.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الأول", unit: "من الخلية إلى الجسم", lesson: "الخلية",
    sourceHost: "studywithstem.github.io", title: "استكشاف الخلية النباتية والحيوانية",
    url: "https://studywithstem.github.io/tools/biology/interactive-cell/",
    type: "SIMULATION", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "استكشفي الخلية النباتية والخلية الحيوانية، واضغطي على الأجزاء المختلفة لتتعرفي إلى وظائفها. بعد ذلك قارني بين الخليتين وركّزي على الأجزاء المشتركة والأجزاء التي تميّز كل واحدة منهما.",
  },
  {
    grade: "الصف السادس", semester: "الفصل الدراسي الثاني", unit: "البيئة", lesson: "الجماعات الحيوية",
    sourceHost: "education.nationalgeographic.org", title: "الجماعات الحيوية والكثافة السكانية - National Geographic",
    url: "https://education.nationalgeographic.org/resource/population-density/",
    type: "ARTICLE", language: "الإنجليزية", isFree: true, sortOrder: 1,
    instructionsArabic: "اقرئي تعريف الجماعة الحيوية وركّزي على أن أفرادها ينتمون إلى النوع نفسه ويعيشون في منطقة محددة. لاحظي أيضًا كيف تساعد الكثافة السكانية في وصف عدد أفراد الجماعة داخل المساحة.",
  },
];
