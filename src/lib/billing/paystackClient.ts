import "server-only";

import { DEFAULT_BILLING_CURRENCY } from "@/lib/billing/constants";

const PAYSTACK_API_BASE = "https://api.paystack.co";

export class PaystackApiError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = "PaystackApiError";
  }
}

function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) {
    throw new PaystackApiError("PAYSTACK_SECRET_KEY is not configured.");
  }
  return key;
}

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

async function paystackRequest<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getPaystackSecretKey()}`);
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${PAYSTACK_API_BASE}${path}`, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body
  });

  let parsed: PaystackResponse<T> | null = null;
  try {
    parsed = (await response.json()) as PaystackResponse<T>;
  } catch {
    parsed = null;
  }

  if (!response.ok || !parsed?.status) {
    throw new PaystackApiError(
      parsed?.message ?? `Paystack request failed (${response.status}).`,
      response.status,
      parsed
    );
  }

  return parsed.data;
}

/** Channels shown on Paystack Hosted Checkout (GHS). */
export const PAYSTACK_CHECKOUT_CHANNELS = [
  "card",
  "mobile_money",
  "bank_transfer",
  "ussd"
] as const;

export type PaystackInitializeTransactionInput = {
  email: string;
  amountPesewas: number;
  currency?: string;
  planCode?: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
  /** Defaults to card + mobile_money + bank_transfer + ussd. */
  channels?: string[];
};

export type PaystackInitializeTransactionData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initializePaystackTransaction(
  input: PaystackInitializeTransactionInput
): Promise<PaystackInitializeTransactionData> {
  return paystackRequest<PaystackInitializeTransactionData>("/transaction/initialize", {
    method: "POST",
    json: {
      email: input.email,
      amount: input.amountPesewas,
      currency: input.currency ?? DEFAULT_BILLING_CURRENCY,
      plan: input.planCode,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
      channels: input.channels ?? [...PAYSTACK_CHECKOUT_CHANNELS]
    }
  });
}

export type PaystackChargeAuthorizationInput = {
  authorizationCode: string;
  email: string;
  amountPesewas: number;
  currency?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export type PaystackChargeAuthorizationData = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
};

export async function chargePaystackAuthorization(
  input: PaystackChargeAuthorizationInput
): Promise<PaystackChargeAuthorizationData> {
  return paystackRequest<PaystackChargeAuthorizationData>("/transaction/charge_authorization", {
    method: "POST",
    json: {
      authorization_code: input.authorizationCode,
      email: input.email,
      amount: input.amountPesewas,
      currency: input.currency ?? DEFAULT_BILLING_CURRENCY,
      reference: input.reference,
      metadata: input.metadata
    }
  });
}

export type PaystackVerifyTransactionData = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  gateway_response?: string;
  paid_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackVerifyTransactionData> {
  return paystackRequest<PaystackVerifyTransactionData>(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );
}

export type PaystackCustomerData = {
  customer_code: string;
  email: string;
  id: number;
};

export async function createPaystackCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackCustomerData> {
  return paystackRequest<PaystackCustomerData>("/customer", {
    method: "POST",
    json: {
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      metadata: input.metadata
    }
  });
}

export type PaystackSubscriptionData = {
  subscription_code: string;
  status: string;
  amount: number;
  next_payment_date: string;
  email_token: string;
  plan: { plan_code: string; name: string };
  customer: { customer_code: string; email: string };
};

export async function fetchPaystackSubscription(
  subscriptionCode: string
): Promise<PaystackSubscriptionData> {
  return paystackRequest<PaystackSubscriptionData>(`/subscription/${encodeURIComponent(subscriptionCode)}`);
}

export type PaystackPlanData = {
  plan_code: string;
  name: string;
  amount: number;
  interval: string;
  currency: string;
};

export async function fetchPaystackPlan(planCode: string): Promise<PaystackPlanData> {
  return paystackRequest<PaystackPlanData>(`/plan/${encodeURIComponent(planCode)}`);
}

