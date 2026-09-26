# PropFlow — WhatsApp → AI → Property Listings

Multi-tenant SaaS for Indian real-estate brokers. Brokers send property details and photos on WhatsApp; PropFlow turns them into draft listings with AI, the broker reviews and publishes, and customers enquire back on WhatsApp with the property's context.

```
Broker WhatsApp → Webhook → Queue → Media → AI extraction & enrichment → Draft
→ Broker review → Publish → Broker website / listing page → Customer → WhatsApp lead
```

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · React Hook Form + Zod · Auth.js v5 (credentials + Google) · MongoDB + Mongoose · BullMQ + Redis · OpenAI-compatible AI API · Meta WhatsApp Cloud API · S3-compatible storage (aws4fetch) · sharp.

## Quick start

Requirements: Node ≥ 22.9, MongoDB. Redis, WhatsApp, OpenAI and S3 are optional in development.

```bash
cp .env.example .env.local        # set DATABASE_URL and NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run dev                       # http://localhost:3000
npm run seed                      # optional: demo workspace (demo@propflow.local / demo12345)
```

Without extra credentials the app runs fully locally:

| Integration | Without credentials | With credentials |
|---|---|---|
| AI | Deterministic **rules** provider (offline extraction, fact-only template copy) | `AI_API_KEY` → OpenAI (strict JSON schema output) |
| WhatsApp | **Sandbox** provider + in-app simulator (Dashboard → WhatsApp) that posts real Meta-format payloads to the real webhook | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` → Meta Cloud API |
| Queue | In-process driver (async, retries, de-dupe) | `REDIS_URL` → BullMQ; run `npm run worker` |
| Storage | Local disk (`.storage/`, served by `/media/*`) | `STORAGE_DRIVER=s3` + `S3_*` |
| Billing | Mock provider (plans switch instantly, "test mode") | Razorpay provider stub is ready to implement |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | BullMQ workers for all queues (needs `REDIS_URL`) |
| `npm run seed` | Demo broker, properties and a collection via the real services |
| `npm test` | Vitest: AI extraction & grounding, WhatsApp link, webhook security, lifecycle, tenant isolation (needs local MongoDB) |
| `npm run typecheck` / `lint` | TypeScript / ESLint |

## Try the core flow

1. **Register** at `/register` → creates User → Tenant → Broker profile (slug from business name, e.g. `rehanbrokers`) → 14-day Pro trial.
2. **Connect WhatsApp**: Settings → WhatsApp shows a `CONNECT <code>`. Send it from your phone to the business number (or use the sandbox simulator in the WhatsApp inbox). The webhook links that number to your workspace.
3. **Send a property** (text + photos) on WhatsApp. After a short batching window the draft appears in the inbox and you get a "Property Draft Ready" reply with a **Review Property** button. Or use **Add Property** to paste a message and upload photos.
4. **Review** — every field is editable; AI-filled fields carry an *AI Generated* badge until you change them. **Publish** assigns an ID (e.g. `REH-1001`), a slug, and a public URL.
5. **Share** the listing; customer taps **I'm Interested — WhatsApp Broker** → WhatsApp opens with the property's title, location, price, ID and link, and a lead is recorded.

## Architecture

```
app/                 routes (marketing, (auth), dashboard, [brokerSlug] public sites, api/*)
features/<area>/     UI + Server Actions per feature (properties, whatsapp, collections, settings…)
components/          shadcn/ui primitives + shared components (WhatsAppButton, badges…)
lib/                 client-safe domain types, formatting, Zod schemas, URL builders
server/
  models/            Mongoose models (every tenant-owned schema gets tenantId via a plugin)
  auth/              session helpers, TenantContext, RBAC
  services/
    ai/              property-extraction / -validation / -enrichment services + providers
    whatsapp/        provider abstraction (Meta, sandbox), webhook, message batching, media, templates, inbox
    queue/           queue facade, BullMQ + in-process drivers, job processors
    properties/ collections/ leads/ analytics/ subscriptions/ domains/ storage/ media/ notifications/ audit/ tenants/
workers/             BullMQ worker entrypoint
proxy.ts             subdomain / custom-domain rewrites + optimistic auth redirect
```

**Tenant isolation** — services take a `TenantContext` and scope every query by `tenantId`; image URLs attached to a property must belong to the tenant; public reads resolve the tenant from the broker slug. Covered by `tests/tenant-isolation.test.ts`.

**AI safety** — the pipeline is extraction → *grounding* → enrichment. Grounding removes any price, area, BHK, parking, furnishing, amenity, pincode, locality or city that can't be traced to the broker's own words (city may be inferred only when the locality belongs to exactly one known city). LLM copy is rejected — and replaced by fact-only template copy — if it mentions numbers not in the facts or unsupported claims (RERA, possession, legal/ownership, floor, facing, builder/project, nearby landmarks, views, amenities). Drafts are never auto-published.

**WhatsApp webhook** — `GET` verifies `hub.verify_token`; `POST` checks `X-Hub-Signature-256` (`WHATSAPP_APP_SECRET`), identifies the tenant by the sender's connected number, stores the message keyed by the unique WhatsApp message id (retries are idempotent), and queues processing. Bursts (text + several photos) are grouped into one draft. Media is downloaded, validated (decoded with sharp, size-limited), stored privately, then optimised to WebP in our own storage — listings never reference WhatsApp URLs. Failed media/AI jobs surface as *Retry* actions in the dashboard.

**Public URLs** (`lib/urls.ts`) — verified custom domain → `{slug}.{NEXT_PUBLIC_ROOT_DOMAIN}` → `{APP_URL}/{slug}`. Listing and collection pages are ISR (5 min) and revalidated on publish/edit/status change.

**Analytics** — `trackEvent(name, props)` enqueues events and fans out to pluggable sinks (MongoDB by default). The browser reports only whitelisted events via `navigator.sendBeacon` to `/api/track`.

## Production notes

**Step-by-step go-live guide:** [docs/deploy-production.md](docs/deploy-production.md) (Vercel, Railway worker via `Dockerfile.worker`, Atlas, Cloudflare R2/DNS, Google login, WhatsApp, GitHub Actions). Custom broker domains: [docs/custom-domains.md](docs/custom-domains.md).

- Set `REDIS_URL` and run `npm run worker` as a long-running process. The in-process queue driver is for development; serverless platforms don't keep timers alive after a response, so WhatsApp processing needs the worker there.
- Use `STORAGE_DRIVER=s3` on serverless/ephemeral hosts (local disk isn't persistent) and set `S3_PUBLIC_URL` so `next/image` allows the bucket/CDN host.
- Set `WHATSAPP_APP_SECRET` (required in production for the Meta provider) and `WHATSAPP_VERIFY_TOKEN`; point the Meta webhook at `{APP_URL}/api/webhooks/whatsapp`. Outside the 24-hour window the broker notification uses the `property_draft_ready` template, which must be approved in Meta.
- Broker subdomains need a wildcard DNS record and `NEXT_PUBLIC_ROOT_DOMAIN`. Custom domains are verified with a TXT record (`_propflow.<domain>`) and resolved by the proxy.
- The rate limiter is in-memory per instance; move it to Redis when running multiple instances.
- `ADMIN_EMAILS` grants access to `/admin` (platform overview).
