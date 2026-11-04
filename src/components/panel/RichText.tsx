export const URL_RE = /https?:\/\/[^\s<>"'()]+/gi;

/** Uzun bağlantının okunur kısa hali: alan adı + yol, gerekirse ortası kısaltılmış. */
export function shortUrl(href: string, max = 48): string {
  let label = href;
  try {
    const u = new URL(href);
    label = `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    // Geçersiz URL — ham metni göster.
  }
  return label.length > max ? `${label.slice(0, max - 13)}…${label.slice(-12)}` : label;
}

/**
 * Metin içindeki linkleri yerinde tıklanabilir yapar; satır sonları korunur.
 * `compactLinks`: link kısa etiketle görünür, tam adres fare üstünde.
 */
export function RichText({ text, compactLinks = false }: { text: string; compactLinks?: boolean }) {
  const parts: Array<{ kind: "text" | "link"; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trimmed = url.replace(/[.,;:!?]+$/, "");
    url = trimmed;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    parts.push({ kind: "link", value: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "link" ? (
          <a
            key={i}
            href={p.value}
            title={compactLinks ? p.value : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="break-all text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            {compactLinks ? shortUrl(p.value) : p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}
