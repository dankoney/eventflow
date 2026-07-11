type FeedbackPageHeaderProps = {
  orgName: string;
  logoUrl: string | null;
  accent: string;
  eventDateLabel: string;
};

export function FeedbackPageHeader({ orgName, logoUrl, accent, eventDateLabel }: FeedbackPageHeaderProps) {
  return (
    <header className="mb-6 text-center">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="mx-auto h-12 w-12 rounded-xl object-cover" />
      ) : (
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
          style={{ backgroundColor: accent }}
        >
          {orgName.slice(0, 1)}
        </div>
      )}
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-zinc-500">{orgName}</p>
      <p className="mt-1 text-sm text-zinc-600">{eventDateLabel}</p>
    </header>
  );
}
