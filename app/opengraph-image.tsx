import { ImageResponse } from "next/og";

// Generates the social share preview for shared links (e.g. /results).
export const alt = "Full Hearts: a curated, hand-tested Minecraft mod collection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #1a1330 0%, #0a0718 100%)",
          color: "#f4ecd8",
          fontFamily: "sans-serif",
          padding: 80
        }}
      >
        <div style={{ fontSize: 38, letterSpacing: 6, color: "#ffcf4d", marginBottom: 24 }}>
          PERSONALIZED · MINECRAFT JAVA
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 800, letterSpacing: 2 }}>
          FULL
          <span style={{ color: "#7bd64b" }}>HEARTS</span>
        </div>
        <div style={{ fontSize: 40, color: "#b9a8d8", marginTop: 28, textAlign: "center", maxWidth: 900 }}>
          Hand-tested Minecraft mods you can&apos;t go wrong with.
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ width: 40, height: 40, background: "#e0314b", borderRadius: 6 }} />
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
