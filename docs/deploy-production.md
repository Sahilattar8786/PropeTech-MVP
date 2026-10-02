# Deploying Propsora

Propsora runs as two environments from one repository and one Vercel project:

| | **Production** | **Staging** |
|---|---|---|
| Git branch | `main` | `staging` |
| URL | https://propsora.com (broker sites `<slug>.propsora.com`) | https://prop.sahilproject.ink |
| Vercel | Production environment | Preview environment + branch domain |
| Env file → command | `.env.production` → `npm run env:push` | `.env.staging` → `npm run env:push -- --staging` |
| Database | its own (e.g. `propsora`) | its own (e.g. `propsora-staging`) |
| Redis queue | its own | its own, or the same Redis with `QUEUE_PREFIX=staging` |
| Worker (Railway) | `production` environment, deploys `main` | `staging` environment, deploys `staging` |
| WhatsApp | real Meta number, webhook → propsora.com | sandbox (`WHATSAPP_PROVIDER=sandbox`) or a second test number |
| Search engines | indexed | never indexed (robots.txt, `X-Robots-Tag`, noindex meta), "Staging" badge |

Work flows `feature branch → staging → main`: merge into `staging`, test on prop.sahilproject.ink, then open a PR from `staging` to `main`. `env:push` refuses to push a staging file that shares production's database, queue or URL.

```
Customers & brokers ──► DNS ──► Vercel (web app, API, WhatsApp webhook)
                                   │        │         │
              MongoDB Atlas ◄──────┘        │         └──► Redis (job queue)
              Cloudflare R2 (photos) ◄──────┘                  │
Meta WhatsApp ──webhook──► Vercel       Railway worker ◄───────┘
                                        (photos, AI, WhatsApp replies)
```

---

## Moving production to propsora.com (one-time)

Until now production ran on prop.sahilproject.ink. Do these in order, so propsora.com works before the app starts linking to it.

1. **DNS → Vercel.** Wildcard broker subdomains (`<slug>.propsora.com`) need Vercel's nameservers.
   - Vercel → project → **Settings → Domains → Add** `propsora.com` (Production), then `www.propsora.com` (redirect to `propsora.com`) and `*.propsora.com`.
   - Namecheap → **Domain List → propsora.com → Nameservers → Custom DNS** → `ns1.vercel-dns.com`, `ns2.vercel-dns.com`. Namecheap's parking page and email forwarding stop; add MX records for `support@propsora.com` in Vercel DNS (Zoho Mail, ImprovMX or Google Workspace).
   - Prefer to keep Namecheap DNS? Use `A @ 76.76.21.21` and `CNAME www cname.vercel-dns.com`, and leave `NEXT_PUBLIC_ROOT_DOMAIN` empty. Broker sites are then `propsora.com/<slug>`.
2. **Move prop.sahilproject.ink to staging.** Create the branch (`git switch -c staging main && git push -u origin staging`). In Vercel → **Settings → Domains** → `prop.sahilproject.ink` → **Edit** → **Git Branch: `staging`**. Do the same for `*.prop.sahilproject.ink` if it's added.
3. **Production variables.** `.env.production` has `NEXT_PUBLIC_APP_URL=https://propsora.com`, `NEXT_PUBLIC_ROOT_DOMAIN=propsora.com` and `APP_ENV=production`. Run `npm run env:push -- --railway`.
4. **Staging variables.** `cp .env.example .env.staging` → a **new** Atlas database, a separate Redis (or `QUEUE_PREFIX=staging`), `NEXT_PUBLIC_APP_URL=https://prop.sahilproject.ink`, `NEXT_PUBLIC_ROOT_DOMAIN=prop.sahilproject.ink`, `APP_ENV=staging`, a new `NEXTAUTH_SECRET`, `WHATSAPP_PROVIDER=sandbox`, `ALLOW_TEST_BILLING=true`. Run `npm run env:push -- --staging --railway`.
5. **Railway.** Project → **Environments → New → `staging`**. Point the `worker` service in `staging` at the `staging` branch; `production` stays on `main`.
6. **Google login** (step 7 below): add `https://propsora.com` to the authorized origins and `https://propsora.com/api/auth/callback/google` to the redirect URIs. Keep the prop.sahilproject.ink entries for staging.
7. **Meta** (step 8 below): callback URL `https://propsora.com/api/webhooks/whatsapp`, Privacy/Terms URLs on propsora.com, new app icon (`public/brand/app-icon-1024.png`), display name **Propsora** (Meta reviews it), and the `property_draft_ready` button URL `https://propsora.com/dashboard/properties/{{1}}`.
8. **Deploy** `main` (push or Vercel → Redeploy). `NEXT_PUBLIC_*` values only apply after a new build.

