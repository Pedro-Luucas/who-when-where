import type { MetadataRoute } from "next";

// Lets a phone or a desktop browser install the site as an app. The icons
// are drawn by scripts/build-images.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Who When Where",
    short_name: "Who When Where",
    description: "Daily guessing games about people, places and time, all played on the map.",
    start_url: "/",
    display: "standalone",
    background_color: "#040914",
    theme_color: "#040914",
    categories: ["games", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
