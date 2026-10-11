export const OULA_STATES = ["WELCOME", "HINT", "THINKING", "SUCCESS", "LAB", "RESOURCE"] as const;
export type OulaState = typeof OULA_STATES[number];

export const OULA_MESSAGES: Record<OulaState, readonly [string, string]> = {
  WELCOME: ["أهلين يا نشمية! جاهزة نبدأ؟", "عَفية! خلينا نكتشف فكرة جديدة اليوم."],
  HINT: ["فكري شوي... شو المعلومة اللي ممكن تساعدك؟", "تلميح صغير من عُلا 💡"],
  THINKING: ["خذي وقتك وفكري بالمعلومة اللي تعلمناها.", "جرّبي تربطي السؤال بالمثال اللي شفناه."],
  SUCCESS: ["عَفية عليكِ! شغل مرتب 🌟", "ممتاز يا نشمية! كمّلي هيك."],
  LAB: ["يلا على المختبر! خلينا نجرب ونشوف النتيجة.", "جاهزة للتجربة؟ راقبي التغيّر منيح 🔬"],
  RESOURCE: ["عندي لكِ تجربة ممتعة مرتبطة بالدرس.", "خلينا نشوف الفكرة بطريقة ثانية 🎮"],
};

// الأصول الافتراضية لكل حالة؛ يمكن تجاوزها باستخدام imageSrc.
export const OULA_ASSETS: Record<OulaState, string> = {
  WELCOME: "/characters/oula/welcome.png",
  HINT: "/characters/oula/hint.png",
  THINKING: "/characters/oula/thinking.png",
  SUCCESS: "/characters/oula/success.png",
  LAB: "/characters/oula/lab.png",
  RESOURCE: "/characters/oula/resource.png",
};

export function getOulaGuideMessage(state: OulaState, message?: string) {
  return message?.trim() || OULA_MESSAGES[state][0];
}

export const OULA_DIALOGUE_CONTEXTS = [
  "WELCOME", "LESSON_START", "EXPLANATION", "HINT", "RETRY", "THINKING", "CORRECT",
  "ENCOURAGEMENT", "LAB_START", "LAB_OBSERVATION", "RESOURCE", "VIDEO",
  "ACTIVITY_COMPLETE", "LESSON_COMPLETE", "REVIEW", "MAJOR_ACHIEVEMENT",
] as const;
export type OulaDialogueContext = typeof OULA_DIALOGUE_CONTEXTS[number];

