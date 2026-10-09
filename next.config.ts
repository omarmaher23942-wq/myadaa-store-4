// next.config.ts — إعدادات متجرك. المتجر ولوحة التحكم على نفس النطاق.
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://utfs.io https://*.ufs.sh https://*.googleusercontent.com",
  "media-src 'self' data: blob: https://utfs.io https://*.ufs.sh",
  ["script-src 'self' 'unsafe-inline'", isDev ? "'unsafe-eval'" : "", "https://connect.facebook.net", "https://www.googletagmanager.com"].filter(Boolean).join(" "),
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.uploadthing.com https://*.ingest.uploadthing.com https://utfs.io https://*.ufs.sh https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ملفات مخطط قاعدة البيانات تُقرأ وقت التشغيل في صفحة الإعداد الأول (/setup).
  outputFileTracingIncludes: { "/setup": ["./drizzle/**/*"], "/api/setup": ["./drizzle/**/*"] },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // الصور تُقدَّم مباشرة من شبكة UploadThing (CDN سريع) بدل خادم تحسين الصور في Vercel: خطة Vercel
    // المجانية لها حد شهري لتحسين الصور، وعند تجاوزه أو تعذّر جلب الأصل تظهر الصورة مكسورة (خطأ 400/402).
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
