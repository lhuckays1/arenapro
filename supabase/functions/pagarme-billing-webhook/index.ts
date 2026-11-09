import { createClient } from "npm:@supabase/supabase-js@2.112.4";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) mismatch |= (a[i] || 0) ^ (b[i] || 0);
  return mismatch === 0;
};

const asDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  return value.slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expectedToken = Deno.env.get("PAGARME_WEBHOOK_TOKEN") || "";
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const suppliedToken = decodeURIComponent(pathParts.at(-1) || "");
  if (expectedToken.length < 32 || !constantTimeEqual(suppliedToken, expectedToken)) {
    return json({ error: "Not found" }, 404);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Billing receiver is not configured" }, 503);

  let event: any;
  try { event = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const eventId = String(event?.id || event?.event_id || "").trim();
  const eventType = String(event?.type || event?.event || "").trim();
  const data = event?.data && typeof event.data === "object" ? event.data : {};
  if (!eventId || !eventType) return json({ error: "Missing event ID or type" }, 400);

  const supported = new Set([
    "subscription.created",
    "subscription.canceled",
    "invoice.paid",
    "invoice.payment_failed",
    "invoice.canceled",
  ]);
  if (!supported.has(eventType)) return json({ received: true, ignored: true });

  const providerSubscriptionId = String(
    data.subscription_id || data.subscription?.id || (eventType.startsWith("subscription.") ? data.id : "") || "",
  ).trim() || null;
  const providerPlanId = String(data.plan_id || data.plan?.id || data.subscription?.plan_id || data.subscription?.plan?.id || "").trim() || null;
  const providerCustomerId = String(data.customer_id || data.customer?.id || data.subscription?.customer_id || "").trim() || null;
  const providerPaymentId = String(data.id || data.invoice_id || "").trim() || null;
  const amountCents = Math.max(0, Math.round(Number(data.amount ?? data.value ?? 0) || 0));
  const dueDate = asDate(data.due_at || data.due_date);
  const paidAt = typeof (data.paid_at || data.updated_at) === "string"
    ? String(data.paid_at || data.updated_at)
    : null;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: result, error } = await admin.rpc("process_pagarme_billing_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_provider_subscription_id: providerSubscriptionId,
    p_provider_plan_id: providerPlanId,
    p_provider_payment_id: providerPaymentId,
    p_amount_cents: amountCents,
    p_due_date: dueDate,
    p_paid_at: paidAt,
    p_provider_customer_id: providerCustomerId,
  });

  if (error) {
    console.error("Pagar.me webhook processing failed", error.message);
    return json({ error: "Event processing failed" }, 500);
  }
  if (result?.matched === false) {
    console.error("Pagar.me event has no matching ArenaPro subscription", eventType, eventId);
    return json({ error: "Subscription mapping pending" }, 503);
  }
  return json({ received: true, ...result });
});

