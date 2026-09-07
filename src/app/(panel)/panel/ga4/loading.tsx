import PanelLoadingBlock from "@/components/panel/PanelLoadingBlock";

export default function Ga4Loading() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
          Google Analytics 4
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Site davranışı
        </h2>
        <p className="mt-1 text-sm text-zinc-500">Dönem verisi yükleniyor…</p>
      </div>
      <PanelLoadingBlock
        title="GA4 raporu çekiliyor"
        detail="Seçilen tarih aralığı için Analytics Data API çağrılıyor."
      />
    </div>
  );
}
