/**
 * Graph API çağrısı — yanıtı güvenli okur. Meta ara sıra JSON yerine boş /
 * HTML / kesik gövde döndürür ("Unexpected non-whitespace character after
 * JSON"); bu durumda ve 5xx / ağ hatasında kısa bekleyip yeniden dener.
 */
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 800;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

export async function graphFetch<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<{ res: Response; json: T }> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
      continue;
    }
    const text = await res.text();
    let json: T | null = null;
    try {
      json = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      json = null;
    }
    if (json === null || (res.status >= 500 && res.status < 600)) {
      lastErr = new MetaGraphError(
        json === null
          ? `Meta geçersiz yanıt (HTTP ${res.status}): ${text.slice(0, 80).replace(/\s+/g, " ")}`
          : `Meta HTTP ${res.status}`,
        res.status,
      );
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BASE_MS * attempt);
      continue;
    }
    return { res, json };
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
