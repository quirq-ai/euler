import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { PROJECT_ROOT } from "@/lib/project-root";

// The home-screen icon: the favicon's aurora disc on warm paper, since iOS wants an
// opaque square.

export const size = { width: 180, height: 180 };
export default function AppleIcon() {
  const svg = fs.readFileSync(path.join(PROJECT_ROOT, "app", "icon.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f5f0" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
