import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const runtime = "edge";
export const alt = site.titleDefault;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(1200px 700px at 78% 22%, rgba(201,162,75,0.20), transparent 60%), radial-gradient(1100px 800px at 18% 85%, rgba(20,140,107,0.28), transparent 60%), linear-gradient(135deg,#0a0e12,#11202a 55%,#0a0e12)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 999,
            background: "linear-gradient(135deg,#14a37f,#0d7a5f)",
            fontSize: 70,
            marginBottom: 28,
          }}
        >
          🦷
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: "#27d27e", letterSpacing: 2, textTransform: "uppercase" }}>
          {site.shortName}
        </div>
        <div style={{ fontSize: 66, fontWeight: 800, marginTop: 10, textAlign: "center" }}>
          Your Confident Smile Starts Here
        </div>
        <div style={{ fontSize: 30, color: "#9fb6b0", marginTop: 22 }}>
          Cosmetic Dentistry · Veneers · Implants · Smile Makeovers
        </div>
        <div style={{ fontSize: 26, color: "#cfe1db", marginTop: 28 }}>
          {site.phoneDisplay}
        </div>
      </div>
    ),
    { ...size }
  );
}
