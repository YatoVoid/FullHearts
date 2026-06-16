import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://fullhearts.pro";
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

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
  title: "Full Hearts — Find your perfect Minecraft mods",
  description:
    "Answer a few questions and get a personalized, compatible set of Minecraft mods — with a clear reason for every pick. No account needed.",
  openGraph: {
    title: "Full Hearts — Find your perfect Minecraft mods",
    description:
      "Answer a few questions and get a personalized, compatible set of Minecraft mods — with a reason for every pick.",
    type: "website",
    siteName: "Full Hearts"
  },
  twitter: { card: "summary_large_image" }
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
