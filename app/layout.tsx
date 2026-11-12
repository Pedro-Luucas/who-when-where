import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import { ProSheetHost } from "@/components/pro/pro-sheet";
import { ThemeSync } from "@/components/settings-button";
import { BottomNav } from "@/components/shell/bottom-nav";
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
import "./shell.css";
import "./play.css";
import "./engines.css";
import "./lightbox.css";
import "./connect.css";
import "./pro.css";
// The phone UI, last so it wins: everything in it sits behind a phone breakpoint.
import "./mobile.css";

// Night Atlas type (see app/tokens.css): Chakra Petch for the interface,
// Bricolage Grotesque for headings, JetBrains Mono for labels and numbers.
// Latin only, upright only, no unused axes.
const chakra = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
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
  appleWebApp: { capable: true, title: "Who When Where", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  // Night Atlas is the default theme; the bar matches its page colour.
  themeColor: "#040914",
  // Draw under the notch and the home indicator; the shell pads itself with
  // env(safe-area-inset-*) (app/mobile.css).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The script in <head> sets `data-theme` and LocaleToggle sets `lang` on
    // the client, to match the player's choices: hence suppressHydrationWarning.
    <html lang="pt-BR" className={`${chakra.variable} ${bricolage.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <BottomNav />
        <LangSync />
        <ThemeSync />
        <Toasts />
        <Celebrations />
        <ProSheetHost />
      </body>
    </html>
  );
}
