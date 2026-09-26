import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/features/legal/legal-page";
import { siteConfig } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms for using ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
};

const { name, supportEmail, legal } = siteConfig;

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <p>
          These terms govern your use of {name}, provided by {legal.entityName}. By creating an account or using the service you agree to them. If you use {name} on
          behalf of a business, you accept these terms for that business.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Provide accurate information and keep your password secure. You are responsible for activity on your account.</li>
          <li>Only connect WhatsApp numbers that you own or are authorised to use.</li>
        </ul>
      </section>

      <section>
        <h2>Your listings and content</h2>
        <ul>
          <li>You are responsible for the accuracy and legality of every listing you publish, including price, area, availability, and any regulatory registration such as RERA where applicable.</li>
          <li>AI-generated drafts are suggestions. Review every draft before publishing; {name} does not verify property facts.</li>
          <li>Only upload photos and content you have the right to use. You keep ownership of your content and grant us a licence to host, process and display it to operate the service.</li>
          <li>Do not publish misleading, discriminatory, unlawful or spam content, or use the service to send unsolicited messages.</li>
        </ul>
      </section>

      <section>
        <h2>Plans and billing</h2>
        <p>
          Plan features and limits are described on our{" "}
          <Link href="/#pricing" className="underline underline-offset-4">pricing page</Link>. Paid plans renew each billing period until cancelled. Prices may exclude
          applicable taxes such as GST. If you downgrade, features not included in your new plan (such as custom domains) may stop working.
        </p>
      </section>

      <section>
        <h2>Availability and third-party services</h2>
        <p>
          The service relies on third parties such as Meta (WhatsApp), cloud hosting and AI providers. We work to keep {name} available but do not guarantee
          uninterrupted service, and we are not responsible for outages or policy changes of third-party platforms.
        </p>
      </section>

      <section>
        <h2>Suspension and termination</h2>
        <p>
          You can close your account at any time by contacting us. We may suspend or terminate accounts that breach these terms or put the service or other users at
          risk. After closure we delete your data as described in our <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          The service is provided &ldquo;as is&rdquo;. To the extent permitted by law, {legal.entityName} is not liable for indirect or consequential losses, and our
          total liability is limited to the fees you paid in the three months before the claim.
        </p>
      </section>

      <section>
        <h2>Changes, law and contact</h2>
        <p>
          We may update these terms and will post changes on this page. These terms are governed by the laws of {legal.jurisdiction}. Contact:{" "}
          <a href={`mailto:${supportEmail}`} className="underline underline-offset-4">{supportEmail}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
