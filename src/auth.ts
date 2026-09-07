import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { isStaffRole, resolvePanelHost } from "@/lib/panel/host";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { memberships: { select: { tenantId: true } } },
        });

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const h = await headers();
        const host = resolvePanelHost(
          h.get("x-forwarded-host") ?? h.get("host"),
        );

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
          // Ajans portalı: yalnızca admin/team.
          if (!isStaffRole(user.role)) return null;
        } else {
          // Apex / bilinmeyen host — panel oturumu açma.
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
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
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
