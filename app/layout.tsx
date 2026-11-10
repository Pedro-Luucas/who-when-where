import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./social.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["SOFT", "WONK", "opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Who When Where — daily guessing games",
    template: "%s · Who When Where",
  },
  description:
    "Daily guessing games about people, places and time: famous lives, great journeys, lost cities and the order of history — all played on the map.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0e8d6" },
    { media: "(prefers-color-scheme: dark)", color: "#11151b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // LocaleToggle sets `lang` on the client to match the player's language.
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
