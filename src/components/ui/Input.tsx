import { forwardRef, InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 transition focus:ring-2",
        className
      )}
      {...props}
    />
  );
});
