# Custom domains — support & developer guide

A broker on the **Business plan** can show their PropFlow website on their own domain:

| Before | After |
|---|---|
| `propflow.in/amanbrokers/property/2bhk-baner` | `www.amanbroker.com/property/2bhk-baner` |

Once connected, every link PropFlow generates for that broker (share links, the WhatsApp enquiry link, SEO canonical URLs, the sitemap) uses their domain. Old PropFlow links keep working.

---

## Part A — Support runbook

### Who can connect a domain
- The **Business** plan only. Free and Pro brokers see an upgrade prompt on **Settings → Domain**.
- The broker must **own the domain** and be able to edit its DNS (at GoDaddy, Hostinger, BigRock, Namecheap, Cloudflare, etc.). PropFlow doesn't sell domains.
- Recommend **`www.`** (e.g. `www.amanbroker.com`). Many registrars can't point a bare domain (`amanbroker.com`) with a CNAME. The broker can forward `amanbroker.com` → `www.amanbroker.com` in their registrar.

### Who does what
Adding the domain to our hosting (Vercel) is a **manual ops step** until automation ships (see Part B).

| Step | Who |
|---|---|
| 1. Broker adds the domain in PropFlow | Broker (support can guide) |
| 2. Add the domain to the Vercel project | **Ops/Dev** (needs Vercel access) |
| 3. Broker adds 2 DNS records at their registrar | Broker (support guides) |
| 4. Click **Verify** in PropFlow | Broker or support |

### Step by step

**1. Broker adds the domain in PropFlow**
Dashboard → **Settings → Domain** → type `www.amanbroker.com` → **Add**. PropFlow shows two DNS records:

| Type | Name | Value | Purpose |
|---|---|---|---|
| TXT | `_propflow.www.amanbroker.com` | `propflow-verify=…` (unique per domain) | Proves the broker owns the domain |
| CNAME | `www.amanbroker.com` | `cname.vercel-dns.com` | Sends visitors to PropFlow |

**2. Ops adds the domain in Vercel**
Vercel → project → **Settings → Domains → Add Domain** → enter exactly the same hostname (`www.amanbroker.com`) → Production.
- If Vercel offers to add `amanbroker.com` redirecting to `www`, accept.
- If Vercel shows a **different CNAME value** than PropFlow, give the broker **Vercel's value**. Tell dev so they can update `CUSTOM_DOMAIN_CNAME_TARGET`.

**3. Broker adds the DNS records**
At most registrars the **Host/Name** field is only the part *before* the domain, because the registrar adds the domain itself:

| Record | Host / Name field | Value |
|---|---|---|
| CNAME | `www` | `cname.vercel-dns.com` |
| TXT | `_propflow.www` | `propflow-verify=…` (copy from PropFlow) |

- **Cloudflare DNS:** set the CNAME's proxy status to **DNS only** (grey cloud) so Vercel can issue the SSL certificate.
- Delete any **other records on `www`** (an old A record or a parked-page CNAME). They conflict.
- DNS usually updates in 5–30 minutes. It can take up to 24 hours at some registrars.

**4. Verify**
Once Vercel shows **Valid Configuration**, click **Verify** in PropFlow → status becomes **Verified**.
The domain starts working within about **1 minute**. Existing listing pages show the new links within **5 minutes** (page cache).

**5. Test**
Open `https://www.amanbroker.com` → the broker's website. Open a listing → the URL stays on their domain. The padlock shows a valid certificate.

### Checking status yourself
| What | How |
|---|---|
| CNAME in place? | `dig +short CNAME www.amanbroker.com` → `cname.vercel-dns.com.` (or use dnschecker.org) |
| TXT in place? | `dig +short TXT _propflow.www.amanbroker.com` → `"propflow-verify=…"` |
| PropFlow mapping active? | Open `https://<our-app-url>/api/domains/resolve?host=www.amanbroker.com` → `{"slug":"amanbrokers"}`. `{"slug":null}` = not verified yet |
| Hosting/SSL OK? | Vercel → project → Domains → the domain shows **Valid Configuration** |

