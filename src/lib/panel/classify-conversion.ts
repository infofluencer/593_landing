export type ConversionKindName = "whatsapp" | "form" | "sale" | "other";

function normCategory(category: string | null | undefined): string {
  return (category ?? "").toUpperCase().replace(/\s+/g, "_");
}

/** Kategori yok / anlamsız → isimden karar ver. */
function isVagueCategory(c: string): boolean {
  return (
    !c ||
    c === "UNKNOWN" ||
    c === "UNSPECIFIED" ||
    c === "DEFAULT" ||
    c === "OTHER"
  );
}

const LEAD_CATEGORIES = new Set([
  "SUBMIT_LEAD_FORM",
  "IMPORTED_LEAD",
  "QUALIFIED_LEAD",
  "CONVERTED_LEAD",
  "CONTACT",
  "PHONE_CALL_LEAD",
  "BOOK_APPOINTMENT",
  "REQUEST_QUOTE",
  "SIGNUP",
  "GET_DIRECTIONS",
  "OUTBOUND_CLICK",
]);

/** Lead markasında dönüşüm sayılmayan mikro adımlar. */
const NON_LEAD_CATEGORIES = new Set([
  "PAGE_VIEW",
  "ADD_TO_CART",
  "BEGIN_CHECKOUT",
  "ENGAGEMENT",
  "STORE_VISIT",
  "DOWNLOAD",
]);

/**
 * Google Ads dönüşüm aksiyonu bu marka tipinde panel dönüşümü mü?
 * Kampanya KPI'sı ve dönüşüm tablosu AYNI kuralı kullanır.
 * - ecommerce: PURCHASE / STORE_SALE; kategori belirsizse satın alım adı.
 * - lead: mikro adımlar (sayfa görüntüleme, sepete ekleme…) hariç hepsi.
 */
export function countsAsPanelConversion(
  tenantType: "ecommerce" | "lead",
  category: string | null | undefined,
  name: string,
): boolean {
  const c = normCategory(category);
  if (tenantType === "ecommerce") {
    if (isPurchaseCategory(c)) return true;
    return isVagueCategory(c) && isEcommerceSaleConversion(name);
  }
  if (NON_LEAD_CATEGORIES.has(c)) return false;
  if (isVagueCategory(c)) {
    // İsimden açıkça mikro adım olanları ele
    const n = normalizeConvName(name);
    if (
      n.includes("page_view") ||
      n.includes("page view") ||
      n.includes("add_to_cart") ||
      n.includes("scroll") ||
      n.includes("engagement") ||
      n.includes("session_start")
    ) {
      return false;
    }
  }
  return true;
}

/** Google Ads kategori + ad → panel türü (kategori önce, sonra isim). */
export function classifyConversionAction(
  name: string,
  category: string | null | undefined,
): ConversionKindName {
  const c = normCategory(category);
  if (isPurchaseCategory(c)) return "sale";
  const byName = classifyConversion(name);
  if (byName !== "other") return byName;
  if (LEAD_CATEGORIES.has(c)) return "form";
  return "other";
}

/** Google Ads / Meta conversion action name → panel kind. */
export function classifyConversion(name: string): ConversionKindName {
  const n = normalizeConvName(name);

  if (
    n.includes("whatsapp") ||
    /(^|[^a-z])wa([^a-z]|$)/.test(n) ||
    n.includes("messaging") ||
    n.includes("ileti dizisi") ||
    n.includes("message")
  ) {
    return "whatsapp";
  }
  if (
    (n.includes("form") &&
      !n.includes("inform") &&
      !n.includes("platform") &&
      !n.includes("perform")) ||
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
    .replace(/\p{M}/gu, "")
    // NFD noktasız ı'yı ayırmaz: "satın alım" → "satin alim"
    .replace(/ı/g, "i");
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
    (n.includes("sale") && !n.includes("wholesale")) ||
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
