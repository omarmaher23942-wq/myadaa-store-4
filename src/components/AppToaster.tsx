"use client";

// AppToaster — الإشعارات المنبثقة للتطبيق كله. داخل لوحة التاجر تتبع ثيمها (الداكن أو الفاتح)
// لأن اللوحة تحمل ثيمها على غلافها (.dash.dark) لا على <html>؛ وخارجها (المتجر والمنصة) فاتحة كما هي.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

export function AppToaster() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const dash = document.querySelector(".dash");
    const read = () => setTheme(dash?.classList.contains("dark") ? "dark" : "light");
    read();
    if (!dash) return;
    const mo = new MutationObserver(read);
    mo.observe(dash, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, [pathname]);

  return (
    <Toaster
      position="bottom-center"
      richColors
      dir="rtl"
      closeButton
      theme={theme}
      toastOptions={{ classNames: { toast: "font-body" } }}
    />
  );
}
