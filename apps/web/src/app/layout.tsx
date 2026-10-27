import type { Metadata, Viewport } from "next";
import { IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

// The one typeface in the Greecon brand (docs/06-frontend-design-system.md) — the CSS already
// named "IBM Plex Serif" as the font-family, but nothing ever actually loaded it, so every page
// had silently been rendering in the browser's default serif (Georgia/Times) instead of the real
// brand typeface the whole time. next/font self-hosts the files at build time (no runtime request
// to Google Fonts, no layout shift waiting on a web font to arrive).
const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-serif",
  display: "swap"
});

export const metadata: Metadata = {
  // Each page names itself ("Alerts · Greecon"), so a tab, a bookmark and a screen reader's page title say where the person is.
  title: { default: "Greecon Platform", template: "%s · Greecon" },
  description: "Operational platform foundation for Greecon Sh.p.k.",
  // A private platform and a demo, not a page to be found by search: the sales material is where people are sent.
  robots: { index: false, follow: false },
  icons: {
    icon: `${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`,
    apple: `${process.env.NEXT_BASE_PATH ?? ""}/apple-touch-icon.png`
  },
  appleWebApp: { capable: true, title: "Greecon", statusBarStyle: "default" }
};

// The browser's own bar follows the page: cream in the light, the page's own dark green in the dark (docs/29-apple-notion-standards.md). The
// page also says at once that it has both, so nothing flashes white before the stylesheet arrives.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#131916" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plexSerif.variable}>
      <body>{children}</body>
    </html>
  );
}