export async function disablePaystackSubscription(input: {
  subscriptionCode: string;
  emailToken: string;
}): Promise<unknown> {
  return paystackRequest("/subscription/disable", {
    method: "POST",
    json: {
      code: input.subscriptionCode,
      token: input.emailToken
    }
  });
}

export async function enablePaystackSubscription(input: {
  subscriptionCode: string;
  emailToken: string;
}): Promise<unknown> {
  return paystackRequest("/subscription/enable", {
    method: "POST",
    json: {
      code: input.subscriptionCode,
      token: input.emailToken
    }
  });
}

export type PaystackCreateSubscriptionInput = {
  customerCode: string;
  planCode: string;
  authorizationCode: string;
  /** ISO 8601 — first debit date; omit only when charging immediately is intended. */
  startDate?: string;
};

export type PaystackCreateSubscriptionData = {
  subscription_code: string;
  email_token: string;
  status: string;
  next_payment_date?: string;
  amount: number;
};

/**
 * Create a subscription against a stored authorization.
 * Pass `startDate` in the future to schedule the first debit (no charge now).
 */
export async function createPaystackSubscription(
  input: PaystackCreateSubscriptionInput
): Promise<PaystackCreateSubscriptionData> {
  return paystackRequest<PaystackCreateSubscriptionData>("/subscription", {
    method: "POST",
    json: {
      customer: input.customerCode,
      plan: input.planCode,
      authorization: input.authorizationCode,
      start_date: input.startDate
    }
  });
}

export type PaystackPaymentRequestLineItem = {
  name: string;
  amount: number;
  quantity?: number;
};

export type PaystackPaymentRequestTax = {
  name: string;
  amount: number;
};

export type CreatePaystackPaymentRequestInput = {
  customerCode: string;
  currency?: string;
  dueDate?: string;
  description?: string;
  lineItems: PaystackPaymentRequestLineItem[];
  tax?: PaystackPaymentRequestTax[];
  sendNotification?: boolean;
  metadata?: Record<string, unknown>;
};

export type PaystackPaymentRequestData = {
  id: number;
  request_code: string;
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  due_date?: string | null;
  description?: string | null;
  invoice_number?: number | null;
  line_items?: PaystackPaymentRequestLineItem[];
  tax?: PaystackPaymentRequestTax[];
  paid_at?: string | null;
};

/**
 * Hosted Paystack invoice page for a Payment Request code.
 * Verified against live create+fetch: API responses do not return a URL field;
 * Paystack hosts the payable invoice at https://paystack.com/pay/{request_code}
 * (confirmed: loads "Invoice from …" with Pay now — not pay.paystack.com).
 */
export function paystackPaymentRequestPageUrl(requestCode: string): string {
  return `https://paystack.com/pay/${encodeURIComponent(requestCode)}`;
}

/**
 * Create a one-off Payment Request (invoice). Separate from Subscriptions API.
 * Docs: POST /paymentrequest — customer must be customer_code or id.
 */
export async function createPaystackPaymentRequest(
  input: CreatePaystackPaymentRequestInput
): Promise<PaystackPaymentRequestData> {
  return paystackRequest<PaystackPaymentRequestData>("/paymentrequest", {
    method: "POST",
    json: {
      customer: input.customerCode,
      currency: input.currency ?? DEFAULT_BILLING_CURRENCY,
      due_date: input.dueDate,
      description: input.description,
      line_items: input.lineItems,
      tax: input.tax?.length ? input.tax : undefined,
      send_notification: input.sendNotification ?? false,
      metadata: input.metadata
    }
  });
}

/** Archive (cancel) a pending Payment Request so it can no longer be paid. */
export async function archivePaystackPaymentRequest(
  idOrCode: string
): Promise<void> {
  await paystackRequest<unknown>(
    `/paymentrequest/archive/${encodeURIComponent(idOrCode)}`,
    { method: "POST", json: {} }
  );
}

