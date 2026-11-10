import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) mismatch |= (a[i] || 0) ^ (b[i] || 0);
  return mismatch === 0;
};

const asDate = (value: unknown): string | null => typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";
  const supplied = req.headers.get("asaas-access-token") || "";
  if (expected.length < 32 || !constantTimeEqual(expected, supplied)) return json({ error: "Not found" }, 404);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Billing receiver is not configured" }, 503);
  let event: any;
  try { event = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const eventId = String(event?.id || "").trim();
  const eventType = String(event?.event || "").trim();
  if (!eventId || !eventType) return json({ error: "Missing event ID or type" }, 400);

  const subscription = event?.subscription || {};
  const payment = event?.payment || {};
  const supported = new Set([
    "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED",
    "PAYMENT_CREATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED",
  ]);
  if (!supported.has(eventType)) return json({ received: true, ignored: true });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (eventType === "SUBSCRIPTION_INACTIVATED" || eventType === "SUBSCRIPTION_DELETED") {
    const providerSubscriptionId = String(subscription.id || payment.subscription || "").trim();
    if (!providerSubscriptionId) return json({ received: true, ignored: true, reason: "missing_subscription_id" });
    const { data: linkedSubscription, error: lookupError } = await admin
      .from("arena_subscriptions")
      .select("id")
      .eq("billing_provider", "ASAAS")
      .eq("external_subscription_id", providerSubscriptionId)
      .maybeSingle();
    if (lookupError) {
      console.error("Asaas subscription event lookup failed", lookupError.message);
      return json({ error: "Event processing failed" }, 500);
    }
    // A delayed deletion event from an old recurrence must not cancel a
    // subscription that has already migrated to one-off payments.
    if (!linkedSubscription) return json({ received: true, ignored: true, reason: "stale_subscription_event" });
  }
  const { data, error } = await admin.rpc("process_asaas_billing_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_provider_subscription_id: String(payment.subscription || subscription.id || "") || null,
    p_provider_payment_id: String(payment.id || "") || null,
    p_provider_customer_id: String(payment.customer || subscription.customer || "") || null,
    p_external_reference: String(payment.externalReference || subscription.externalReference || "") || null,
    p_amount_cents: Math.max(0, Math.round(Number(payment.value ?? subscription.value ?? 0) * 100)),
    p_due_date: asDate(payment.dueDate || subscription.nextDueDate),
    p_paid_at: typeof (payment.paymentDate || payment.clientPaymentDate) === "string" ? String(payment.paymentDate || payment.clientPaymentDate) : null,
  });
  if (error) {
    console.error("Asaas webhook processing failed", error.message);
    return json({ error: "Event processing failed" }, 500);
  }
  if (data?.matched === false) {
    console.error("Asaas event has no matching ArenaPro subscription", eventType, eventId);
    return json({ error: "Subscription mapping pending" }, 503);
  }
  return json({ received: true, ...data });
});

