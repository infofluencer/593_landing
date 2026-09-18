/** Google Ads / Meta conversion action name → panel kind. */
export function classifyConversion(
  name: string,
): "whatsapp" | "form" | "sale" | "other" {
  const n = normalizeConvName(name);

  if (
    n.includes("whatsapp") ||
    n.includes("wa ") ||
    n.includes("messaging") ||
    n.includes("ileti dizisi") ||
    n.includes("message")
  ) {
    return "whatsapp";
  }
  if (
    n.includes("form") ||
    n.includes("lead") ||
    n.includes("randevu") ||
    n.includes("basvuru") ||
    n.includes("iletisim")
  ) {
    return "form";
  }
  if (isEcommerceSaleConversion(name)) {
    return "sale";
  }
  return "other";
}

function normalizeConvName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * E-ticaret markalarında tek kabul edilen dönüşüm: Satın alım (ücreti).
 * Google Ads PURCHASE kategorisi / satın alım aksiyon adları.
 * Sepete ekleme / checkout başlangıcı sayılmaz.
 */
export function isEcommerceSaleConversion(name: string): boolean {
  const n = normalizeConvName(name);

  // Ara funnel adımları — satın alım değil
  if (
    n.includes("add_to_cart") ||
    n.includes("add to cart") ||
    n.includes("sepete") ||
    n.includes("begin_checkout") ||
    n.includes("initiate_checkout") ||
    (n.includes("checkout") && !n.includes("purchase") && !n.includes("satin"))
  ) {
    return false;
  }

  if (
    n.includes("satin alim ucret") ||
    n.includes("satin alma ucret") ||
    n.includes("satin alim") ||
    n.includes("satin alma")
  ) {
    return true;
  }

  if (
    n.includes("purchase") ||
    n.includes("omni_purchase") ||
    n.includes("sale") ||
    n.includes("satis") ||
    n.includes("siparis") ||
    n.includes("order")
  ) {
    return true;
  }

  return false;
}

/** Google Ads conversion_action_category → ecommerce purchase? */
export function isPurchaseCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toUpperCase().replace(/\s+/g, "_");
  return c === "PURCHASE" || c === "STORE_SALE";
}
