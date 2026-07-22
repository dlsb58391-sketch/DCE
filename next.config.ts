import type { NextConfig } from "next";

// Baseline security headers applied to every response. CSP is intentionally
// deferred (needs per-request nonces for Next's inline runtime) and tracked
// as a separate task. HSTS is only emitted for hosted HTTPS (not the desktop
// build, which serves plain http://127.0.0.1).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "browsing-topics=()" },
];

if (process.env.NODE_ENV === "production" && process.env.DESKTOP !== "1") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The desktop (Electron) build bundles a self-contained Node server produced by
  // Next's standalone output. Gated on DESKTOP_BUILD so the Railway `next start`
  // deployment is unaffected.
  ...(process.env.DESKTOP_BUILD ? { output: "standalone" as const } : {}),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
