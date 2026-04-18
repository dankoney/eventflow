import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/)
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nested @auth/core adapter types differ
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" }
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, role: true, orgId: true }
        });
        if (!user) return null;

        const rows = await prisma.verificationToken.findMany({
          where: { identifier: email, expires: { gt: new Date() } }
        });

        for (const row of rows) {
          const ok = await bcrypt.compare(parsed.data.code, row.token);
          if (ok) {
            await prisma.verificationToken.deleteMany({ where: { identifier: email } });
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              orgId: user.orgId
            };
          }
        }

        return null;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.orgId = (user as { orgId: string }).orgId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { name: true, email: true, role: true, orgId: true }
        });
        if (dbUser) {
          session.user.name = dbUser.name;
          session.user.email = dbUser.email;
          session.user.role = dbUser.role;
          session.user.orgId = dbUser.orgId;
        } else {
          session.user.role = (token.role as Role | undefined) ?? Role.STAFF;
          session.user.orgId = (token.orgId as string | undefined) ?? "";
        }
      }
      return session;
    }
  }
});
