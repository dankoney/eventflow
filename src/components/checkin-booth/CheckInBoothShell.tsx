import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CheckInBoothShellProps = {
  children: ReactNode;
  /** Lock layout to viewport (walk-in / QR scan without page scroll). */
  fitViewport?: boolean;
  /** Extra width for full-screen QR scanner. */
  wide?: boolean;
};

/** Full-screen kiosk canvas with soft brand backdrop. */
export function CheckInBoothShell({ children, fitViewport, wide }: CheckInBoothShellProps) {
  return (
    <main
      className={cn(
        "relative flex flex-col items-center bg-[#f9f9ff] px-4 text-[#151c27] sm:px-6",
        fitViewport
          ? "h-[100dvh] max-h-[100dvh] min-h-0 justify-center overflow-hidden py-3"
          : "min-h-screen justify-start overflow-x-hidden overflow-y-auto py-8 sm:py-10 md:justify-center"
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute left-[-10%] top-[-20%] h-[70%] w-[60%] rounded-full bg-[#e7eefe] opacity-60 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[60%] w-[50%] rounded-full bg-[#dde1ff] opacity-40 blur-[120px]" />
      </div>
      <div
        className={cn(
          "relative z-10 w-full",
          wide ? "max-w-5xl" : "max-w-7xl",
          fitViewport && "flex h-full min-h-0 max-h-full flex-col justify-center"
        )}
      >
        {children}
      </div>
    </main>
  );
}
