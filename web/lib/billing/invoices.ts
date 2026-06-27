import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";

export type InvoiceRow = {
  id: string;
  number: string | null;
  created: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  status: Stripe.Invoice.Status | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: number;
  periodEnd: number;
};

export async function listStripeInvoices(stripeCustomerId: string, limit = 24): Promise<InvoiceRow[]> {
  const stripe = getStripe();
  if (!stripe) return [];

  try {
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit,
      expand: ["data.subscription"],
    });
    return invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      created: inv.created,
      amountPaid: inv.amount_paid,
      amountDue: inv.amount_due,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
      periodStart: inv.period_start,
      periodEnd: inv.period_end,
    }));
  } catch {
    return [];
  }
}

/** Preview rows for super admins without a Stripe customer. */
export function mockInvoicePreview(): InvoiceRow[] {
  const now = Math.floor(Date.now() / 1000);
  const month = 30 * 24 * 60 * 60;
  return [
    {
      id: "mock_inv_1",
      number: "INV-0002",
      created: now - month,
      amountPaid: 2900,
      amountDue: 2900,
      currency: "usd",
      status: "paid",
      hostedInvoiceUrl: null,
      invoicePdf: null,
      periodStart: now - month * 2,
      periodEnd: now - month,
    },
    {
      id: "mock_inv_2",
      number: "INV-0001",
      created: now - month * 2,
      amountPaid: 0,
      amountDue: 0,
      currency: "usd",
      status: "paid",
      hostedInvoiceUrl: null,
      invoicePdf: null,
      periodStart: now - month * 3,
      periodEnd: now - month * 2,
    },
  ];
}

export function formatInvoiceCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function formatInvoiceDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
