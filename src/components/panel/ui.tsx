import type { ReactNode } from "react";
import Link from "next/link";

export function Delta({
  value,
  invert = false,
}: {
  value: number | null;
  /** When true, positive change is bad (e.g. CPA up). */
  invert?: boolean;
}) {
  if (value === null) {
    return <span className="text-[11px] text-zinc-500">n/a</span>;
  }
  const good = invert ? value < 0 : value > 0;
  const bad = invert ? value > 0 : value < 0;
  const color = good
    ? "text-emerald-600"
    : bad
      ? "text-rose-600"
      : "text-zinc-500";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`text-[11px] font-medium tabular-nums ${color}`}>
      {sign}
      {value.toFixed(1)}%
    </span>
  );
}

export function PanelStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>
      {hint ? <div className="mt-1">{hint}</div> : null}
    </div>
  );
}

export function PanelTable({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-[11px] uppercase tracking-[0.1em] text-zinc-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">{children}</tbody>
      </table>
    </div>
  );
}

export function PanelNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "rounded-md px-3 py-2 text-sm transition",
        active
          ? "bg-zinc-100 font-medium text-zinc-900"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
