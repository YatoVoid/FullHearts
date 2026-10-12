import localFont from "next/font/local";
import "./server.css";

const fraunces = localFont({
  src: "./fonts/Fraunces.var.woff2",
  weight: "100 900",
  variable: "--font-fraunces",
  display: "swap"
});
const nunito = localFont({
  src: "./fonts/NunitoSans.var.woff2",
  weight: "200 900",
  variable: "--font-nunito",
  display: "swap"
});

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  return <div className={`edu ${fraunces.variable} ${nunito.variable}`}>{children}</div>;
}
