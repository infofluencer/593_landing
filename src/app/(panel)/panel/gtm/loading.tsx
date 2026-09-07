import PanelLoadingBlock from "@/components/panel/PanelLoadingBlock";

export default function GtmLoading() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-400">
          Google Tag Manager
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          Konteyner + site doğrulama
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Sayfa hazırlanıyor…
        </p>
      </div>
      <PanelLoadingBlock
        title="GTM config yükleniyor"
        detail="Google Tag Manager API yanıt verene kadar bekleniyor. Kota (429) aşımında 1–2 dakika sonra yenileyin."
      />
    </div>
  );
}
