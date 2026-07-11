import { Sora } from "next/font/google";
import type { ReactNode } from "react";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-booth"
});

export default function CheckInBoothLayout({ children }: { children: ReactNode }) {
  return <div className={`${sora.className} min-h-screen antialiased`}>{children}</div>;
}
