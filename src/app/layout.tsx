import type { Metadata } from "next";
import { ReactNode } from "react";

import { resolvePublicAppBaseUrl } from "@/lib/url";

import { Providers } from "./providers";

import "./globals.css";

const metadataBase = (() => {
  const b = resolvePublicAppBaseUrl();
  try {
    return b ? new URL(b) : undefined;
  } catch {
    return undefined;
  }
})();

export const metadata: Metadata = {
  metadataBase,
  title: "Eventflow",
  description: "B2B event attendance platform",
  openGraph: {
    locale: "en_US"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
