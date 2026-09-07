import { compare } from "bcryptjs";
import {
  AuditAction,
  AuditResourceType,
  UserSecurityEvent,
  UserSecurityOutcome,
  UserSecuritySource,
} from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/audit/request-context";
import { credentialsSchema } from "@/validation/auth";

async function recordLoginSecurityEvent(input: {
  event: UserSecurityEvent;
  outcome: UserSecurityOutcome;
  target?: {
    id: string;
    role: "ADMIN" | "EDITOR";
  };
  metadata?: { [key: string]: string };
}) {
  const requestContext = await getRequestContext();
  const actor =
    input.outcome === UserSecurityOutcome.SUCCESS ? input.target : undefined;
  const auditAction =
    input.event === UserSecurityEvent.LOGIN_SUCCEEDED
      ? AuditAction.LOGIN_SUCCEEDED
      : AuditAction.LOGIN_FAILED;

  try {
    await prisma.createAuditLog({
      actor,
      target: input.target,
      requestContext,
      action: auditAction,
      resourceType: AuditResourceType.USER,
      resourceId: input.target?.id,
      reason: input.metadata?.reason,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("Failed to write login audit log", error);
  }

  try {
    await prisma.userSecurityLog.createLog({
      actor,
      target: input.target,
      requestContext,
      event: input.event,
      source:
        input.outcome === UserSecurityOutcome.SUCCESS
          ? UserSecuritySource.SELF
          : UserSecuritySource.SYSTEM,
      outcome: input.outcome,
      reason: input.metadata?.reason,
      metadata: input.metadata,
    });
  } catch (error) {
    console.error("Failed to write login security log", error);
  }
}

export const { handlers, auth } = NextAuth({
  trustHost: true,
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          await recordLoginSecurityEvent({
            event: UserSecurityEvent.LOGIN_FAILED,
            outcome: UserSecurityOutcome.FAILURE,
            metadata: { reason: "INVALID_CREDENTIALS_FORMAT" },
          });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (
          !user?.isActive ||
          !(await compare(parsed.data.password, user.passwordHash))
        ) {
          await recordLoginSecurityEvent({
            event: UserSecurityEvent.LOGIN_FAILED,
            outcome: UserSecurityOutcome.FAILURE,
            target: user
              ? {
                  id: user.id,
                  role: user.role,
                }
              : undefined,
            metadata: { email: parsed.data.email },
          });
          return null;
        }

        await recordLoginSecurityEvent({
          event: UserSecurityEvent.LOGIN_SUCCEEDED,
          outcome: UserSecurityOutcome.SUCCESS,
          target: {
            id: user.id,
            role: user.role,
          },
          metadata: { email: user.email },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;

      if (pathname === "/admin/login") {
        return true;
      }

      if (!session?.user?.id || !session.user.role) {
        return false;
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, isActive: true },
      });

      return Boolean(
        currentUser?.isActive && currentUser.role === session.user.role,
      );
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
      } else if (token.id) {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { email: true, name: true, role: true, isActive: true },
        });

        if (
          !currentUser?.isActive ||
          !token.role ||
          currentUser.role !== token.role
        ) {
          token.id = undefined;
          token.role = undefined;
          token.email = undefined;
          token.name = undefined;
          token.sub = undefined;
        } else {
          token.email = currentUser.email;
          token.name = currentUser.name;
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        session.user.name = token.name;
      }

      return session;
    },
  },
});
