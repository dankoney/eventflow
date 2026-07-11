"use client";

import { useState, useTransition } from "react";

import { downloadBillingReceiptPdfAction } from "@/lib/actions/billing.actions";
import { Button } from "@/components/ui/Button";

type BillingReceiptDownloadButtonProps = {
  invoiceId: string;
  disabled?: boolean;
  className?: string;
};

function downloadBase64Pdf(base64: string, filename: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function BillingReceiptDownloadButton({
  invoiceId,
  disabled,
  className
}: BillingReceiptDownloadButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || pending}
        className="!px-2.5 !py-1 text-xs"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await downloadBillingReceiptPdfAction(invoiceId);
            if (!res.success || !res.data) {
              setError(res.error ?? "Download failed.");
              return;
            }
            downloadBase64Pdf(res.data.pdfBase64, res.data.filename);
          });
        }}
      >
        {pending ? "…" : "Download"}
      </Button>
      {error ? <p className="mt-1 text-[11px] text-rose-700">{error}</p> : null}
    </div>
  );
}
