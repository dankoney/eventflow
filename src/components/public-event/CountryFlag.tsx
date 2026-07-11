"use client";

import "flag-icons/css/flag-icons.min.css";

import { cn } from "@/lib/utils";

type Props = {
  /** ISO 3166-1 alpha-2 country code */
  code: string;
  className?: string;
  title?: string;
};

export function CountryFlag({ code, className, title }: Props) {
  const iso = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) {
    return (
      <span
        className={cn(
          "inline-flex h-5 w-7 shrink-0 items-center justify-center rounded bg-zinc-200 text-[9px] font-bold uppercase text-zinc-500",
          className
        )}
        title={title}
        aria-hidden
      >
        {code.slice(0, 2).toUpperCase() || "?"}
      </span>
    );
  }

  return (
    <span
      className={cn("fi", `fi-${iso}`, "inline-block h-5 w-7 shrink-0 rounded shadow-sm", className)}
      title={title}
      role="img"
      aria-label={title ? `${title} flag` : `${iso.toUpperCase()} flag`}
    />
  );
}
