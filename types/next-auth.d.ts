import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId?: string;
      role: "owner" | "admin" | "agent";
      platformRole?: "admin";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string;
    role?: "owner" | "admin" | "agent";
    platformRole?: "admin";
  }
}