✅ `https://propsora.com/api/health` → `{"status":"ok","db":"up"}`, a broker site opens at `https://<slug>.propsora.com`, and `https://prop.sahilproject.ink/robots.txt` shows `Disallow: /` and a "Staging" badge.

> Listing and broker URLs are built from the environment, so every existing listing moves to propsora.com automatically. Links already shared on prop.sahilproject.ink will open staging, which has a different database. Photos keep loading from `media.sahilproject.ink`, because stored image URLs point there.

---

## First-time setup, step by step

Do the steps in order. Each ends with a check.

---

## 1. Domain DNS
propsora.com uses **Vercel's nameservers** (see *Moving production to propsora.com* above), because wildcard broker subdomains `*.propsora.com` only work that way on Vercel. Cloudflare still hosts `sahilproject.ink`, which serves staging and the photo CDN (`media.sahilproject.ink`). R2 custom domains must live on a Cloudflare zone.

✅ `dig +short NS propsora.com` shows `ns1.vercel-dns.com` / `ns2.vercel-dns.com`.

## 2. MongoDB Atlas (production database)
1. Use a **separate database for production**. The simplest way is the database name `propsora` in the connection string (and `propsora-staging` for staging). Your laptop currently uses `test`; keep dev and prod data apart.
2. **Database Access** → create a user for production with a long random password.
3. **Network Access** → `0.0.0.0/0` (Vercel and Railway don't have fixed IPs).
4. Connection string:
   `mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/propsora?retryWrites=true&w=majority`

✅ Keep the string for step 5. The free M0 tier is fine to launch; move to Flex when the database nears 512 MB.

## 3. Cloudflare R2 (photo storage)
1. **R2 → Create bucket** → `propsora-media-prod` (keep your dev bucket for local testing).
2. **Bucket → Settings → Custom Domains → Connect** → a hostname on a Cloudflare zone, here `media.sahilproject.ink`. Use this instead of `r2.dev`, which is rate-limited and not meant for production traffic. Stored photo URLs include this host, so don't change it later without rewriting them (`scripts/rewrite-media-urls.mjs`).
3. **R2 → Manage API tokens → Create Account API token** → *Object Read & Write* → only this bucket → copy the **Access Key ID** and **Secret Access Key**.

✅ `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, `S3_BUCKET`, the keys, and `S3_PUBLIC_URL=https://media.sahilproject.ink`.

## 4. Redis (job queue)
1. redis.io → **Try free** → create a free database (region close to Mumbai if offered).
2. Copy the public endpoint and default-user password:
   `REDIS_URL=redis://default:PASSWORD@HOST:PORT`

✅ Keep it for steps 5 and 6. Don't use Upstash's pay-per-request plan: the queue polls constantly and it gets expensive.

## 5. Vercel (web app)
1. **Plan:** Vercel **Pro**. Hobby doesn't allow commercial use.
2. **Project → Settings → Functions → Region** → *Mumbai, India (bom1)*, close to your Atlas region.
3. **Environment variables.** They're stored in the Vercel project and apply to every deploy automatically; you only set them again for a new project or when a value changes. Push them all with one command:
   ```bash
   cp .env.example .env.production   # fill in production values (gitignored, never commit it)
   npx vercel link                   # once: pick this Vercel project
   npm run env:push -- --dry-run     # preview
   npm run env:push                  # add --railway to also update the worker
   ```
   The script refuses localhost URLs and sandbox or test settings. Generate new secrets for production; don't reuse your laptop's. You can also paste the whole file into **Settings → Environment Variables** (Vercel imports all lines at once).
4. **Settings → Domains → Add** `propsora.com`, `www.propsora.com` (redirect to the apex) and `*.propsora.com`. With Vercel nameservers the records and certificates are created for you. Staging's `prop.sahilproject.ink` is connected to the `staging` Git branch (Cloudflare record **DNS only**, grey cloud).
5. **Deployments → Redeploy**. `NEXT_PUBLIC_*` variables only apply after a new build.

✅ `https://propsora.com/api/health` returns `{"status":"ok","db":"up"}`, and you can register an account and upload a photo.

> With `NEXT_PUBLIC_ROOT_DOMAIN=propsora.com`, broker sites live at `<broker>.propsora.com`, which needs `*.propsora.com` on Vercel (Vercel nameservers). Without it they live at `propsora.com/<broker>`. Brokers who want their own domain use [custom domains](custom-domains.md).

## 6. Worker (Railway)
The worker processes WhatsApp photos, runs the AI and sends WhatsApp replies. Vercel can't run long-lived processes, so it runs on Railway.

1. railway.com → **New Project → Deploy from GitHub repo** → pick this repo. Name the service `worker`. `railway.json` tells Railway to build `Dockerfile.worker`.
2. **Variables** → add everything marked *Worker* in the table below.
3. **Settings** → if available, enable **Wait for CI**, so the worker only deploys after the GitHub checks pass.

✅ Railway logs show `Propsora worker running (production, prefix "bull"): whatsapp-message-processing, …`.

## 7. Google login
1. console.cloud.google.com → create a project → **Google Auth Platform**:
   - **Branding:** app name, support email, homepage `https://propsora.com`, privacy `https://propsora.com/privacy`, terms `https://propsora.com/terms`, authorized domain `propsora.com`. Skip the logo; uploading one triggers a longer brand review.
   - **Audience:** External → **Publish app**. The default scopes (email, profile) need no verification.
   - **Clients → Create client → Web application**:
     - Authorized JavaScript origins: `https://propsora.com` (and `http://localhost:3000` for dev)
     - Authorized redirect URIs: `https://propsora.com/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google`)
