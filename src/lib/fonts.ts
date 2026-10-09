// fonts.ts — خطوط متجرك فقط (مولّد من تصميم متجرك).
import { Cairo, Noto_Kufi_Arabic } from "next/font/google";

export const fontCairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo", display: "swap" });
export const fontKufi = Noto_Kufi_Arabic({ subsets: ["arabic"], variable: "--font-noto-kufi", display: "swap" });

export const fontVariables = [fontCairo, fontKufi].map((f) => f.variable).join(" ");

/** الخطوط المحمّلة في متجرك: محرر المحتوى يعرضها وحدها (خط غير محمّل لا يظهر في المتجر). */
export const AVAILABLE_FONTS = ["cairo","noto_kufi"] as const;
