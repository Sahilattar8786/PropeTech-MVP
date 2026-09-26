import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/legal-page";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses and protects personal data.`,
  alternates: { canonical: "/privacy" },
};

const { name, supportEmail, legal } = siteConfig;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          {legal.entityName} (&ldquo;{name}&rdquo;, &ldquo;we&rdquo;) provides software that helps real-estate brokers turn property details sent on WhatsApp into
          property listings. This policy explains what personal data we process, why, and the choices you have. It applies to our website, dashboard, public broker
          websites hosted by us, and our WhatsApp Business number.
        </p>
      </section>

      <section>
        <h2>Data we collect</h2>
        <ul>
          <li><strong>Account data</strong> — name, email address, business name, city, WhatsApp and phone numbers, and a securely hashed password. If you sign in with Google, we receive your name, email address and profile picture from Google.</li>
          <li><strong>Content brokers provide</strong> — property details, photos, descriptions and collections, including messages and photos brokers send to our WhatsApp Business number.</li>
          <li><strong>WhatsApp data</strong> — the sender&rsquo;s phone number, profile name, message content, media and delivery status for messages exchanged with our WhatsApp Business number.</li>
          <li><strong>Visitor activity on public listings</strong> — page views and clicks on the WhatsApp enquiry button. We store a one-way hash derived from IP address and browser details to count unique visitors and prevent abuse; we do not store the raw IP address with these records.</li>
          <li><strong>Cookies</strong> — a session cookie that keeps you signed in. We do not use advertising cookies.</li>
        </ul>
      </section>

      <section>
        <h2>How we use data</h2>
        <ul>
          <li>To provide the service: create and host listings and broker websites, process WhatsApp messages into draft listings, and send notifications on WhatsApp.</li>
          <li>To show brokers analytics about views and enquiries on their listings.</li>
          <li>To secure the service: authentication, rate limiting, fraud and abuse prevention, and audit logs.</li>
          <li>To provide support and communicate with you about your account.</li>
        </ul>
        <p className="mt-3">
          <strong>AI processing.</strong> Property text that brokers submit is processed by an AI service to extract details such as price, area and location. Brokers
          review every draft before it is published. We use AI providers under API terms that do not permit them to use this data to train their models by default.
        </p>
      </section>

      <section>
        <h2>Who we share data with</h2>
        <p>We do not sell personal data. We share it only with service providers that process it on our behalf:</p>
        <ul>
          <li>Cloud hosting and databases (e.g. Vercel, MongoDB Atlas, Redis hosting)</li>
          <li>File storage and content delivery (Cloudflare)</li>
          <li>Messaging (Meta Platforms — WhatsApp Business Platform)</li>
          <li>AI processing (OpenAI)</li>
          <li>Sign-in (Google), and payment processing when paid plans are billed</li>
        </ul>
        <p className="mt-3">Listings and broker profiles that a broker publishes are public by design. We may disclose data when required by law.</p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>
          We keep account data and content for as long as the account is active. Draft and deleted properties, WhatsApp messages and analytics records are deleted or
          anonymised when an account is closed, except where we must retain them to meet legal obligations.
        </p>
      </section>

      <section id="data-deletion" className="scroll-mt-20">
        <h2>Your rights and data deletion</h2>
        <p>
          You can view and update most of your data in the dashboard. To request a copy of your data, correction, or deletion of your account and all associated
          data — including data received through WhatsApp or Google sign-in — email{" "}
          <a href={`mailto:${supportEmail}?subject=Data%20deletion%20request`} className="underline underline-offset-4">{supportEmail}</a> from your registered email
          address. We confirm deletion within 30 days. You can also disconnect your WhatsApp number at any time from Settings → WhatsApp.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Data is encrypted in transit (HTTPS). Passwords are hashed, access to each broker&rsquo;s data is isolated from other accounts, and administrative actions are
          logged. No method of transmission or storage is completely secure, but we work to protect your data.
        </p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          We will post changes to this policy on this page and update the date above. Questions or complaints:{" "}
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">{supportEmail}</a>. This policy is governed by the laws of {legal.jurisdiction}.
        </p>
      </section>
    </LegalPage>
  );
}
