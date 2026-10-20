import { DeltaBadge } from "./KPICard";

/**
 * Tablo hücresi: değer + altında önceki döneme göre değişim rozeti.
 * Sunucu bileşeni; rozet client (KPICard) bileşenidir.
 */
export function DeltaCell({
  value,
  delta,
  invert,
}: {
  value: string;
  delta?: number | null;
  invert?: boolean;
}) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span>{value}</span>
      {delta != null && Number.isFinite(delta) ? (
        <DeltaBadge value={delta} invert={invert} />
      ) : null}
    </span>
  );
}
