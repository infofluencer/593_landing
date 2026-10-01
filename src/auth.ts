import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { clientEmailForPanel, emailLocalPart } from "@/lib/panel/client-email";
import { isStaffRole, resolvePanelHost, rootDomain } from "@/lib/panel/host";

/**
 * Relative-only redirect helper: never bounce a tenant host (demo.localhost)
 * over to apex localhost and drop the host-scoped session cookie.
 */
function safeRedirectUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith("/")) {
      return `${baseUrl}${url}`;
    }
    const target = new URL(url);
    const base = new URL(baseUrl);
    if (target.origin === base.origin) {
      return url;
    }
    // Cross-host (e.g. Auth built localhost while user is on demo.localhost)
    return `${base.origin}${target.pathname}${target.search}`;
  } catch {
    return baseUrl;
  }
}

/** Normalize login id: trim/lower; bare local-part → {local}@{root}. */
function normalizeLoginEmail(raw: string, tenantSlug: string | null): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  const domain = rootDomain();
  if (!trimmed.includes("@")) {
    const local = trimmed || tenantSlug || "";
    return local ? clientEmailForPanel(local, domain) : "";
  }
  return trimmed;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const password = String(credentials?.password ?? "");
        if (!password) return null;

        const h = await headers();
        const host = resolvePanelHost(
          h.get("x-forwarded-host") ?? h.get("host"),
        );
        const tenantSlug =
          host.kind === "tenant" ? host.tenantSlug : null;

        const email = normalizeLoginEmail(
          String(credentials?.email ?? ""),
          tenantSlug,
        );
        if (!email) return null;

        // Exact email, then on tenant host: {slug}@{root}.
        const candidates = Array.from(
          new Set(
            [
              email,
              tenantSlug
                ? clientEmailForPanel(tenantSlug, rootDomain())
                : null,
            ].filter((v): v is string => Boolean(v)),
          ),
        );

        type UserRow = {
          id: string;
          email: string;
          name: string | null;
          role: Role;
          passwordHash: string;
          memberships: { tenantId: string }[];
        };

        let user: UserRow | null = null;

        for (const candidate of candidates) {
          const row = await prisma.user.findUnique({
            where: { email: candidate },
            include: { memberships: { select: { tenantId: true } } },
          });
          if (row) {
            user = row;
            break;
          }
        }

        // Geçiş: eski local-part (tire yok) ↔ slug (tireli) uyumsuzluğu.
        if (!user && tenantSlug) {
          const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            select: { id: true },
          });
          if (tenant) {
            const local = emailLocalPart(email).replace(/-/g, "");
            const members = await prisma.user.findMany({
              where: {
                role: "client",
                memberships: { some: { tenantId: tenant.id } },
              },
              include: { memberships: { select: { tenantId: true } } },
            });
            user =
              members.find(
                (m) =>
                  emailLocalPart(m.email).replace(/-/g, "") === local ||
                  emailLocalPart(m.email) === emailLocalPart(email),
              ) ?? null;
          }
        }

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // Marka subdomain: yalnızca o markanın üyesi (admin/team burada giremez).
        if (host.kind === "tenant") {
          if (!host.tenantSlug) return null;
          const tenant = await prisma.tenant.findUnique({
            where: { slug: host.tenantSlug },
            select: { id: true },
          });
          if (!tenant) return null;
          const member = user.memberships.some((m) => m.tenantId === tenant.id);
          if (!member) return null;
        } else if (host.kind === "staff") {
          if (!isStaffRole(user.role)) return null;
        } else {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
          tenantIds: user.memberships.map((m) => m.tenantId),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tenantIds = user.tenantIds;
      }
      if (!token.id && typeof token.sub === "string") {
        token.id = token.sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const id =
          typeof token.id === "string" && token.id
            ? token.id
            : typeof token.sub === "string"
              ? token.sub
              : "";
        session.user.id = id;
        session.user.role =
          token.role === "admin" ||
          token.role === "team" ||
          token.role === "client"
            ? token.role
            : "client";
        session.user.tenantIds = Array.isArray(token.tenantIds)
          ? token.tenantIds.filter((id): id is string => typeof id === "string")
          : [];
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      return safeRedirectUrl(url, baseUrl);
    },
  },
  trustHost: true,
});
