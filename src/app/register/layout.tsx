import { Inter, JetBrains_Mono, Manrope, Sora } from "next/font/google";
import type { ReactNode } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-register-body",
  display: "swap"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-register-display",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-register-mono",
  display: "swap"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-tn-display",
  weight: ["600", "700", "800"],
  display: "swap"
});

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${manrope.variable} ${jetbrainsMono.variable} ${sora.variable} scroll-smooth`}
    >
      {children}
    </div>
  );
}
