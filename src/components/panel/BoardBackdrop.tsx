"use client";

import dynamic from "next/dynamic";

const BoardOrbLayer = dynamic(() => import("@/components/panel/BoardOrbLayer"), {
  ssr: false,
  loading: () => null,
});

/**
 * Durum panosu arka planı — landing’deki hareketli 593 logosu.
 * İçerik alanını (kenar çubuğu hariç) kaplar; kartlar `relative z-10` ile üstte.
 * Katman tıklamaları geçirir; yalnızca logonun kendisi basılı tutulup taşınabilir.
 */
export default function BoardBackdrop() {
  return (
    <div
      aria-hidden
      // m-0: sayfa kapsayıcısının space-y boşluğu sabit katmanı alttan kısaltmasın.
      className="pointer-events-none fixed inset-y-0 left-0 right-0 z-0 m-0 overflow-hidden lg:left-[var(--panel-sidebar-w)]"
    >
      <BoardOrbLayer />
    </div>
  );
}
