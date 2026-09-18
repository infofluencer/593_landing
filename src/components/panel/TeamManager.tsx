"use client";

import { Plus, Trash2, UserMinus, X } from "lucide-react";
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
  passwordPlain?: string | null;
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

const TEAM_COLORS = [
  "#0866FF",
  "#4285F4",
  "#E37400",
  "#7C3AED",
  "#0D9488",
  "#e91825",
  "#71717a",
];

function label(u: { name: string | null; email: string }) {
  return u.name?.trim() || u.email;
}

function teamColor(t: { color?: string | null }) {
  return t.color && /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : "#71717a";
}

export default function TeamManager({
  initialTeams,
  initialStaff,
  canManageMembers,
}: {
  initialTeams: Team[];
  initialStaff: StaffUser[];
  canManageMembers: boolean;
}) {
  const [teams, setTeams] = useState(initialTeams);
  const [staff, setStaff] = useState(initialStaff);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [teamColorPick, setTeamColorPick] = useState(TEAM_COLORS[0]);

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

  async function createTeam() {
    setError(null);
    setOk(null);
    const res = await fetch("/api/panel/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "team",
        name: teamName,
        description: teamDesc || null,
        color: teamColorPick,
      }),
    });
    const j = (await res.json().catch(() => null)) as
      | { team?: Team; error?: string }
      | null;
    if (!res.ok || !j?.team) {
      setError(j?.error || "Ekip oluşturulamadı");
      return;
    }
    setTeams((prev) =>
      [...prev, j.team!].sort((a, b) => a.name.localeCompare(b.name, "tr")),
    );
    setTeamName("");
    setTeamDesc("");
    setTeamColorPick(TEAM_COLORS[0]);
    setOk("Ekip eklendi");
  }

  async function deleteTeam(id: string) {
    if (!confirm("Bu ekip silinsin mi?")) return;
    setError(null);
    const res = await fetch(`/api/panel/teams/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(j?.error || "Silinemedi");
      return;
    }
    setTeams((prev) => prev.filter((t) => t.id !== id));
    await refresh();
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
        kind: "member",
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
      setError(j?.error || "Üye eklenemedi");
      return;
    }
    setMemberEmail("");
    setMemberName("");
    setMemberPassword("");
    setMemberRole("team");
    setMemberTeamIds([]);
    setOk("Ekip üyesi oluşturuldu");
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
        <h3 className="text-sm font-semibold text-zinc-800">Ekipler</h3>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Ekip adı (örn. Meta)"
            className="min-w-[160px] flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
          />
          <input
            value={teamDesc}
            onChange={(e) => setTeamDesc(e.target.value)}
            placeholder="Açıklama"
            className="min-w-[160px] flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-[#e91825]"
          />
          <div className="flex items-center gap-1.5">
            {TEAM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Renk ${c}`}
                onClick={() => setTeamColorPick(c)}
                className={`size-7 rounded-full border-2 transition ${
                  teamColorPick === c
                    ? "border-zinc-900 scale-110"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void createTeam()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#e91825] px-4 py-2 text-sm font-medium text-white hover:bg-[#c91420]"
          >
            <Plus className="size-4" aria-hidden />
            Ekip ekle
          </button>
        </div>

        {teams.length === 0 ? (
          <EmptyState
            variant="empty"
            title="Henüz ekip yok"
            description="Üstteki formdan ilk takımı ekleyin."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {teams.map((team) => {
              const color = teamColor(team);
              return (
                <li
                  key={team.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4"
                  style={{
                    boxShadow: `inset 4px 0 0 ${color}, 0 1px 2px rgba(28,25,23,0.04)`,
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="flex size-7 items-center justify-center rounded-full text-white"
                          style={{ backgroundColor: color }}
                        >
                          <TeamPlatformIcon
                            name={team.name}
                            slug={team.slug}
                            className="size-3.5 brightness-0 invert"
                          />
                        </span>
                        <h4 className="font-semibold text-zinc-900">
                          {team.name}
                        </h4>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums text-white"
                          style={{ backgroundColor: color }}
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
                    {canManageMembers ? (
                      <button
                        type="button"
                        onClick={() => void deleteTeam(team.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        Sil
                      </button>
                    ) : null}
                  </div>

                  {team.members.length === 0 ? (
                    <div className="mt-3">
                      <EmptyState
                        variant="empty"
                        title="Henüz üye yok"
                        description="Aşağıdan üye ekleyin."
                      />
                    </div>
                  ) : (
                    <ul className="mt-3 space-y-1.5">
                      {team.members.map((m) => {
                        const membershipCount =
                          staff.find((s) => s.id === m.userId)
                            ?.teamMemberships.length ?? 1;
                        return (
                          <li
                            key={m.id}
                            className="group flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="truncate">
                              {label(m.user)}
                              <span className="ml-1 text-xs text-zinc-400">
                                · {m.user.role}
                                {membershipCount > 1
                                  ? ` · ${membershipCount} takım`
                                  : ""}
                              </span>
                            </span>
                            {canManageMembers ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleMember(team.id, m.userId, true)
                                }
                                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-400 opacity-0 transition group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-700"
                              >
                                <UserMinus className="size-3" aria-hidden />
                                Çıkar
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canManageMembers ? (
                    <div className="mt-3 border-t border-zinc-100 pt-3">
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Üye ekle
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {staff
                          .filter(
                            (u) =>
                              !team.members.some((m) => m.userId === u.id),
                          )
                          .map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() =>
                                void toggleMember(team.id, u.id, false)
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-[#e91825]/25 bg-[#e91825]/5 px-2 py-1 text-xs font-medium text-[#e91825] hover:bg-[#e91825]/10"
                            >
                              <Plus className="size-3" aria-hidden />
                              {label(u)}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">Staff hesapları</h3>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Kişi</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Ekipler</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((u) => {
                const memberTeamIds = new Set(
                  u.teamMemberships.map((tm) => tm.teamId),
                );
                const available = teams.filter((t) => !memberTeamIds.has(t.id));
                return (
                  <tr
                    key={u.id}
                    className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{label(u)}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                      {u.teamMemberships.length > 1 ? (
                        <p className="mt-0.5 text-[10px] text-zinc-400">
                          {u.teamMemberships.length} takımda
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{u.role}</td>
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
                                className="inline-flex items-center gap-1 rounded-full py-0.5 pl-1 pr-1 text-[11px] font-bold text-white"
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
                                    className="rounded-full p-0.5 opacity-80 transition hover:bg-black/25 hover:opacity-100"
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
                              takım
                            </button>
                            {addMenuUserId === u.id ? (
                              <div className="absolute left-0 top-full z-20 mt-1 min-w-[150px] rounded-lg border border-zinc-200 bg-white p-1 shadow-md">
                                {available.map((t) => (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      void toggleMember(t.id, u.id, false)
                                    }
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                                  >
                                    <TeamPlatformIcon
                                      name={t.name}
                                      slug={t.slug}
                                      className="size-3.5"
                                    />
                                    {t.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canManageMembers ? (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold">Yeni staff üye</h4>
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
                <option value="team">team</option>
                <option value="admin">admin</option>
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
              Üye oluştur
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Yeni üye eklemek için admin hesabı gerekir.
          </p>
        )}
      </section>
    </div>
  );
}
