"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ImageUrlField } from "@/components/events/public-event-editor/ImageUrlField";
import { Button } from "@/components/ui/Button";
import { parseBackgroundVideoUrls } from "@/lib/public-event/youtubeEmbed";
import {
  appendSpotlightVideoLine,
  describeSpotlightLine,
  moveSpotlightVideoLine,
  removeSpotlightVideoLineAt,
  syncYoutubeLinesInPlaylist,
  youtubeLinesFromPlaylist
} from "@/lib/public-event/spotlightPlaylist";

const areaClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10";

type Props = {
  value: string | null | undefined;
  disabled?: boolean;
  uploadBusy?: boolean;
  onChange: (next: string | null) => void;
  onUpload: (file: File) => Promise<string | null>;
};

export function SpotlightVideoPlaylistEditor({
  value,
  disabled,
  uploadBusy,
  onChange,
  onUpload
}: Props) {
  const lines = parseBackgroundVideoUrls(value);
  const youtubeFocusedRef = useRef(false);
  const [youtubeDraft, setYoutubeDraft] = useState(() => youtubeLinesFromPlaylist(value));

  useEffect(() => {
    if (!youtubeFocusedRef.current) {
      setYoutubeDraft(youtubeLinesFromPlaylist(value));
    }
  }, [value]);

  function setLines(next: string) {
    onChange(next.trim() ? next : null);
  }

  function commitYoutubeDraft(draft: string) {
    const synced = syncYoutubeLinesInPlaylist(value, draft);
    setLines(synced);
    setYoutubeDraft(youtubeLinesFromPlaylist(synced || null));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-semibold text-zinc-600">YouTube URLs</p>
        <p className="mb-2 text-xs text-zinc-500">
          One link per line. YouTube-only, self-hosted only, or mixed — use play order below to set the sequence.
        </p>
        <textarea
          rows={3}
          className={areaClass}
          placeholder="https://www.youtube.com/watch?v=…"
          value={youtubeDraft}
          disabled={disabled}
          onFocus={() => {
            youtubeFocusedRef.current = true;
          }}
          onBlur={() => {
            youtubeFocusedRef.current = false;
            commitYoutubeDraft(youtubeDraft);
          }}
          onChange={(e) => {
            const draft = e.target.value;
            setYoutubeDraft(draft);
            const synced = syncYoutubeLinesInPlaylist(value, draft);
            onChange(synced.trim() ? synced : null);
          }}
        />
      </div>

      <ImageUrlField
        label="Self-hosted video"
        hint="Upload or pick from your library. Select multiple items in the library, then click Add selected. For faster loads, prefer 720p MP4 under ~15 MB."
        libraryFilter="video"
        libraryMultiple
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
        placeholder="Upload or choose from library"
        value=""
        disabled={disabled}
        uploadBusy={uploadBusy}
        onLibrarySelectMany={(assets) => {
          let next = value ?? "";
          for (const asset of assets) {
            next = appendSpotlightVideoLine(next, asset.publicUrl);
          }
          setLines(next);
        }}
        onChange={(url) => {
          if (!url.trim()) return;
          setLines(appendSpotlightVideoLine(value, url));
        }}
        onUpload={onUpload}
      />

      {lines.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-zinc-600">Play order</p>
          <ul className="space-y-2">
            {lines.map((line, index) => {
              const { kind, label } = describeSpotlightLine(line);
              return (
                <li
                  key={`${index}-${line}`}
                  className="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2"
                >
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-bold text-zinc-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
                    <p className="truncate text-xs text-zinc-800">{line}</p>
                    {kind === "direct" ? (
                      <video
                        src={line}
                        className="mt-2 max-h-24 w-full rounded border border-zinc-200 object-contain"
                        muted
                        playsInline
                        controls
                        preload="metadata"
                      />
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 w-8 border-zinc-200 p-0"
                      disabled={disabled || index === 0}
                      title="Move up"
                      onClick={() => setLines(moveSpotlightVideoLine(value, index, -1))}
                    >
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 w-8 border-zinc-200 p-0"
                      disabled={disabled || index === lines.length - 1}
                      title="Move down"
                      onClick={() => setLines(moveSpotlightVideoLine(value, index, 1))}
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-8 w-8 border-zinc-200 p-0 text-red-600"
                      disabled={disabled}
                      title="Remove"
                      onClick={() => setLines(removeSpotlightVideoLineAt(value, index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
