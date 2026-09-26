import { z } from "zod";

/**
 * Server-side environment. Validated lazily so that build steps which never
 * touch a given integration don't fail when its variables are absent.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  AI_PROVIDER: z.enum(["openai", "rules"]).optional(),
  AI_API_KEY: z.string().optional(),
  AI_API_URL: z.string().url().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4.1-mini"),

  WHATSAPP_PROVIDER: z.enum(["meta", "sandbox"]).optional(),
  WHATSAPP_API_URL: z.string().url().default("https://graph.facebook.com/v21.0"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_NUMBER: z.string().optional(),
  WHATSAPP_BATCH_WINDOW_MS: z.coerce.number().int().min(0).default(15000),

  REDIS_URL: z.string().optional(),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  MEDIA_SIGNING_SECRET: z.string().optional(),
  BILLING_PROVIDER: z.enum(["mock", "razorpay"]).default("mock"),
  ALLOW_TEST_BILLING: z.enum(["true", "false"]).optional(),
  ADMIN_EMAILS: z.string().default(""),
  CUSTOM_DOMAIN_CNAME_TARGET: z.string().default("cname.vercel-dns.com"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  // Hosting dashboards often keep variables with empty values; treat "" as not set.
  const defined = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== ""));
  const parsed = serverEnvSchema.safeParse(defined);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => process.env.NODE_ENV === "production";

/** Secret used to sign media URLs and internal tokens. Falls back to the auth secret. */
export function signingSecret(): string {
  const e = env();
  const secret = e.MEDIA_SIGNING_SECRET || e.NEXTAUTH_SECRET;
  if (!secret) {
    if (isProduction()) throw new Error("MEDIA_SIGNING_SECRET or NEXTAUTH_SECRET must be set");
    return "dev-only-insecure-secret";
  }
  return secret;
}
