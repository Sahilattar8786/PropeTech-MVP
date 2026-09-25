import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #ffffff 0%, #e9f5f3 100%)", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "#0f766e", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 30, fontWeight: 700 }}>P</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#111827" }}>{siteConfig.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, color: "#111827", letterSpacing: -2 }}>Turn WhatsApp Property Messages Into Professional Listings.</div>
          <div style={{ fontSize: 28, color: "#4b5563" }}>WhatsApp → AI → Listing → Customer → WhatsApp Lead</div>
        </div>
      </div>
    ),
    size,
  );
}
