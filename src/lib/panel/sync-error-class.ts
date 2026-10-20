/** SyncJob hata metnini sınıflandırır — Prisma import etmez (client'ta da kullanılır). */
export type SyncErrorClass = "token" | "permission" | "setup" | "rate" | "other";

export function classifySyncError(error: string | null): SyncErrorClass {
  const e = error ?? "";
  if (/OAuth eksik|access token|authentication credential|invalid_grant|Error validating access token|session has expired|expired or revoked|code.?190|\(#190\)/i.test(e))
    return "token";
  if (/\(#200\)|permission|not grant|PERMISSION_DENIED|yetki/i.test(e))
    return "permission";
  if (/eksik|yok —|eşleştirilmemiş|has not been used|is disabled|tanımlı değil/i.test(e))
    return "setup";
  if (/limit reached|rate limit|429|quota/i.test(e)) return "rate";
  return "other";
}
