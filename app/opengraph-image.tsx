import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/config/site";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#111827";
const BLUE = "#2F80ED";

export default async function OpengraphImage() {
  // Google Sans subsets (printable ASCII + ₹·→—) with GSUB removed: Satori cannot parse its extension lookups.
  const [semibold, medium, mark] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/GoogleSans-SemiBold.ttf")),
    readFile(join(process.cwd(), "assets/fonts/GoogleSans-Medium.ttf")),
    readFile(join(process.cwd(), "public/brand/propsora-mark.svg")),
  ]);
  const markSrc = `data:image/svg+xml;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(160deg, #ffffff 0%, #F5F8FF 100%)", fontFamily: "Google Sans", color: INK }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 22 }}>
          <img src={markSrc} width={111} height={50} alt="" />
          <div style={{ fontSize: 58, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1, marginBottom: -4 }}>{siteConfig.name.toLowerCase()}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: BLUE, background: "#EAF2FE", borderRadius: 999, padding: "8px 20px" }}>{siteConfig.positioning}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 78, fontWeight: 600, lineHeight: 1.06, letterSpacing: -2.5 }}>
            <div style={{ display: "flex" }}>Launch your property website</div>
            <div style={{ display: "flex", color: BLUE }}>in minutes.</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26, fontWeight: 500, color: "#4B5563" }}>
          <div style={{ display: "flex" }}>WhatsApp → AI → Listing → Customer → Lead</div>
          <div style={{ display: "flex", color: INK }}>{siteConfig.domain}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Google Sans", data: semibold, weight: 600, style: "normal" },
        { name: "Google Sans", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
