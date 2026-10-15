/**
 * Panel buton / chip sınıfları — landing paletinden: mürekkep #141111,
 * beyaz, vurgu #e91825. Dokunma hedefi en az 40px.
 */

const base =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e91825] disabled:pointer-events-none disabled:opacity-50";

/** Ana eylem — koyu zemin, hover'da marka kırmızısı. */
export const btnPrimary = `${base} bg-[#141111] text-white hover:bg-[#e91825] hover:text-white`;

/** İkincil eylem — beyaz zemin, belirgin kenarlık. */
export const btnSecondary = `${base} border border-zinc-300 bg-white text-[#141111] hover:border-[#141111]`;

/** Metin benzeri, düşük vurgulu eylem. */
export const btnGhost = `${base} text-zinc-600 hover:bg-zinc-100 hover:text-[#141111]`;

/** Seçilebilir filtre / sekme. Seçili = dolu koyu. */
export function chipClass(active: boolean): string {
  return active
    ? `${base} border border-[#141111] bg-[#141111] text-white`
    : `${base} border border-zinc-300 bg-white text-zinc-700 hover:border-[#141111] hover:text-[#141111]`;
}

/** Arama / select alanı — butonlarla aynı yükseklik. */
export const fieldClass =
  "min-h-10 rounded-full border border-zinc-300 bg-white px-4 text-sm text-[#141111] placeholder:text-zinc-400 focus:border-[#141111] focus:outline-none";
