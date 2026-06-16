import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Full Hearts",
    short_name: "Full Hearts",
    description: "Find your perfect Minecraft mods — with a reason for every pick.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0718",
    theme_color: "#0a0718",
    icons: [
      { src: "/heart.png", sizes: "any", type: "image/png", purpose: "any" }
    ]
  };
}