### Troubleshooting
| Symptom | Likely cause | Fix |
|---|---|---|
| **Verify** stays "Not verified yet" | TXT not visible yet, or entered with the full name | Host must be `_propflow.www`, not `_propflow.www.amanbroker.com` (that becomes `…amanbroker.com.amanbroker.com`). Wait, then Verify again |
| "This domain is already connected" | The same hostname is on another PropFlow account | Check `/admin`. Remove it from the old account first |
| "Custom domains are available on the Business plan" | Broker isn't on Business | Upgrade in **Settings → Billing** |
| Vercel shows "Invalid Configuration" | Wrong/extra DNS records, or Cloudflare proxy on | Only one CNAME on `www`. Cloudflare: DNS only |
| Browser shows an SSL/certificate warning | Certificate not issued yet, or a CAA record blocks it | Wait ~10 min after Vercel shows Valid. If the domain has CAA records, they must allow Let's Encrypt |
| Domain opens but shows the PropFlow homepage or "Page not found" | Not verified in PropFlow, or verified < 1 minute ago | Check the `/api/domains/resolve` link above. Verify again |
| A single listing shows "Page not found" | That property is a draft or delisted | Publish it in the dashboard |
| Broker opens `www.amanbroker.com/dashboard` and lands on PropFlow | By design | The dashboard and login always live on the main PropFlow site |
| Bare `amanbroker.com` doesn't work | Only `www` was connected | Registrar forwarding `amanbroker.com` → `www.amanbroker.com`, or add the bare domain in Vercel too (A record `76.76.21.21`, or the value Vercel shows) |

### Removing a domain
Broker: **Settings → Domain → Remove**. Their links switch back to the PropFlow address immediately. Ops: remove the same domain from the Vercel project. The broker can then delete the DNS records.

### Message template for brokers
> Hi {name}, to connect **{domain}** to your PropFlow website, please add these two records in your domain's DNS settings ({registrar}):
> 1. **CNAME** — Host: `www` — Value: `cname.vercel-dns.com`
> 2. **TXT** — Host: `_propflow.www` — Value: `{verification value from Settings → Domain}`
>
> Once added (usually 5–30 minutes), go to **Settings → Domain** and click **Verify**. Your listings will then open on {domain}. Reply here if you'd like us to check it for you.

---

## Part B — Developer reference

### How a request is served
1. A visitor opens `https://www.amanbroker.com/property/2bhk-baner`.
2. **Vercel** accepts the host (the domain is added to the project) and terminates SSL.
3. **`proxy.ts`** sees an unknown host (not the app host, not `*.NEXT_PUBLIC_ROOT_DOMAIN`). It calls `GET {NEXT_PUBLIC_APP_URL}/api/domains/resolve?host=…` and caches the answer, positive or negative, for **60 s** per instance.
4. Slug found → rewrite `/`, `/property/*` and `/collections/*` to `/{slug}/…`. Other paths redirect to `NEXT_PUBLIC_APP_URL`.
5. The public pages render as usual (ISR, `revalidate = 300`).

### Code map
| Concern | File |
|---|---|
| Add / verify / remove, TXT check, entitlement, audit log | `server/services/domains/domain.service.ts` |
| Host → slug lookup used by the proxy | `app/api/domains/resolve/route.ts` |
| Host routing | `proxy.ts` |
| URL building (custom domain → subdomain → path) | `lib/urls.ts` (`brokerBaseUrl`) |
| UI | `features/settings/domain-manager.tsx`, `app/dashboard/settings/domain/page.tsx` |
| Server actions | `features/settings/actions.ts` |
| Hostname validation | `lib/validation/settings.ts` (`domainSchema`) |
| Data | `Domain` model (`server/models/misc.ts`), `Broker.customDomain` (verified hostname, denormalised) |
| Plan gate | `lib/config/plans.ts` → `entitlements.customDomain` (Business only) |

### Verification
- The TXT record is `_propflow.<hostname>` with value `propflow-verify=<token>` (24 random hex chars per domain).
- Verification runs `dns.resolveTxt` when the broker clicks **Verify**. There's no background re-check.
- On success: `Domain.status = verified`, `Broker.customDomain = hostname`. Removing clears both.

### Environment
| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_URL` | **Required.** Main app URL. The proxy calls it to resolve custom domains; dashboard paths on custom domains redirect here |
| `CUSTOM_DOMAIN_CNAME_TARGET` | CNAME value shown to brokers (default `cname.vercel-dns.com`) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Optional. Enables `{slug}.{root}` subdomains; hosts under it are never treated as custom domains |

### Known gaps
1. **Vercel registration is manual.** Planned: on add/remove, call the Vercel API (add domain to project, remove, read its config/verification status). Show Vercel's exact records and a live "SSL active" status in the Domain page. Needs `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`.
2. **No limit on domains per workspace.** Business can add several. Add a `maxCustomDomains` entitlement if pricing includes only one.
3. **Plan downgrade doesn't disconnect the domain.** Decide the policy (grace period, then remove) and enforce it in `changePlan`.
4. **The proxy's 60 s negative cache** means a freshly verified domain can take up to a minute per server instance.

### Costs (for ops)
| Item | Cost |
|---|---|
| Vercel (domains + SSL) | Included in Vercel Pro — no per-domain fee (soft limit 100,000 domains per project) |
| Alternative: Cloudflare for SaaS | First 100 hostnames free, then $0.10 per hostname per month |
| Domain registration | Paid by the broker |
