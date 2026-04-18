import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { CheckinPwaRegister } from "@/components/checkin/CheckinPwaRegister";

export const metadata: Metadata = {
  appleWebApp: { capable: true, title: "Eventflow check-in" }
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function EventCheckInLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <CheckinPwaRegister />
      {children}
    </>
  );
}
