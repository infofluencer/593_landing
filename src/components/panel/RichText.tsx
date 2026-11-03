export const URL_RE = /https?:\/\/[^\s<>"'()]+/gi;

/** Metin içindeki linkleri yerinde tıklanabilir yapar; satır sonları korunur. */
export function RichText({ text }: { text: string }) {
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
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="break-all text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
          >
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </>
  );
}
