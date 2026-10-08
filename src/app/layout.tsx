// layout.tsx — جذر متجرك. الخطوط والألوان محقونة من تصميم متجرك عند التوليد.
import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { fontVariables } from "@/lib/fonts";
import { STORE } from "@/store.config";
import "./globals.css";
import "./store-theme.css";

export const metadata: Metadata = {
  title: { default: STORE.name, template: `%s | ${STORE.name}` },
  applicationName: STORE.name,
  icons: { icon: [{ url: "/favicon.ico" }], apple: [{ url: "/favicon.ico" }] },
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={fontVariables}>
      <body className="min-h-dvh">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          {children}
          <Toaster position="bottom-center" richColors dir="rtl" closeButton toastOptions={{ classNames: { toast: "font-body" } }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
