import type { MetadataRoute } from "next";

// Web app manifest for Add to Home Screen. Next serves this from /manifest.webmanifest.
// It does not prompt to install and it does not register a service worker.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Who When Where",
    short_name: "WWW",
    description: "Jogos diários de adivinhação sobre pessoas, lugares e tempo.",
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    categories: ["games", "education"],
    background_color: "#040914",
    theme_color: "#040914",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
