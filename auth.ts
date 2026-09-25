import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { loginSchema } from "@/lib/validation/auth";
import { checkRateLimit, RATE_LIMITS } from "@/server/lib/rate-limit";
import {
  authenticateWithPassword,
  getAuthUser,
  upsertGoogleUser,
  type AuthUser,
} from "@/server/services/tenants/registration.service";

export const googleAuthEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function applyUser(token: Record<string, unknown>, user: AuthUser) {
  token.uid = user.id;
  token.tenantId = user.tenantId;
  token.role = user.role;
  token.platformRole = user.platformRole;
  token.name = user.name;
  token.email = user.email;
  token.picture = user.image;
}

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        if (!checkRateLimit(`login:${email.toLowerCase()}`, RATE_LIMITS.auth).ok) return null;
        const user = await authenticateWithPassword(email, password);
        return user ? { id: user.id, email: user.email, name: user.name, image: user.image } : null;
      },
    }),
    ...(googleAuthEnabled
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        // Only trust Google identities with a verified email address.
        return Boolean(profile?.email && profile.email_verified);
      }
      return true;
    },
    async jwt({ token, user, account, profile, trigger }) {
      if (account?.provider === "google" && profile?.email) {
        const dbUser = await upsertGoogleUser({
          email: profile.email,
          name: profile.name,
          image: typeof profile.picture === "string" ? profile.picture : null,
          googleId: account.providerAccountId,
        });
        applyUser(token, dbUser);
      } else if (user?.id) {
        const dbUser = await getAuthUser(user.id);
        if (dbUser) applyUser(token, dbUser);
      } else if (token.uid && (!token.tenantId || trigger === "update")) {
        // Users finishing onboarding: pick up their new tenant without re-login.
        const dbUser = await getAuthUser(String(token.uid));
        if (dbUser) applyUser(token, dbUser);
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.uid ?? "");
      session.user.tenantId = token.tenantId ? String(token.tenantId) : undefined;
      session.user.role = (token.role as AuthUser["role"]) ?? "owner";
      session.user.platformRole = token.platformRole as AuthUser["platformRole"];
      return session;
    },
  },
});
