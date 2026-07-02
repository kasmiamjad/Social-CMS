import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — SA'DA H2O",
  description: "How SA'DA H2O collects, uses, and protects your information.",
};

/**
 * Public privacy policy. Must stay outside auth (allowlisted in proxy/middleware)
 * so it's reachable without login — Meta requires a publicly valid URL to take
 * the app Live.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <p>
            This Privacy Policy explains how <strong>SA&apos;DA H2O</strong> (&quot;we&quot;,
            &quot;us&quot;) collects, uses, and protects information when you contact us or book a
            water-purifier installation or service. By messaging us or using our booking links, you
            agree to this policy.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">Information we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Contact details you provide: name, phone number, and email address.</li>
              <li>Installation details: your address and GPS location (to send a technician).</li>
              <li>
                Messages and media you send us via WhatsApp, Facebook Messenger, or Instagram, and
                our replies.
              </li>
              <li>Booking, product, service, and warranty information related to your order.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How we use your information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To schedule, confirm, and manage your installation and service visits.</li>
              <li>To respond to your enquiries and provide customer support.</li>
              <li>To send you booking confirmations, reminders, and service updates.</li>
              <li>To manage your product warranty and after-sales service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Messaging platforms</h2>
            <p>
              We communicate with you through Meta platforms (WhatsApp, Facebook Messenger, and
              Instagram). Your use of those platforms is also governed by Meta&apos;s own terms and
              privacy policies. We only use messaging to serve your enquiry, booking, and support
              needs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">How we share information</h2>
            <p>
              We do not sell your personal information. We share it only as needed to provide our
              service — for example, with the technician assigned to your installation, or with
              service providers that help us operate (such as messaging and hosting providers) — and
              where required by law.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Data retention</h2>
            <p>
              We keep your information for as long as needed to provide our services, honour
              warranties, and meet legal or accounting obligations, after which it is deleted or
              anonymised.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Your rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal information. To
              delete your data, see our{" "}
              <Link href="/data-deletion" className="text-primary underline">
                Data Deletion instructions
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Security</h2>
            <p>
              We use reasonable technical and organisational measures to protect your information.
              No method of transmission or storage is completely secure, but we work to safeguard
              your data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Children</h2>
            <p>Our services are intended for adults and are not directed at children under 18.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Changes to this policy</h2>
            <p>
              We may update this policy from time to time. The latest version will always be
              available at this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact us</h2>
            <p>
              For any privacy questions or requests, contact SA&apos;DA H2O at{" "}
              <a href="mailto:support@sadawater.com" className="text-primary underline">
                support@sadawater.com
              </a>{" "}
              or via our website{" "}
              <a
                href="https://h2o.sadawater.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                h2o.sadawater.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
