import type { StoreBlueprint } from "@/blueprint/schema";
/** رسائل من الداشبورد إلى المتجر */
export type ToStore =
  | { type: "editor:init"; blueprint: StoreBlueprint }        // تفعيل وضع التحرير بمسودة
  | { type: "editor:blueprint"; blueprint: StoreBlueprint }   // تحديث حي للمسودة
  | { type: "editor:select"; sectionId: string | null }       // تحديد قسم من القائمة
  | { type: "editor:scrollTo"; sectionId: string };
/** رسائل من المتجر إلى الداشبورد */
export type FromStore =
  | { type: "store:ready" }
  | { type: "store:select"; sectionId: string }                                 // المستخدم ضغط قسمًا
  | { type: "store:action"; sectionId: string; action: "toggle" | "up" | "down" | "duplicate" | "remove" | "edit" }
  | { type: "store:text"; sectionId: string; path: string; value: string }     // تعديل نص في مكانه
  | { type: "store:image"; sectionId: string; path: string }                    // طلب تغيير صورة
  | { type: "store:route"; path: string };
export const EDITOR_PARAM = "clp_editor";
/** أصل المنصة (الداشبورد) — الطرف الوحيد المسموح له بمراسلة المتجر في وضع التحرير. */
export const PLATFORM_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/** إرسال إلى أصل محدد فقط (لا "*")، فلا تصل بيانات المسودة لأي إطار غريب. */
export const post = (
  target: Window | null | undefined,
  msg: ToStore | FromStore,
  targetOrigin: string = PLATFORM_ORIGIN
) => {
  if (target && targetOrigin) target.postMessage(msg, targetOrigin);
};
