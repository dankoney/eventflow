import { cn } from "@/lib/utils";

type Props = {
  children: string;
  variant?: "professional-light" | "night-edition" | "summit-dark";
  className?: string;
};

/** Soft callout for registration / confirmation copy (not a loud marketing banner). */
export function PublicRegistrationNote({ children, variant = "professional-light", className }: Props) {
  const dark = variant === "night-edition" || variant === "summit-dark";

  return (
    <aside
      role="note"
      className={cn(
        "rounded-xl border p-5 shadow-sm",
        dark
          ? "border-white/10 bg-zinc-900/50"
          : "border-sky-200/80 bg-gradient-to-br from-sky-50/90 to-white",
        className
      )}
    >
      <p
        className={cn(
          "text-sm leading-relaxed",
          dark ? "text-zinc-300" : "text-sky-950/90"
        )}
      >
        {children}
      </p>
    </aside>
  );
}
