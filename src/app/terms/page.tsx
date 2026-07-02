import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — SA'DA H2O",
  description: "Terms of service for SA'DA H2O bookings and communications.",
};

/** Public terms of service. Kept outside auth (allowlisted in the middleware). */
export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-foreground/90">
          <p>
            These terms govern your use of <strong>SA&apos;DA H2O</strong> booking links and our
            communications with you over WhatsApp, Facebook Messenger, and Instagram.
          </p>

          <section>
            <h2 className="text-lg font-semibold mb-2">Our service</h2>
            <p>
              We sell, install, and service water-purification products. When you book through our
              links or message us, we collect the details needed to schedule and complete your
              installation or service visit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Bookings</h2>
            <p>
              Appointment times are subject to technician availability and may be rescheduled by
              agreement. Please provide accurate contact and location details so our technician can
              reach you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Communications</h2>
            <p>
              By contacting us on a messaging platform, you consent to receive replies and
              service-related messages from us on that platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Privacy</h2>
            <p>
              Your information is handled per our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Contact</h2>
            <p>
              Questions? Email{" "}
              <a href="mailto:support@sadawater.com" className="text-primary underline">
                support@sadawater.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
