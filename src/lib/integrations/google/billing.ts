import {
  getGoogleAccessToken,
  getGoogleAdsDeveloperToken,
  getGoogleAdsLoginCustomerId,
} from "@/lib/integrations/tokens";

const ADS_API = "https://googleads.googleapis.com/v25";

export type GoogleBillingCharge = {
  externalId: string;
  amount: number;
  currency: string;
  chargedAt: Date;
  status: "paid";
  invoiceNumber: string | null;
  billingSetupId: string;
  issueYear: number;
  issueMonth: string;
};

export type GoogleBillingResult = {
  /** monthly_invoicing = InvoiceService; unsupported = automatic payments (no API) */
  mode: "monthly_invoicing" | "unsupported" | "no_billing_setup";
  charges: GoogleBillingCharge[];
  detail?: string;
};

type AdsErrorJson = {
  error?: {
    message?: string;
    details?: Array<{
      errors?: Array<{
        errorCode?: Record<string, string>;
        message?: string;
      }>;
    }>;
  };
};

const MONTHS = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
] as const;

function microsToAmount(micros: string | number | undefined): number {
  const n = typeof micros === "string" ? Number(micros) : Number(micros ?? 0);
  return Number.isFinite(n) ? n / 1_000_000 : 0;
}

function monthKeysBetween(fromYmd: string, toYmd: string): Array<{
  year: number;
  month: (typeof MONTHS)[number];
}> {
  const [fy, fm] = fromYmd.split("-").map(Number);
  const [ty, tm] = toYmd.split("-").map(Number);
  const out: Array<{ year: number; month: (typeof MONTHS)[number] }> = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push({ year: y, month: MONTHS[m - 1]! });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

async function adsHeaders(): Promise<Record<string, string>> {
  const accessToken = await getGoogleAccessToken();
  return {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": getGoogleAdsDeveloperToken(),
    "login-customer-id": getGoogleAdsLoginCustomerId(),
    "Content-Type": "application/json",
  };
}

async function listBillingSetupIds(customerId: string): Promise<string[]> {
  const headers = await adsHeaders();
  const query = `
    SELECT billing_setup.id, billing_setup.status
    FROM billing_setup
    WHERE billing_setup.status = 'APPROVED'
  `;
  const res = await fetch(
    `${ADS_API}/customers/${customerId}/googleAds:search`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    },
  );
  const json = (await res.json()) as AdsErrorJson & {
    results?: Array<{ billingSetup?: { id?: string } }>;
  };
  if (!res.ok) {
    const detail = json.error?.details?.[0]?.errors?.[0];
    throw new Error(
      detail?.message || json.error?.message || `Billing setup ${res.status}`,
    );
  }
  return (json.results ?? [])
    .map((r) => r.billingSetup?.id)
    .filter((id): id is string => Boolean(id));
}

type InvoiceJson = {
  id?: string;
  type?: string;
  currencyCode?: string;
  issueDate?: string;
  totalAmountMicros?: string;
  pdfUrl?: string;
  paymentsAccountId?: string;
};

/**
 * Successful Google billing documents via InvoiceService (monthly invoicing only).
 * Automatic-payment accounts have no public charge/receipt API — mode=unsupported.
 */
