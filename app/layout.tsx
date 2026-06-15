import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";
import "./globals.css";

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
  title: "Full Hearts — Find your perfect Minecraft mods",
  description:
    "Answer a few questions and get a personalized, compatible set of Minecraft mods — with a clear reason for every pick. No account needed."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${pressStart.variable}`}>
      <body>{children}</body>
    </html>
  );
}
