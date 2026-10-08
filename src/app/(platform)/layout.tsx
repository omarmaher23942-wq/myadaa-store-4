// غلاف صفحات صاحب المتجر (لوحة التحكم، الدخول). اللوحة لها تصميمها الكوني الخاص.
import type { Metadata } from "next";
import { STORE } from "@/store.config";

export const metadata: Metadata = {
  title: { default: `لوحة تحكم ${STORE.name}`, template: `%s · ${STORE.name}` },
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative isolate min-h-dvh bg-background text-foreground">{children}</div>;
}