export async function fetchGoogleSuccessfulInvoices(opts: {
  customerId: string;
  from: string;
  to: string;
}): Promise<GoogleBillingResult> {
  const customerId = opts.customerId.replace(/-/g, "");
  const setupIds = await listBillingSetupIds(customerId);
  if (setupIds.length === 0) {
    return { mode: "no_billing_setup", charges: [] };
  }

  const headers = await adsHeaders();
  const months = monthKeysBetween(opts.from, opts.to);
  const charges: GoogleBillingCharge[] = [];
  const seen = new Set<string>();
  let sawUnsupported = false;
  let unsupportedDetail: string | undefined;

  for (const setupId of setupIds) {
    const billingSetup = `customers/${customerId}/billingSetups/${setupId}`;
    for (const { year, month } of months) {
      const url = new URL(
        `${ADS_API}/customers/${customerId}/invoices`,
      );
      url.searchParams.set("billingSetup", billingSetup);
      url.searchParams.set("issueYear", String(year));
      url.searchParams.set("issueMonth", month);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: headers.Authorization!,
          "developer-token": headers["developer-token"]!,
          "login-customer-id": headers["login-customer-id"]!,
        },
      });
      const json = (await res.json()) as AdsErrorJson & {
        invoices?: InvoiceJson[];
      };

      if (!res.ok) {
        const detail = json.error?.details?.[0]?.errors?.[0];
        const code = detail?.errorCode
          ? Object.values(detail.errorCode)[0]
          : "";
        if (
          code === "BILLING_SETUP_NOT_ON_MONTHLY_INVOICING" ||
          /not on monthly invoicing/i.test(detail?.message || "")
        ) {
          sawUnsupported = true;
          unsupportedDetail = detail?.message;
          continue;
        }
        throw new Error(
          detail?.message ||
            json.error?.message ||
            `Google invoices ${res.status}`,
        );
      }

      for (const inv of json.invoices ?? []) {
        // Skip credit memos / debit memos when typed
        const invType = (inv.type || "").toUpperCase();
        if (
          invType.includes("CREDIT") ||
          invType === "CM" ||
          invType.includes("DEBIT")
        ) {
          continue;
        }
        const id = inv.id?.trim();
        if (!id || seen.has(id)) continue;
        const amount = microsToAmount(inv.totalAmountMicros);
        if (amount <= 0) continue;
        const chargedAt = inv.issueDate
          ? new Date(`${inv.issueDate}T12:00:00+03:00`)
          : new Date(`${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-01T12:00:00+03:00`);
        if (Number.isNaN(chargedAt.getTime())) continue;

        seen.add(id);
        charges.push({
          externalId: id,
          amount,
          currency: (inv.currencyCode || "TRY").toUpperCase(),
          chargedAt,
          status: "paid",
          invoiceNumber: id,
          billingSetupId: setupId,
          issueYear: year,
          issueMonth: month,
        });
      }
    }
  }

  if (charges.length === 0 && sawUnsupported) {
    return {
      mode: "unsupported",
      charges: [],
      detail:
        unsupportedDetail ||
        "Google otomatik ödemelerde fatura/makbuz API’si yok (yalnızca aylık faturalama).",
    };
  }

  charges.sort((a, b) => b.chargedAt.getTime() - a.chargedAt.getTime());
  return { mode: "monthly_invoicing", charges };
}

/** Fresh pdf_url for a stored Google invoice (URLs expire / need OAuth). */
export async function fetchGoogleInvoicePdfUrl(opts: {
  customerId: string;
  billingSetupId: string;
  issueYear: number;
  issueMonth: string;
  invoiceId: string;
}): Promise<string | null> {
  const customerId = opts.customerId.replace(/-/g, "");
  const headers = await adsHeaders();
  const billingSetup = opts.billingSetupId.startsWith("customers/")
    ? opts.billingSetupId
    : `customers/${customerId}/billingSetups/${opts.billingSetupId}`;

  const url = new URL(`${ADS_API}/customers/${customerId}/invoices`);
  url.searchParams.set("billingSetup", billingSetup);
  url.searchParams.set("issueYear", String(opts.issueYear));
  url.searchParams.set("issueMonth", opts.issueMonth);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: headers.Authorization!,
      "developer-token": headers["developer-token"]!,
      "login-customer-id": headers["login-customer-id"]!,
    },
  });
  const json = (await res.json()) as AdsErrorJson & {
    invoices?: InvoiceJson[];
  };
  if (!res.ok) {
    const detail = json.error?.details?.[0]?.errors?.[0];
    throw new Error(
      detail?.message || json.error?.message || `Invoice PDF lookup ${res.status}`,
    );
  }
  const match = (json.invoices ?? []).find((i) => i.id === opts.invoiceId);
  return match?.pdfUrl ?? null;
}

export async function downloadGoogleInvoicePdf(pdfUrl: string): Promise<ArrayBuffer> {
  const accessToken = await getGoogleAccessToken();
  const res = await fetch(pdfUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google PDF indirme başarısız (${res.status})`);
  }
  return res.arrayBuffer();
}
