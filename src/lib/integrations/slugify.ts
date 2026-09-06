/** Turkish-aware slugify for tenant subdomains. */
export function slugifyTr(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    I: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  };

  const replaced = input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("");

  return replaced
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 48);
}

export function uniqueSlug(base: string, accountId: string): string {
  const clean = slugifyTr(base) || "marka";
  const suffix = accountId.replace(/\D/g, "").slice(-4);
  return suffix ? `${clean}-${suffix}` : clean;
}
