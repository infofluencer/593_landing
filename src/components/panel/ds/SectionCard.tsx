import type { ReactNode } from "react";
import type { AlertSeverity } from "@prisma/client";
import { StatusBadge } from "./StatusBadge";

export type ProviderKind = "meta" | "google" | "ga4" | "gtm" | "gsc";

const PROVIDER_LABEL: Record<ProviderKind, string> = {
  meta: "Meta",
  google: "Google Ads",
  ga4: "GA4",
  gtm: "GTM",
  gsc: "GSC",
};

const PROVIDER_PILL: Record<ProviderKind, string> = {
  meta: "bg-[var(--panel-meta-soft)] text-panel-meta",
  google: "bg-[#4285f4]/10 text-[#4285f4]",
  ga4: "bg-[#f9ab00]/15 text-[#e37400]",
  gtm: "bg-[#4285f4]/10 text-[#1967d2]",
  gsc: "bg-[#34a853]/12 text-[#137333]",
};

export function ProviderBadge({ provider }: { provider: ProviderKind }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${PROVIDER_PILL[provider]}`}
    >
      {PROVIDER_LABEL[provider]}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  provider,
  status,
  actions,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  provider?: ProviderKind;
  status?: AlertSeverity;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-panel-lg border border-panel-border bg-panel-surface shadow-panel",
        className,
      ].join(" ")}
    >
      <header className="flex flex-wrap items-start gap-3 border-b border-panel-border px-6 py-5">
        <div className="mr-auto min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-panel-fg">
              {title}
            </h2>
            {provider ? <ProviderBadge provider={provider} /> : null}
          </div>
          {description ? (
            <p className="text-sm text-panel-fg-secondary">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? <StatusBadge status={status} /> : null}
          {actions}
        </div>
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
