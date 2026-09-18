import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { MetricHeaderLabel } from "./MetricHelpTooltip";

export type DataTableSortDir = "asc" | "desc" | null;

export type DataTableHeader =
  | string
  | {
      key: string;
      label: string;
      align?: "left" | "right";
      /** metric-descriptions anahtarı — başlık (?) tooltip */
      metricKey?: string;
      sortable?: boolean;
      sortDir?: DataTableSortDir;
      onSort?: () => void;
    };

/** Türkçe kolon başlığı → sözlük anahtarı (string header’lar için). */
const HEADER_METRIC_MAP: Record<string, string> = {
  Harcama: "spend",
  Erişim: "reach",
  Gösterim: "impressions",
  Tıklama: "clicks",
  "Tıklama %": "ctr",
  CTR: "ctr",
  "Ort. CTR": "gscCtr",
  Dönüşüm: "conversions",
  Satış: "conversions",
  Lead: "conversions",
  Getiri: "roas",
  "Satış maliyeti": "cpa",
  "Lead maliyeti": "cpl",
  Maliyet: "cpa",
  CPA: "cpa",
  CPL: "cpl",
  ROAS: "roas",
  Oturum: "sessions",
  Kullanıcı: "users",
  Konum: "gscPosition",
  "Ort. konum": "gscPosition",
  Kampanya: "campaign",
  "Reklam grubu": "adset",
  Tutar: "invoiceTotal",
};

function headerLabel(h: DataTableHeader): string {
  return typeof h === "string" ? h : h.label;
}

function headerMetricKey(h: DataTableHeader): string | undefined {
  if (typeof h === "string") return HEADER_METRIC_MAP[h];
  return h.metricKey ?? HEADER_METRIC_MAP[h.label];
}

/**
 * Standart panel tablosu — dolgulu başlık + (?) tooltip, zebra/hover,
 * sağa hizalı tabular-nums, `data-total` satırı kalın + üst border.
 */
export function DataTable({
  headers,
  children,
  numericCols,
  className = "",
}: {
  headers: DataTableHeader[];
  children: ReactNode;
  /** Column indices (0-based) that should use tabular-nums + right align. */
  numericCols?: number[];
  className?: string;
}) {
  const numericSet = new Set(numericCols ?? []);

  return (
    <div
      className={[
        "overflow-x-auto rounded-panel-md border border-panel-border shadow-panel",
        className,
      ].join(" ")}
    >
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-panel-border-strong bg-panel-surface-muted">
            {headers.map((h, i) => {
              const label = headerLabel(h);
              const metricKey = headerMetricKey(h);
              const align =
                typeof h === "string"
                  ? numericSet.has(i)
                    ? "right"
                    : "left"
                  : (h.align ?? (numericSet.has(i) ? "right" : "left"));
              const sortable =
                typeof h !== "string" && h.sortable && h.onSort;

              return (
                <th
                  key={typeof h === "string" ? `${h}-${i}` : h.key}
                  scope="col"
                  className={[
                    "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-panel-fg-secondary",
                    align === "right" ? "text-right" : "text-left",
                  ].join(" ")}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={typeof h !== "string" ? h.onSort : undefined}
                      className="inline-flex items-center gap-1 hover:text-panel-fg"
                    >
                      <MetricHeaderLabel metricKey={metricKey}>
                        {label}
                      </MetricHeaderLabel>
                      <SortIcon
                        dir={typeof h !== "string" ? (h.sortDir ?? null) : null}
                      />
                    </button>
                  ) : (
                    <MetricHeaderLabel metricKey={metricKey}>
                      {label}
                    </MetricHeaderLabel>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody
          className={[
            "bg-panel-surface",
            "[&_tr]:border-b [&_tr]:border-panel-border",
            "[&_tr:last-child]:border-b-0",
            "[&_tr:nth-child(even):not([data-total])]:bg-panel-surface-muted/40",
            "[&_tr:hover]:bg-panel-surface-muted/70",
            "[&_tr[data-total]]:border-t-2 [&_tr[data-total]]:border-t-panel-border-strong",
            "[&_tr[data-total]]:bg-panel-surface-muted [&_tr[data-total]]:font-semibold",
            "[&_tr[data-total]]:text-panel-fg [&_tr[data-total]:hover]:bg-panel-surface-muted",
            "[&_td]:px-4 [&_td]:py-3 [&_td]:text-panel-fg",
            "[&_td.num]:text-right [&_td.num]:tabular-nums",
          ].join(" ")}
        >
          {children}
        </tbody>
      </table>
    </div>
  );
}

function SortIcon({ dir }: { dir: DataTableSortDir }) {
  if (dir === "asc") return <ArrowUp className="size-3.5" aria-hidden />;
  if (dir === "desc") return <ArrowDown className="size-3.5" aria-hidden />;
  return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />;
}
