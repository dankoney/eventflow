import { cn } from "@/lib/utils";

type Props = {
  title: string | null;
  className?: string;
  centered?: boolean;
  /** Highlight the last word in primary color (contact section style). */
  accentLastWord?: boolean;
};

export function TechnexusSectionTitle({
  title,
  className,
  centered = false,
  accentLastWord = false
}: Props) {
  if (!title?.trim()) return null;

  const words = title.trim().split(/\s+/);
  const showAccent = accentLastWord && words.length > 1;

  return (
    <h2
      className={cn(
        "tn-heading text-3xl md:text-5xl",
        centered ? "mb-4 text-center" : "mb-6",
        className
      )}
    >
      {showAccent ? (
        <>
          {words.slice(0, -1).join(" ")}{" "}
          <span className="text-[var(--pe-primary)]">{words[words.length - 1]}</span>
        </>
      ) : (
        title
      )}
    </h2>
  );
}
