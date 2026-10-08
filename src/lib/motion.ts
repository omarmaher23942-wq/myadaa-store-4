import type { Transition, Variants } from "motion/react";

/** منحنيات التسارع الموحدة */
export const EASE = {
  brand: [0.22, 1, 0.36, 1] as [number, number, number, number],
  cosmic: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

/** المدد بالثواني (تطابق --motion-* في globals.css) */
export const DURATION = { fast: 0.16, base: 0.3, slow: 0.56 } as const;

/** فيزياء النوابض الموحدة للمنصة والمتاجر ولوحات التحكم */
export const SPRING = {
  /** الأزرار والضغطات: يستقر بسرعة بدون ارتداد */
  snappy: { type: "spring", stiffness: 420, damping: 32, mass: 0.8 },
  /** الافتراضي: كشف العناصر، الانتقالات، القوائم */
  smooth: { type: "spring", stiffness: 200, damping: 25 },
  /** العناصر الكبيرة: صور، Drawers، Sheets */
  gentle: { type: "spring", stiffness: 130, damping: 22 },
  /** لحظات احتفالية فقط: طلب جديد، نجاح الدفع */
  bouncy: { type: "spring", stiffness: 320, damping: 16 },
} as const satisfies Record<string, Transition>;

/** إعداد الظهور عند التمرير: مرة واحدة، قبل دخول العنصر بـ 80px */
export const VIEWPORT_ONCE = { once: true, margin: "-80px" } as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE.cosmic } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: SPRING.smooth },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: SPRING.smooth },
};

/** RTL: البداية يمينًا، لذا ندخل من x موجب */
export const slideInStart: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: SPRING.smooth },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(8px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DURATION.slow, ease: EASE.cosmic } },
};

/** حاوية تتابع الأبناء */
export function stagger(children = 0.06, delay = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: children, delayChildren: delay } } };
}

/** خصائص جاهزة لأي عنصر قابل للضغط */
export const PRESSABLE = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: SPRING.snappy,
} as const;
