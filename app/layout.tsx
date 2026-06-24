import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.app";
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-8767210732134186";
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION;

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter"
});

const pressStart = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start"
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Full Hearts: a Minecraft modpack that just launches",
  description:
    "Pick the Minecraft mods you want and Full Hearts pulls in every dependency, version matches them to your loader, and checks they run together, then exports one .mrpack you import and launch. No account needed.",
  keywords: [
    "Minecraft mods", "best Minecraft mods", "Minecraft modpack maker", "mrpack",
    "Fabric mods", "Forge mods", "mod dependency resolver", "Minecraft Java mods", "compatible modpack"
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Full Hearts: a Minecraft modpack that just launches",
    description:
      "Pick the mods you want. Full Hearts pulls in dependencies, version matches them, and checks they run together, then exports one .mrpack you import and launch.",
    url: "/",
    type: "website",
    siteName: "Full Hearts"
  },
  twitter: { card: "summary_large_image" },
  ...(GOOGLE_VERIFICATION ? { verification: { google: GOOGLE_VERIFICATION } } : {})
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pressStart.variable}`}>
      <body>{children}</body>
      {ADSENSE_CLIENT && (
        <Script
          async
          strategy="afterInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      )}
    </html>
  );
}
