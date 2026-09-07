/** Google Ads / Meta conversion action name → panel kind. */
export function classifyConversion(
  name: string,
): "whatsapp" | "form" | "sale" | "other" {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

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
  if (
    n.includes("purchase") ||
    n.includes("sale") ||
    n.includes("satis") ||
    n.includes("satin alma") ||
    n.includes("siparis") ||
    n.includes("checkout") ||
    n.includes("order")
  ) {
    return "sale";
  }
  return "other";
}
