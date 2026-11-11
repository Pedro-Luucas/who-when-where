import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono } from "next/font/google";
import { Toasts } from "@/components/toasts";
import { LangSync } from "@/components/lang-sync";
import { LOCALE_SCRIPT } from "@/lib/i18n";
import { THEME_SCRIPT } from "@/lib/prefs";
import { Celebrations } from "@/logbook/watcher";
import "./globals.css";
import "./social.css";
import "./atlas.css";
import "./logbook.css";
import "./flow.css";

// Only what the pages use: Latin glyphs, upright, with the optical-size axis. The italic
// file and the SOFT/WONK axes cost about 300 KB per page; slanted text is drawn by the browser.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // The site's public address, for the links in what gets shared (SITE_URL when building).
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: {
    default: "Who When Where — daily guessing games",
    template: "%s · Who When Where",
  },
  description:
    "Daily guessing games about people, places and time: famous lives, great journeys, lost cities, borders and the order of history — all played on the map.",
  applicationName: "Who When Where",
  appleWebApp: { capable: true, title: "Who When Where", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0e8d6" },
    { media: "(prefers-color-scheme: dark)", color: "#11151b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script in <head> sets `data-theme` and LocaleToggle sets `lang` on
    // the client, to match the player's choices: hence suppressHydrationWarning.
    <html lang="pt-BR" className={`${fraunces.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <LangSync />
        <Toasts />
        <Celebrations />
      </body>
    </html>
  );
}