2. Copy the Client ID and Client Secret → Vercel env `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` → redeploy.

✅ **Continue with Google** on `/login` is enabled (it's greyed out while these are missing). Sign in with a Google account: new users land on onboarding to create their workspace.

## 8. WhatsApp (Meta) go-live
1. **Business verification:** business.facebook.com → Security Center → verify your business. This lifts messaging limits and is needed for your display name.
2. **Production number:** WhatsApp Manager → Phone numbers → **Add**. Use a number that is **not** active on the WhatsApp app (delete its WhatsApp account first), verify it by SMS or call, and submit the display name. Add a **payment method**.
3. **Permanent token:** Business Settings → System users → Admin user → assign your app and WhatsApp account (Full control) → **Generate token**, never expires, permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
4. **Publish the Meta app.** Meta only delivers real messages to published apps. Go to App settings → Basic:
   - Privacy Policy URL: `https://propsora.com/privacy`
   - Terms of Service URL: `https://propsora.com/terms`
   - User data deletion → Instructions URL: `https://propsora.com/privacy#data-deletion`
   - App icon: `public/brand/app-icon-1024.png` from this repo
   - Category: Business → then switch **App Mode to Live / Publish**.
5. **Webhook:** WhatsApp → Configuration → Callback URL `https://propsora.com/api/webhooks/whatsapp`, Verify token = your `WHATSAPP_VERIFY_TOKEN` → **Verify and save** → subscribe to **messages**.
6. **Template** (used when a broker hasn't messaged in 24 hours): WhatsApp Manager → Message templates → Create:
   - Name `property_draft_ready`, category **Utility**, language **English (`en`)**
   - Body: `Your property draft is ready: {{1}} in {{2}} ({{3}}). Review it before publishing.`
   - Button: *Visit website*, dynamic URL `https://propsora.com/dashboard/properties/{{1}}`
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
| `DATABASE_URL` | ✓ | ✓ | Atlas string with `/propsora` (staging: `/propsora-staging`) |
| `NEXTAUTH_SECRET` | ✓ | ✓ | `openssl rand -base64 32` (new for prod) |
| `NEXT_PUBLIC_APP_URL` | ✓ | ✓ | `https://propsora.com` (staging: `https://prop.sahilproject.ink`) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | ✓ | ✓ | `propsora.com` (needs `*.propsora.com` on Vercel) |
| `APP_ENV` | ✓ | ✓ | `production` / `staging` |
| `QUEUE_PREFIX` | ✓ | ✓ | Only if staging shares production's Redis: `staging` |
| `REDIS_URL` | ✓ | ✓ | Redis Cloud URL |
| `STORAGE_DRIVER` | ✓ | ✓ | `s3` |
| `S3_ENDPOINT`, `S3_REGION` (`auto`), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | ✓ | ✓ | From R2 |
| `S3_PUBLIC_URL` | ✓ | ✓ | `https://media.sahilproject.ink` |
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
- [ ] Add a property with a phone photo (upload works; photo loads from `media.sahilproject.ink`)
- [ ] Publish → open the public link on a phone → **I'm Interested** opens WhatsApp with the property details → a lead appears in **Leads**
- [ ] WhatsApp: CONNECT code → property with photos → draft + "Draft Ready" reply → review → publish
- [ ] `/privacy` and `/terms` show your real company name. Set `siteConfig.legal` in `lib/config/site.ts`, and have both pages reviewed by a lawyer
- [ ] Billing page says online payments are coming soon. Test-mode upgrades are blocked in production until Razorpay is integrated

## Known limits at launch
- **Payments:** not integrated. Upgrade brokers manually (Atlas → `subscriptions`) or integrate Razorpay (`server/services/subscriptions/billing.provider.ts`).
- **Rate limiting:** per server instance. Fine for launch; move it to Redis before heavy traffic.
- **Custom broker domains:** the Vercel step is manual. See [custom-domains.md](custom-domains.md).
