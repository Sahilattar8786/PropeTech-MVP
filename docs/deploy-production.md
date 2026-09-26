# Deploying PropFlow to production

This guide takes PropFlow from a laptop to a live site at `https://yourdomain.com`: Google login, real WhatsApp, Cloudflare storage and DNS, and automated checks on every push. Replace `yourdomain.com` with your domain throughout.

```
Customers & brokers ──► Cloudflare DNS ──► Vercel (web app, API, WhatsApp webhook)
                                              │        │         │
                         MongoDB Atlas ◄──────┘        │         └──► Redis (job queue)
                         Cloudflare R2 (photos) ◄──────┘                  │
Meta WhatsApp ──webhook──► Vercel                  Railway worker ◄───────┘
                                                   (photos, AI, WhatsApp replies)
```

Do the steps in order. Each ends with a check.

---

## 1. Domain on Cloudflare
1. Buy your domain (any registrar), then **Cloudflare → Add a site** → Free plan.
2. At your registrar, replace the nameservers with the two Cloudflare shows. Wait until Cloudflare says **Active** (minutes to a few hours).

✅ Cloudflare dashboard shows the domain as Active.

## 2. MongoDB Atlas (production database)
1. Use a **separate database for production**. The simplest way is the database name `propflow` in the connection string. Your laptop currently uses `test`; keep dev and prod data apart.
2. **Database Access** → create a user for production with a long random password.
3. **Network Access** → `0.0.0.0/0` (Vercel and Railway don't have fixed IPs).
4. Connection string:
   `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/propflow?retryWrites=true&w=majority`

✅ Keep the string for step 5. The free M0 tier is fine to launch; move to Flex when the database nears 512 MB.

## 3. Cloudflare R2 (photo storage)
1. **R2 → Create bucket** → `propflow-media-prod` (keep your dev bucket for local testing).
2. **Bucket → Settings → Custom Domains → Connect** → `media.yourdomain.com`. Use this instead of `r2.dev`, which is rate-limited and not meant for production traffic.
3. **R2 → Manage API tokens → Create Account API token** → *Object Read & Write* → only this bucket → copy the **Access Key ID** and **Secret Access Key**.

✅ `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_BUCKET`, the keys, and `S3_PUBLIC_URL=https://media.yourdomain.com`.

## 4. Redis (job queue)
1. redis.io → **Try free** → create a free database (region close to Mumbai if offered).
2. Copy the public endpoint and default-user password:
   `REDIS_URL=redis://default:PASSWORD@HOST:PORT`

✅ Keep it for steps 5 and 6. Don't use Upstash's pay-per-request plan: the queue polls constantly and it gets expensive.

## 5. Vercel (web app)
1. **Plan:** Vercel **Pro**. Hobby doesn't allow commercial use.
2. **Project → Settings → Functions → Region** → *Mumbai, India (bom1)*, close to your Atlas region.
3. **Settings → Environment Variables** (Production) → add everything marked *Vercel* in the [table below](#environment-variables). Generate new secrets for production; don't reuse your laptop's.
4. **Settings → Domains → Add** `yourdomain.com` and `www.yourdomain.com` (set `www` to redirect to the apex). Vercel shows the DNS records. In **Cloudflare → DNS** create them exactly, typically:
   - `A` `@` → `76.76.21.21`
   - `CNAME` `www` → `cname.vercel-dns.com`
   - Proxy status **DNS only** (grey cloud) for both, so Vercel can issue the SSL certificate.
5. **Deployments → Redeploy**. `NEXT_PUBLIC_*` variables only apply after a new build.

✅ `https://yourdomain.com/api/health` returns `{"status":"ok","db":"up"}`, and you can register an account and upload a photo.

> Leave `NEXT_PUBLIC_ROOT_DOMAIN` empty for now. Broker sites live at `yourdomain.com/<broker>`. Wildcard broker subdomains on Vercel require moving DNS to Vercel's nameservers; brokers who want their own domain use [custom domains](custom-domains.md).

## 6. Worker (Railway)
The worker processes WhatsApp photos, runs the AI and sends WhatsApp replies. Vercel can't run long-lived processes, so it runs on Railway.

1. railway.com → **New Project → Deploy from GitHub repo** → pick this repo. Name the service `worker`. `railway.json` tells Railway to build `Dockerfile.worker`.
2. **Variables** → add everything marked *Worker* in the table below.
3. **Settings** → if available, enable **Wait for CI**, so the worker only deploys after the GitHub checks pass.

✅ Railway logs show `PropFlow worker running: whatsapp-message-processing, …`.

## 7. Google login
1. console.cloud.google.com → create a project → **Google Auth Platform**:
   - **Branding:** app name, support email, homepage `https://yourdomain.com`, privacy `https://yourdomain.com/privacy`, terms `https://yourdomain.com/terms`, authorized domain `yourdomain.com`. Skip the logo; uploading one triggers a longer brand review.
   - **Audience:** External → **Publish app**. The default scopes (email, profile) need no verification.
   - **Clients → Create client → Web application**:
     - Authorized JavaScript origins: `https://yourdomain.com` (and `http://localhost:3000` for dev)
     - Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`)
2. Copy the Client ID and Client Secret → Vercel env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` → redeploy.

✅ **Continue with Google** on `/login` is enabled (it's greyed out while these are missing). Sign in with a Google account: new users land on onboarding to create their workspace.

## 8. WhatsApp (Meta) go-live
1. **Business verification:** business.facebook.com → Security Center → verify your business. This lifts messaging limits and is needed for your display name.
2. **Production number:** WhatsApp Manager → Phone numbers → **Add**. Use a number that is **not** active on the WhatsApp app (delete its WhatsApp account first), verify it by SMS or call, and submit the display name. Add a **payment method**.
3. **Permanent token:** Business Settings → System users → Admin user → assign your app and WhatsApp account (Full control) → **Generate token**, never expires, permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
4. **Publish the Meta app.** Meta only delivers real messages to published apps. Go to App settings → Basic:
   - Privacy Policy URL: `https://yourdomain.com/privacy`
   - Terms of Service URL: `https://yourdomain.com/terms`
   - User data deletion → Instructions URL: `https://yourdomain.com/privacy#data-deletion`
   - App icon: `public/brand/app-icon-1024.png` from this repo
   - Category: Business → then switch **App Mode to Live / Publish**.
5. **Webhook:** WhatsApp → Configuration → Callback URL `https://yourdomain.com/api/webhooks/whatsapp`, Verify token = your `WHATSAPP_VERIFY_TOKEN` → **Verify and save** → subscribe to **messages**.
6. **Template** (used when a broker hasn't messaged in 24 hours): WhatsApp Manager → Message templates → Create:
   - Name `property_draft_ready`, category **Utility**, language **English (`en`)**
   - Body: `Your property draft is ready: {{1}} in {{2}} ({{3}}). Review it before publishing.`
   - Button: *Visit website*, dynamic URL `https://yourdomain.com/dashboard/properties/{{1}}`
7. **Vercel and worker env:** set the real number's `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, the permanent token, `WHATSAPP_APP_SECRET` (required in production) and `WHATSAPP_VERIFY_TOKEN`. **Remove `WHATSAPP_PROVIDER=sandbox`** if you copied it from local.

✅ In the dashboard, open **Settings → WhatsApp** and send the `CONNECT` code from your phone. You get "✅ connected". Then send a property with photos; a draft appears within about 20 seconds with a "Property Draft Ready" reply.

**If messages don't arrive:**
- In the Vercel logs, `Rejected WhatsApp webhook with invalid signature` means `WHATSAPP_APP_SECRET` is wrong.
- No request at all means the app isn't Live, or the WhatsApp account isn't subscribed to your app. Subscribe it:
  `curl -X POST "https://graph.facebook.com/v25.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer <TOKEN>"`

## 9. OpenAI (optional)
platform.openai.com → API key → set a **monthly budget limit** → `AI_API_KEY` and `AI_MODEL=gpt-4.1-mini` on Vercel and the worker. Without a key, the built-in rules extractor is used.

## 10. GitHub Actions
`.github/workflows/ci-cd.yml` runs **typecheck, lint, tests (with a MongoDB service) and the production build** on every pull request and every push to `main`.

**Recommended setup:** Vercel and Railway deploy from GitHub on their own; CI guards `main`.
- GitHub → Settings → Branches → protect `main` → require the status check **Typecheck · Lint · Test · Build**, and merge through pull requests.

**Optional: deploy only after checks pass** (both deploys run from Actions):
1. Secrets (Settings → Secrets and variables → Actions):
   - `VERCEL_TOKEN`: vercel.com/account/tokens
   - `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`: from `.vercel/project.json` after running `npx vercel link` locally
   - `RAILWAY_TOKEN`: Railway project → Settings → Tokens
2. Variables: `DEPLOY_WEB_FROM_ACTIONS=true`, `DEPLOY_WORKER_FROM_ACTIONS=true`, `RAILWAY_WORKER_SERVICE=worker`.
3. Stop the platforms deploying on their own, to avoid double deploys:
   - Add `vercel.json` with `{ "git": { "deploymentEnabled": { "main": false } } }`. Preview deploys for pull requests keep working.
   - Disconnect the repo from the Railway service.

---

## Environment variables

| Variable | Vercel | Worker | Value |
|---|:-:|:-:|---|
| `DATABASE_URL` | ✓ | ✓ | Atlas string with `/propflow` |
| `NEXTAUTH_SECRET` | ✓ | ✓ | `openssl rand -base64 32` (new for prod) |
| `NEXT_PUBLIC_APP_URL` | ✓ | ✓ | `https://yourdomain.com` |
| `REDIS_URL` | ✓ | ✓ | Redis Cloud URL |
| `STORAGE_DRIVER` | ✓ | ✓ | `s3` |
| `S3_ENDPOINT`, `S3_REGION` (`auto`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | ✓ | ✓ | From R2 |
| `S3_PUBLIC_URL` | ✓ | ✓ | `https://media.yourdomain.com` |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_APP_SECRET` | ✓ | ✓ | From Meta |
| `WHATSAPP_VERIFY_TOKEN` | ✓ | | Random string, same as in Meta |
| `WHATSAPP_API_URL` | ✓ | ✓ | `https://graph.facebook.com/v25.0` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✓ | | From Google Cloud |
| `AI_API_KEY`, `AI_MODEL` | ✓ | ✓ | From OpenAI (optional) |
| `ADMIN_EMAILS` | ✓ | | Your email(s), for `/admin` |
| `BILLING_PROVIDER` | ✓ | | `mock` until Razorpay is integrated |
| `CUSTOM_DOMAIN_CNAME_TARGET` | ✓ | | `cname.vercel-dns.com` |

Never set in production: `WHATSAPP_PROVIDER=sandbox`, `ALLOW_TEST_BILLING=true`, `STORAGE_DRIVER=local`.

---

## Launch checklist
- [ ] `/api/health` → `db: up`
- [ ] Register with email; sign in with Google
- [ ] Add a property with a phone photo (upload works; photo loads from `media.yourdomain.com`)
- [ ] Publish → open the public link on a phone → **I'm Interested** opens WhatsApp with the property details → a lead appears in **Leads**
- [ ] WhatsApp: CONNECT code → property with photos → draft + "Draft Ready" reply → review → publish
- [ ] `/privacy` and `/terms` show your real company name. Set `siteConfig.legal` in `lib/config/site.ts`, and have both pages reviewed by a lawyer
- [ ] Billing page says online payments are coming soon. Test-mode upgrades are blocked in production until Razorpay is integrated

## Known limits at launch
- **Payments:** not integrated. Upgrade brokers manually (Atlas → `subscriptions`) or integrate Razorpay (`server/services/subscriptions/billing.provider.ts`).
- **Rate limiting:** per server instance. Fine for launch; move it to Redis before heavy traffic.
- **Custom broker domains:** the Vercel step is manual. See [custom-domains.md](custom-domains.md).
