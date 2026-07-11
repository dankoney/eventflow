import { prisma } from "@/lib/prisma";

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function nestedString(data: Record<string, unknown>, ...paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    const value = asString(current);
    if (value) return value;
  }
  return null;
}

/**
 * Best-effort org resolution from a Paystack webhook payload for audit indexing.
 */
export async function resolveOrgIdFromPaystackPayload(
  data: Record<string, unknown> | undefined
): Promise<string | null> {
  if (!data) return null;

  const metadataOrgId = nestedString(data, "metadata.orgId", "metadata.org_id", "metadata.eventflow_org_id");
  if (metadataOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: metadataOrgId },
      select: { id: true }
    });
    if (org) return org.id;
  }

  const requestCode = nestedString(data, "request_code", "metadata.request_code");
  if (requestCode?.startsWith("PRQ_")) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { paystackPaymentRequestCode: requestCode },
      select: { orgId: true }
    });
    if (invoice) return invoice.orgId;
  }

  const eventflowInvoiceId = nestedString(
    data,
    "metadata.eventflow_invoice_id",
    "metadata.eventflowInvoiceId"
  );
  if (eventflowInvoiceId) {
    const invoice = await prisma.billingInvoice.findUnique({
      where: { id: eventflowInvoiceId },
      select: { orgId: true }
    });
    if (invoice) return invoice.orgId;
  }

  const customerCode = nestedString(
    data,
    "customer.customer_code",
    "customer_code",
    "authorization.customer_code"
  );
  if (customerCode) {
    const customer = await prisma.billingCustomer.findUnique({
      where: { paystackCustomerCode: customerCode },
      select: { orgId: true }
    });
    if (customer) return customer.orgId;
  }

  const subscriptionCode = nestedString(data, "subscription_code", "code", "subscription.code");
  if (subscriptionCode) {
    const subscription = await prisma.subscription.findUnique({
      where: { paystackSubscriptionCode: subscriptionCode },
      select: { orgId: true }
    });
    if (subscription) return subscription.orgId;
  }

  return null;
}

export function buildPaystackEventId(eventType: string, data: Record<string, unknown> | undefined): string {
  const rawId =
    data?.id ??
    data?.request_code ??
    data?.reference ??
    data?.subscription_code ??
    data?.invoice_code ??
    data?.customer_code;
  if (rawId !== undefined && rawId !== null) {
    return `${eventType}:${String(rawId)}`;
  }
  return `${eventType}:${Date.now()}`;
}
