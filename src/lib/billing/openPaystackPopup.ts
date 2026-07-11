"use client";

type PaystackSuccess = {
  reference?: string;
  message?: string;
};

type PaystackPopInstance = {
  resumeTransaction: (
    accessCode: string,
    callbacks?: {
      onSuccess?: (transaction: PaystackSuccess) => void;
      onCancel?: () => void;
      onError?: (error: { message?: string }) => void;
    }
  ) => void;
};

type PaystackPopConstructor = new () => PaystackPopInstance;

declare global {
  interface Window {
    PaystackPop?: PaystackPopConstructor;
  }
}

const INLINE_SCRIPT_SRC = "https://js.paystack.co/v2/inline.js";

let scriptPromise: Promise<PaystackPopConstructor> | null = null;

function loadPaystackPop(): Promise<PaystackPopConstructor> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Paystack popup is only available in the browser."));
  }
  if (window.PaystackPop) {
    return Promise.resolve(window.PaystackPop);
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${INLINE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.PaystackPop) resolve(window.PaystackPop);
        else reject(new Error("Paystack failed to load."));
      });
      existing.addEventListener("error", () => reject(new Error("Paystack failed to load.")));
      return;
    }

    const script = document.createElement("script");
    script.src = INLINE_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) resolve(window.PaystackPop);
      else reject(new Error("Paystack failed to load."));
    };
    script.onerror = () => reject(new Error("Paystack failed to load."));
    document.body.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Open Paystack Inline popup for a server-initialized transaction (access_code).
 * Does not leave the current page.
 */
export async function openPaystackPopup(input: {
  accessCode: string;
  onSuccess?: (reference: string) => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
}): Promise<void> {
  const PaystackPop = await loadPaystackPop();
  const popup = new PaystackPop();
  popup.resumeTransaction(input.accessCode, {
    onSuccess: (transaction) => {
      const reference = transaction.reference?.trim();
      if (reference) input.onSuccess?.(reference);
    },
    onCancel: () => input.onCancel?.(),
    onError: (error) => input.onError?.(error.message?.trim() || "Paystack checkout failed.")
  });
}
