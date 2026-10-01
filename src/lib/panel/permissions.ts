/**
 * Rol bazlı yetkilendirme — tek kaynak.
 * Yeni bir yetki kontrolü eklerken rol karşılaştırması yazmak yerine
 * `can(role, "…")` kullanın; API'lerde `requirePermissionApi`.
 */

export type PanelRole = "admin" | "team" | "client";

export type Permission =
  /** Ajans portalına (admin.*) giriş, marka listesi, durum panosu. */
  | "staff.access"
  /** Marka ayarları, kapak, senkron, bütçe düzenleme. */
  | "brands.edit"
  /** Marka adı, panel adresi (slug) ve türü değiştirme. */
  | "brands.editIdentity"
  /** Yeni marka ekleme (müşteri hesabı da oluşturur). */
  | "brands.create"
  /** Markayı kalıcı silme. */
  | "brands.delete"
  /** Durum panosunda kart silme. */
  | "board.deleteCards"
  /** Staff + müşteri hesabı oluşturma / şifre güncelleme / silme. */
  | "users.manage"
  /** Ekiplere üye ekleme / çıkarma. */
  | "teams.manageMembers"
  /** Staff + müşteri şifrelerini görme. */
  | "users.viewPasswords";

const ROLE_PERMISSIONS: Record<PanelRole, readonly Permission[]> = {
  admin: [
    "staff.access",
    "brands.edit",
    "brands.editIdentity",
    "brands.create",
    "brands.delete",
    "board.deleteCards",
    "users.manage",
    "teams.manageMembers",
    "users.viewPasswords",
  ],
  team: ["staff.access", "brands.edit"],
  client: [],
};

export const ROLE_LABELS: Record<PanelRole, string> = {
  admin: "Admin",
  team: "Ekip üyesi",
  client: "Müşteri",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "staff.access": "Ajans portalı & durum panosu",
  "brands.edit": "Marka ayarları, senkron, bütçe",
  "brands.editIdentity": "Marka adı, panel adresi ve türü",
  "brands.create": "Marka ekleme",
  "brands.delete": "Marka silme",
  "board.deleteCards": "Durum panosunda kart silme",
  "users.manage": "Kullanıcı ekleme / silme",
  "teams.manageMembers": "Ekip üyeliklerini düzenleme",
  "users.viewPasswords": "Staff ve müşteri şifrelerini görme",
};

export function isPanelRole(role: unknown): role is PanelRole {
  return role === "admin" || role === "team" || role === "client";
}

export function can(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  if (!isPanelRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: string | null | undefined): Permission[] {
  return isPanelRole(role) ? [...ROLE_PERMISSIONS[role]] : [];
}

/** UI matrisi için: [yetki, admin, team] satırları. */
export function permissionMatrix(): Array<{
  permission: Permission;
  label: string;
  roles: Record<"admin" | "team", boolean>;
}> {
  return (Object.keys(PERMISSION_LABELS) as Permission[]).map((p) => ({
    permission: p,
    label: PERMISSION_LABELS[p],
    roles: { admin: can("admin", p), team: can("team", p) },
  }));
}