// عبارات السياقات المقدمة من مالك المشروع؛ عبارات العرض الحالية أعلاه محفوظة للتوافق.
export const OULA_DIALOGUES: Record<OulaDialogueContext, readonly [string, ...string[]]> = {
  WELCOME: [
    "أهلين يا نشمية! جاهزة نبدأ؟ 🌟",
    "يا هلا! شو رأيك نكتشف شي جديد اليوم؟",
    "عَفية! جاهزة لمغامرة علمية جديدة؟",
    "أهلين فيكِ! يلا نبدأ سوا.",
  ],
  LESSON_START: [
    "يلا نشوف شو رح نتعلم اليوم.",
    "خلينا نبلّش بالفكرة الأساسية.",
    "ركّزي معي شوي، الموضوع اليوم حلو!",
    "جاهزة؟ عندنا فكرة جديدة نستكشفها.",
  ],
  EXPLANATION: [
    "ممتاز، هسه خلينا نربطها بمثال.",
    "شايفة كيف الفكرة صارت أوضح؟",
    "هاي المعلومة رح تساعدك بعد شوي.",
    "ركّزي بهالنقطة، إلها دور مهم.",
  ],
  HINT: [
    "تلميح صغير من عُلا 💡",
    "فكري شوي… شو المعلومة اللي ممكن تساعدك؟",
    "جرّبي تربطي السؤال بالمثال اللي شفناه.",
    "شوفي الكلمات المهمة بالسؤال، يمكن تدلّك على الحل.",
  ],
  RETRY: [
    "قريبة يا نشمية، جرّبي مرة ثانية.",
    "محاولة حلوة! خلينا نفكر فيها من زاوية ثانية.",
    "مش بعيدة عن الحل، شو رأيك نجرب تلميح؟",
    "عَفية على المحاولة، راجعي الفكرة وجربي كمان مرة.",
  ],
  CORRECT: [
    "عَفية عليكِ! إجابة ممتازة 🌟",
    "ممتاز يا نشمية!",
    "صح عليكِ! 👏",
    "شغل مرتب، كمّلي هيك!",
  ],
  ENCOURAGEMENT: [
    "قدّها يا نشمية!",
    "عَفية، كمّلي!",
    "شغلك مرتب!",
    "ممتاز، خطوة ورا خطوة.",
    "واضح إنك مركزة 👏",
  ],
  THINKING: [
    "خذي وقتك وفكري بالمعلومة اللي تعلمناها.",
    "ما في عجلة، رتّبي أفكارك.",
    "فكري: شو السبب؟ وشو النتيجة؟",
    "جرّبي تقارني بين الخيارات قبل ما تختاري.",
  ],
  LAB_START: [
    "يلا على المختبر! 🔬",
    "جاهزة للتجربة؟ راقبي التغيّر منيح.",
    "نشوف شو بصير لما نغيّر واحد من العوامل.",
    "قبل ما نبدأ، شو بتتوقعي يصير؟",
  ],
  LAB_OBSERVATION: [
    "ملاحظة ممتازة!",
    "ركّزي شو تغيّر وشو ظل ثابت.",
    "سجلي النتيجة، رح نحتاجها بعد شوي.",
    "شو لاحظتي هالمرة؟",
  ],
  RESOURCE: [
    "عندي لكِ تجربة ممتعة مرتبطة بالدرس 🎮",
    "يلا نجرب الفكرة بطريقة ثانية.",
    "جاهزة للتحدي؟",
    "جربي النشاط وركّزي شو بصير.",
  ],
  VIDEO: [
    "خلينا نشوف الفكرة وهي بتصير قدامنا 🎥",
    "ركّزي بالفيديو على هاي النقطة.",
    "بعد الفيديو رح أسألك سؤال صغير.",
    "شوفي المثال، وبعدها بنحكي شو لاحظتي.",
  ],
  ACTIVITY_COMPLETE: [
    "خلصتيها! عَفية عليكِ 🎉",
    "إنجاز جديد إلكِ!",
    "ممتاز! جاهزة للتحدي اللي بعده؟",
    "شغل قوي يا نشمية 🌟",
  ],
  LESSON_COMPLETE: [
    "هيك خلصنا درسنا، عَفية عليكِ!",
    "ممتاز! شو أهم فكرة بتتذكريها من الدرس؟",
    "درس جديد صار بجيبك 🌟",
    "جاهزة ننتقل للمغامرة اللي بعدها؟",
  ],
  REVIEW: [
    "يلا نشوف شو بتتذكري.",
    "هاي مراجعة سريعة، قدّها؟",
    "خلينا نثبت المعلومة بسؤال صغير.",
    "شوي مراجعة وبنكون تمام.",
  ],
  MAJOR_ACHIEVEMENT: [
    "يا سلام! شغل نشمية عن جد 🎉",
    "عَفية عليكِ، أنجزتيها!",
    "ممتاز جدًا، واضح تعبك جاب نتيجة.",
    "هذا الإنجاز بستاهل نجمة 🌟",
  ],
};

export const OULA_CONTEXT_STATES: Record<OulaDialogueContext, OulaState> = {
  WELCOME: "WELCOME",
  LESSON_START: "WELCOME",
  EXPLANATION: "THINKING",
  HINT: "HINT",
  RETRY: "THINKING",
  THINKING: "THINKING",
  CORRECT: "SUCCESS",
  ENCOURAGEMENT: "SUCCESS",
  LAB_START: "LAB",
  LAB_OBSERVATION: "LAB",
  RESOURCE: "RESOURCE",
  VIDEO: "RESOURCE",
  ACTIVITY_COMPLETE: "SUCCESS",
  LESSON_COMPLETE: "SUCCESS",
  REVIEW: "THINKING",
  MAJOR_ACHIEVEMENT: "SUCCESS",
};

export function getOulaMessage(context: OulaDialogueContext, index = 0): string {
  const messages = OULA_DIALOGUES[context];
  return Number.isInteger(index) && index >= 0 && index < messages.length ? messages[index] : messages[0];
}

export function getOulaState(context: OulaDialogueContext): OulaState {
  return OULA_CONTEXT_STATES[context];
}

export const OULA_STUDENT_GREETING = "معكِ يا ";

export const OULA_STATE_LABELS: Record<OulaState, string> = {
  WELCOME: "ترحيب", HINT: "تلميح", THINKING: "نفكّر معًا",
  SUCCESS: "عَفية عليكِ", LAB: "المختبر", RESOURCE: "نشاط تعليمي",
};
