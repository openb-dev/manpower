import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "../db/index.ts";
import { Role } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });

        if (!user || !user.active) return null;

        const isValid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
          companySlug: user.company?.slug || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.companyId = (user as any).companyId;
        token.companySlug = (user as any).companySlug;
      }

      // Allow SUPER_ADMIN to dynamically switch company context
      if (trigger === "update" && session?.switchedCompanyId && token.role === Role.SUPER_ADMIN) {
        token.companyId = session.switchedCompanyId;
        token.companySlug = session.switchedCompanySlug;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).companyId = token.companyId;
        (session.user as any).companySlug = token.companySlug;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      const target = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
      if (target.origin !== new URL(baseUrl).origin) return baseUrl;
      if (target.pathname === "/login" || target.pathname.includes("/applicants")) {
        return baseUrl;
      }
      return target.href;
    },
  },
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: {
    signIn: "/login",
    signOut: "/logout",
  },
});
