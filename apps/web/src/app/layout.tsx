import type { Metadata } from "next";
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
  title: "Greecon Platform",
  description: "Operational platform foundation for Greecon Sh.p.k.",
  icons: {
    icon: `${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plexSerif.variable}>
      <body>{children}</body>
    </html>
  );
}
