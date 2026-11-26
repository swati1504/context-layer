import { ImageResponse } from "next/og";

export async function GET(req: Request) {
  const t = (new URL(req.url).searchParams.get("t") ?? "Understand the story, not just the headline").slice(0, 140);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#f7f4ee", padding: 80, color: "#1f1b16" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#1f1b16", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 9 }}>
            <div style={{ width: 24, height: 8, background: "#f3d95c" }} />
          </div>
          Context Layer
        </div>
        <div style={{ display: "flex", fontSize: t.length > 80 ? 54 : 66, lineHeight: 1.12, fontFamily: "Georgia, serif", maxWidth: 1000 }}>{t}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#5e554a" }}>Every claim links to the passage it came from.</div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
