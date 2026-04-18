import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  title: string;
  onClose?: () => void;
  children: ReactNode;
};

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={cn("w-full max-w-lg rounded-lg bg-white p-5 shadow-lg")}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-sm text-slate-600">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
