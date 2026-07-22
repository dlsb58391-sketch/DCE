import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  const icon = site.logo;
  const iconType = icon.endsWith(".png") ? "image/png" : "image/jpeg";
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#0a0e12",
    theme_color: "#0a0e12",
    icons: [
      { src: icon, sizes: "192x192", type: iconType },
      { src: icon, sizes: "512x512", type: iconType },
    ],
  };
}
