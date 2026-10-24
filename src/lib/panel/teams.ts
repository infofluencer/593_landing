/**
 * Sabit ajans ekipleri — UI'dan eklenip silinmez.
 * DB satırları migration 20261001120000_fixed_teams (+ 20261024120000_software_team) ile oluşturulur.
 */

export type FixedTeam = {
  slug: string;
  name: string;
  description: string;
  color: string;
};

export const FIXED_TEAMS: readonly FixedTeam[] = [
  {
    slug: "sosyal-medya",
    name: "Sosyal Medya",
    description: "İçerik planı, paylaşım ve topluluk yönetimi",
    color: "#E1306C",
  },
  {
    slug: "meta",
    name: "Meta",
    description: "Meta reklam operasyonları",
    color: "#0866FF",
  },
  {
    slug: "analytics",
    name: "Analytics",
    description: "GA4, GTM, ölçümleme",
    color: "#E37400",
  },
  {
    slug: "grafik-tasarim",
    name: "Grafik Tasarım",
    description: "Kreatif, görsel ve video üretimi",
    color: "#7C3AED",
  },
  {
    slug: "google",
    name: "Google",
    description: "Google Ads & Search",
    color: "#34A853",
  },
  {
    slug: "yazilim",
    name: "Yazılım",
    description: "Web sitesi, entegrasyon ve panel geliştirme",
    color: "#0F766E",
  },
];

export const FIXED_TEAM_SLUGS = FIXED_TEAMS.map((t) => t.slug);

/** Prisma where — yalnızca sabit ekipler. */
export const fixedTeamWhere = { slug: { in: FIXED_TEAM_SLUGS } };

/** Prisma orderBy — sabit sıra. */
export const fixedTeamOrderBy = { sortOrder: "asc" } as const;

/** Ekip + üyeleri (ekip sayfası / API). */
export const teamInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} as const;

/** Staff satırı — şifre yalnızca yetkiliye. */
export function staffSelect(withPasswords: boolean) {
  return {
    id: true,
    name: true,
    email: true,
    phone: true,
    avatarUrl: true,
    role: true,
    passwordPlain: withPasswords,
    teamMemberships: {
      where: { team: fixedTeamWhere },
      select: {
        teamId: true,
        team: { select: { id: true, name: true, slug: true, color: true } },
      },
      orderBy: { team: fixedTeamOrderBy },
    },
  } as const;
}
