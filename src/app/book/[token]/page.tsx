export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { CustomerBooking } from "@/components/booking-link/customer-booking";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BookPage({ params }: PageProps) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("client_name, client_phone, product_model")
    .eq("booking_token", token)
    .maybeSingle<{ client_name: string; client_phone: string | null; product_model: string | null }>();

  if (!lead) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-surface">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">Invalid link</h1>
          <p className="text-sm text-text-muted mt-2">
            This booking link is not valid or has expired.
          </p>
        </div>
      </main>
    );
  }

  return (
    <CustomerBooking
      token={token}
      customerName={lead.client_name}
      customerPhone={lead.client_phone}
      product={lead.product_model}
    />
  );
}
