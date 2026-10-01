"use client";

import { Check, Lock, Plus, Trash2, UserMinus, X } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/panel/ds/EmptyState";
import { TeamPlatformIcon } from "@/components/panel/TeamPlatformIcon";

type TeamBrief = {
  id: string;
  name: string;
  slug?: string;
  color: string;
};

type StaffUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  teamMemberships: Array<{
    teamId: string;
    team: TeamBrief;
  }>;
};

type Team = {
  id: string;
  name: string;
  slug?: string;
  color: string;
  description: string | null;
  members: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string | null;
      email: string;
      role: string;
    };
  }>;
};

type PermissionRow = {
  permission: string;
  label: string;
  roles: Record<"admin" | "team", boolean>;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team: "Ekip üyesi",
};

function label(u: { name: string | null; email: string }) {
  return u.name?.trim() || u.email;
}

function teamColor(t: { color?: string | null }) {
  return t.color && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#71717a";
}

function RoleBadge({ role }: { role: string }) {
  const admin = role === "admin";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        admin
          ? "bg-[#e91825]/10 text-[#e91825]"
          : "bg-zinc-100 text-zinc-600"
      }`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

export default function TeamManager({
  initialTeams,
  initialStaff,
  currentUserId,
  canManageUsers,
  canManageMembers,
  permissions,
}: {
  initialTeams: Team[];
  initialStaff: StaffUser[];
  currentUserId: string | null;
  canManageUsers: boolean;
  canManageMembers: boolean;
  permissions: PermissionRow[];
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [staff, setStaff] = useState(initialStaff);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [memberRole, setMemberRole] = useState<"team" | "admin">("team");
  const [memberTeamIds, setMemberTeamIds] = useState<string[]>([]);
  const [addMenuUserId, setAddMenuUserId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/panel/teams");
    if (!res.ok) return;
    const data = (await res.json()) as { teams: Team[]; staff: StaffUser[] };
    setTeams(data.teams);
    setStaff(data.staff);
  }

  async function toggleMember(teamId: string, userId: string, inTeam: boolean) {
    setError(null);
    const res = await fetch(`/api/panel/teams/${teamId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        inTeam ? { removeUserId: userId } : { addUserId: userId },
      ),
    });
    const j = (await res.json().catch(() => null)) as
      | { team?: Team; error?: string }
      | null;
    if (!res.ok || !j?.team) {
      setError(j?.error || "Üye güncellenemedi");
      return;
    }
    setTeams((prev) => prev.map((t) => (t.id === teamId ? j.team! : t)));
    setAddMenuUserId(null);
    await refresh();
  }

  async function createMember() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/panel/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: memberEmail,
        password: memberPassword,
        name: memberName || null,
        role: memberRole,
        teamIds: memberTeamIds,
      }),
    });
    const j = (await res.json().catch(() => null)) as
      | { user?: StaffUser; error?: string }
      | null;
    if (!res.ok || !j?.user) {
      setError(j?.error || "Kullanıcı eklenemedi");
      return;
    }
    setMemberEmail("");
    setMemberName("");
    setMemberPassword("");
    setMemberRole("team");
    setMemberTeamIds([]);
    setOk("Kullanıcı oluşturuldu");
    await refresh();
  }

  async function deleteUser(u: StaffUser) {
    if (!confirm(`${label(u)} hesabı kalıcı olarak silinsin mi?`)) return;
    setError(null);
    setOk(null);
    const res = await fetch(`/api/panel/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error || "Kullanıcı silinemedi");
      return;
    }
    setOk("Kullanıcı silindi");
    await refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e91825]">
          Ajans · ekip
        </p>
        <h2 className="text-lg font-semibold tracking-tight">Ajans ekibi</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Yalnızca admin portalında · marka panellerinde görünmez
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </p>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-800">Ekipler</h3>
          <p className="text-xs text-zinc-400">Sabit ekipler · {teams.length}</p>
        </div>

        {teams.length === 0 ? (
          <EmptyState
            variant="empty"
            title="Ekipler bulunamadı"
            description="Veritabanı migration’ını çalıştırın (prisma migrate deploy)."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => {
              const color = teamColor(team);
              return (
                <li
                  key={team.id}
                  className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4"
                  style={{
                    boxShadow: `inset 4px 0 0 ${color}, 0 1px 2px rgba(28,25,23,0.04)`,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: color }}
                    >
                      <TeamPlatformIcon
                        name={team.name}
                        slug={team.slug}
                        className="size-4 brightness-0 invert"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-zinc-900">
                          {team.name}
                        </h4>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                          style={{
                            backgroundColor: `${color}1a`,
                            color,
                          }}
                        >
                          {team.members.length} üye
                        </span>
                      </div>
                      {team.description ? (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {team.description}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {team.members.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-dashed border-zinc-200 px-3 py-2 text-center text-xs text-zinc-400">
                      Henüz üye yok
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {team.members.map((m) => (
                        <li
                          key={m.id}
                          className="group flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate">{label(m.user)}</span>
                            {m.user.role === "admin" ? (
                              <RoleBadge role="admin" />
                            ) : null}
                          </span>
                          {canManageMembers ? (
                            <button
                              type="button"
                              onClick={() =>
                                void toggleMember(team.id, m.userId, true)
                              }
                              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 focus:opacity-100"
                            >
                              <UserMinus className="size-3" aria-hidden />
                              Çıkar
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {canManageMembers ? (
                    (() => {
                      const candidates = staff.filter(
                        (u) => !team.members.some((m) => m.userId === u.id),
                      );
                      if (candidates.length === 0) return null;
                      return (
                        <div className="mt-3 border-t border-zinc-100 pt-3">
                          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                            Üye ekle
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {candidates.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() =>
                                  void toggleMember(team.id, u.id, false)
                                }
                                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition hover:brightness-95"
                                style={{
                                  borderColor: `${color}40`,
                                  backgroundColor: `${color}0d`,
                                  color,
                                }}
                              >
                                <Plus className="size-3" aria-hidden />
                                {label(u)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Staff hesapları</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kişi</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Ekipler</th>
                {canManageUsers ? (
                  <th className="px-4 py-2.5 font-medium">
                    <span className="sr-only">İşlemler</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const memberTeamIds = new Set(
                  u.teamMemberships.map((tm) => tm.teamId),
                );
                const available = teams.filter((t) => !memberTeamIds.has(t.id));
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">
                        {label(u)}
                        {isSelf ? (
                          <span className="ml-1.5 text-xs font-normal text-zinc-400">
                            (siz)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.teamMemberships.length === 0 ? (
                          <span className="text-xs text-zinc-400">—</span>
                        ) : (
                          u.teamMemberships.map((tm) => {
                            const c = teamColor(tm.team);
                            return (
                              <span
                                key={tm.teamId}
                                className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-2 text-[11px] font-bold text-white"
                                style={{ backgroundColor: c }}
                              >
                                <span className="flex size-4 items-center justify-center rounded-full bg-white/20">
                                  <TeamPlatformIcon
                                    name={tm.team.name}
                                    slug={tm.team.slug}
                                    className="size-2.5 brightness-0 invert"
                                  />
                                </span>
                                {tm.team.name}
                                {canManageMembers ? (
                                  <button
                                    type="button"
                                    aria-label={`${tm.team.name} çıkar`}
                                    onClick={() =>
                                      void toggleMember(tm.teamId, u.id, true)
                                    }
                                    className="-mr-1 rounded-full p-0.5 opacity-80 transition hover:bg-black/25 hover:opacity-100"
                                  >
                                    <X className="size-3" aria-hidden />
                                  </button>
                                ) : null}
                              </span>
                            );
                          })
                        )}
                        {canManageMembers && available.length > 0 ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setAddMenuUserId((prev) =>
                                  prev === u.id ? null : u.id,
                                )
                              }
                              className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[#e91825]/40 bg-[#e91825]/5 px-2 py-0.5 text-[11px] font-semibold text-[#e91825] hover:bg-[#e91825]/10"
                            >
                              <Plus className="size-3" aria-hidden />
                              ekip
                            </button>
                            {addMenuUserId === u.id ? (
                              <div className="absolute left-0 top-full z-20 mt-1 min-w-[170px] rounded-lg border border-zinc-200 bg-white p-1 shadow-md">
                                {available.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      void toggleMember(t.id, u.id, false)
                                    }
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                  >
                                    <span
                                      className="flex size-5 items-center justify-center rounded-md text-white"
                                      style={{ backgroundColor: teamColor(t) }}
                                    >
                                      <TeamPlatformIcon
                                        name={t.name}
                                        slug={t.slug}
                                        className="size-3 brightness-0 invert"
                                      />
                                    </span>
                                    {t.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    {canManageUsers ? (
                      <td className="px-4 py-3 text-right">
                        {isSelf ? null : (
                          <button
                            type="button"
                            onClick={() => void deleteUser(u)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                            Sil
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canManageUsers ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold">Yeni kullanıcı</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="Ad"
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
              />
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="E-posta"
                type="email"
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
              />
              <input
                value={memberPassword}
                onChange={(e) => setMemberPassword(e.target.value)}
                placeholder="Şifre (min 8)"
                type="text"
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
              />
              <select
                value={memberRole}
                onChange={(e) =>
                  setMemberRole(e.target.value as "team" | "admin")
                }
                className="rounded-md border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="team">{ROLE_LABELS.team}</option>
                <option value="admin">{ROLE_LABELS.admin}</option>
              </select>
            </div>
            {teams.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {teams.map((t) => {
                  const on = memberTeamIds.includes(t.id);
                  const c = teamColor(t);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setMemberTeamIds((prev) =>
                          on
                            ? prev.filter((id) => id !== t.id)
                            : [...prev, t.id],
                        )
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                        on ? "border-transparent text-white" : "bg-white"
                      }`}
                      style={
                        on
                          ? { backgroundColor: c, borderColor: c }
                          : { borderColor: c, color: c }
                      }
                    >
                      <TeamPlatformIcon
                        name={t.name}
                        slug={t.slug}
                        className={`size-3 ${on ? "brightness-0 invert" : ""}`}
                      />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void createMember()}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#e91825] px-4 py-2 text-sm font-medium text-white hover:bg-[#c91420]"
            >
              <Plus className="size-4" aria-hidden />
              Kullanıcı oluştur
            </button>
          </div>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
            <Lock className="size-3.5" aria-hidden />
            Kullanıcı ekleme ve ekip düzenleme yalnızca admin hesabına açıktır.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Rol yetkileri</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Yetki</th>
                <th className="w-28 px-4 py-2.5 text-center font-medium">
                  {ROLE_LABELS.admin}
                </th>
                <th className="w-28 px-4 py-2.5 text-center font-medium">
                  {ROLE_LABELS.team}
                </th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p) => (
                <tr
                  key={p.permission}
                  className="border-b border-zinc-50 last:border-0"
                >
                  <td className="px-4 py-2.5 text-zinc-700">{p.label}</td>
                  {(["admin", "team"] as const).map((r) => (
                    <td key={r} className="px-4 py-2.5 text-center">
                      {p.roles[r] ? (
                        <Check
                          className="mx-auto size-4 text-emerald-600"
                          aria-label="Var"
                        />
                      ) : (
                        <X
                          className="mx-auto size-4 text-zinc-300"
                          aria-label="Yok"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
