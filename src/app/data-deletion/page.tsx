import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Deletion — SA'DA H2O",
  description: "How to request deletion of your data from SA'DA H2O.",
};

/**
 * Public data-deletion instructions. Meta requires a data-deletion URL for apps
 * that handle user data. Kept outside auth (allowlisted in the middleware).
 */
export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-1">Data Deletion Request</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <p>
            You can ask <strong>SA&apos;DA H2O</strong> to delete the personal information we hold
            about you at any time.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">How to request deletion</h2>
            <p>Send us a deletion request using any of the following, from the phone number or account you contacted us with:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                Email{" "}
                <a href="mailto:support@sadawater.com" className="text-primary underline">
                  support@sadawater.com
                </a>{" "}
                with the subject &quot;Delete my data&quot;.
              </li>
              <li>Message us on WhatsApp, Facebook Messenger, or Instagram and ask us to delete your data.</li>
            </ul>
            <p className="mt-2">
              Please include the name and phone number you used so we can locate your records.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">What we delete</h2>
            <p>
              On a verified request we delete your contact details, address and location, message
              history, and booking records, except where we are legally required to retain certain
              records (for example, warranty or accounting obligations). We complete deletion within
              30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Related</h2>
            <p>
              See our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>{" "}
              for how we handle your information.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
