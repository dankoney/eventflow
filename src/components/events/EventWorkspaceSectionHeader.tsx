type EventWorkspaceSectionHeaderProps = {
  kicker: string;
  title: string;
  description: string;
};

export function EventWorkspaceSectionHeader({
  kicker,
  title,
  description
}: EventWorkspaceSectionHeaderProps) {
  return (
    <header className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">{kicker}</p>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">{description}</p>
    </header>
  );
}
