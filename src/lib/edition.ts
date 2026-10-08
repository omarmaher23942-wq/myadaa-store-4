// edition.ts — نسخة متجرك الخاصة (المتجر + لوحة التحكم على حساباتك).
export const EDITION = "store" as "platform" | "store";

/** مفاتيحك الخاصة (UploadThing وGroq) تُدار من هذه الصفحة وتُحفظ في قاعدتك أنت. */
export const INTEGRATIONS_NAV = { label: "الربط والمفاتيح", href: "/dashboard/integrations" } as const;

export const NO_STORE_HREF = "/setup";

export const CUSTOMER_ACCOUNTS = false as boolean;

export const DASHBOARD_TITLE_TEMPLATE = "%s · لوحة التحكم";

export const PLATFORM_ONLY_NAV = ["/dashboard/billing", "/dashboard/store", "/dashboard/design"] as const;
