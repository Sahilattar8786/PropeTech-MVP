import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
const s3PublicUrl = process.env.S3_PUBLIC_URL?.trim().replace(/\/+$/, "");
if (s3PublicUrl) {
  if (!/^https?:\/\//.test(s3PublicUrl)) {
    throw new Error(`S3_PUBLIC_URL must start with https:// (got "${s3PublicUrl}"), e.g. https://media.example.com`);
  }
  remotePatterns.push(new URL(`${s3PublicUrl}/**`));
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Dev only: lets the app load through a Cloudflare quick tunnel (needed for WhatsApp webhooks locally).
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.app"],
  serverExternalPackages: ["mongoose", "sharp", "bullmq", "ioredis"],
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
