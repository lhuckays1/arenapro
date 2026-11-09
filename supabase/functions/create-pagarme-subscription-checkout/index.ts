import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.4/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const pagarmeRequest = async (path: string, key: string, body: unknown) => {
  const base = Deno.env.get("PAGARME_API_URL") || "https://sdx-api.pagar.me/core/v5";
  if (base !== "https://sdx-api.pagar.me/core/v5" && base !== "https://api.pagar.me/core/v5") {
    throw new Error("PAGARME_API_URL precisa apontar para o ambiente oficial de teste ou produção.");
  }
  if (base === "https://api.pagar.me/core/v5" && Deno.env.get("PAGARME_LIVE_BILLING_ENABLED") !== "true") {
    throw new Error("Cobranças reais estão desabilitadas até a aprovação dos preços e do ambiente de produção.");
  }
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${key}:`)}`,
      "Content-Type": "application/json",
      "User-Agent": "pagarme-skill-generated/1.0",
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Pagar.me request failed", response.status, JSON.stringify(data).slice(0, 500));
    throw new Error("O Pagar.me não conseguiu preparar o checkout. Confira as credenciais e a configuração da conta.");
  }
  return data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
  if (!supabaseUrl || !serviceRoleKey || !pagarmeKey) {
    return json({ error: "A cobrança ainda não foi configurada no servidor." }, 503);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  let payload: { arena_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const arenaId = String(payload?.arena_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(arenaId)) return json({ error: "Arena inválida." }, 400);

  const { data: membership, error: membershipError } = await admin
    .from("arena_users")
    .select("arena_id, role, status")
    .eq("arena_id", arenaId)
    .eq("user_id", authData.user.id)
    .eq("role", "ARENA_ADMIN")
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (membershipError || !membership) return json({ error: "Somente o administrador da arena pode iniciar a assinatura." }, 403);

  const { data: subscription, error: subscriptionError } = await admin
    .from("arena_subscriptions")
    .select("id, arena_id, plan_id, status, monthly_price, checkout_url, external_plan_id, grace_period_days, plan:subscription_plans(id, name)")
    .eq("arena_id", arenaId)
    .maybeSingle();
  if (subscriptionError) return json({ error: "Não foi possível consultar a assinatura." }, 500);
  if (!subscription) return json({ error: "A arena ainda não possui um plano associado." }, 404);
  if (subscription.status === "CANCELLED") return json({ error: "A assinatura foi cancelada. Fale com o suporte para reativá-la." }, 409);
  if (subscription.status === "SUSPENDED") return json({ error: "A assinatura foi suspensa pelo suporte. Entre em contato com o Super Admin para regularizar." }, 409);
  if (subscription.status === "ACTIVE") return json({ error: "A assinatura já está ativa." }, 409);

  const amountCents = Math.round(Number(subscription.monthly_price) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return json({ error: "O preço do plano precisa ser configurado antes da cobrança." }, 409);
  if (subscription.checkout_url) return json({ success: true, checkout_url: subscription.checkout_url, reused: true });

  const { data: arena } = await admin.from("arenas").select("name").eq("id", arenaId).single();
  if (!arena) return json({ error: "Arena não encontrada." }, 404);

  try {
    let providerPlanId: string | null = null;
    const apiUrl = Deno.env.get("PAGARME_API_URL") || "https://sdx-api.pagar.me/core/v5";
    const environment = apiUrl === "https://api.pagar.me/core/v5" ? "live" : "test";
    const { data: catalogPlan } = await admin
      .from("pagarme_plan_catalog")
      .select("provider_plan_id")
      .eq("subscription_id", subscription.id)
      .eq("amount_cents", amountCents)
      .eq("environment", environment)
      .maybeSingle();
    providerPlanId = catalogPlan?.provider_plan_id || null;

    if (!providerPlanId) {
      const planName = `${String((subscription.plan as any)?.name || "ArenaPro").slice(0, 35)} ${amountCents}`.slice(0, 64);
      const providerPlan = await pagarmeRequest("/plans", pagarmeKey, {
        name: planName,
        description: `Assinatura mensal ArenaPro - ${String(arena.name).slice(0, 100)}`,
        currency: "BRL",
        interval: "month",
        interval_count: 1,
        billing_type: "prepaid",
        payment_methods: ["credit_card", "boleto"],
        items: [{
          name: String((subscription.plan as any)?.name || "Plano ArenaPro").slice(0, 64),
          quantity: 1,
          pricing_scheme: { scheme_type: "unit", price: amountCents },
        }],
      });
      providerPlanId = String(providerPlan?.id || "");
      if (!providerPlanId) throw new Error("A API do Pagar.me não retornou o identificador do plano.");
      const { error: catalogError } = await admin.from("pagarme_plan_catalog").upsert({
        subscription_id: subscription.id,
        plan_id: subscription.plan_id,
        amount_cents: amountCents,
        environment,
        provider_plan_id: providerPlanId,
      }, { onConflict: "subscription_id,amount_cents,environment" });
      if (catalogError) throw new Error("Não foi possível registrar o plano de cobrança.");
    }

    const checkout = await pagarmeRequest("/paymentlinks", pagarmeKey, {
      name: `ArenaPro - ${String(arena.name).slice(0, 45)}`.slice(0, 64),
      type: "subscription",
      payment_settings: { accepted_payment_methods: ["credit_card", "boleto"] },
      cart_settings: { recurrences: [{ start_in: 1, plan_id: providerPlanId }] },
      max_paid_sessions: 1,
    });
    const checkoutUrl = String(checkout?.url || "");
    const checkoutHost = checkoutUrl ? new URL(checkoutUrl).hostname : "";
    if (!checkoutUrl || !["checkout.pagar.me", "payment-link.pagar.me"].includes(checkoutHost)) {
      throw new Error("O Pagar.me não retornou um link de checkout válido.");
    }

    const { error: updateError } = await admin.from("arena_subscriptions").update({
      external_plan_id: providerPlanId,
      checkout_url: checkoutUrl,
      checkout_url_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    if (updateError) throw new Error("O checkout foi criado, mas não foi possível salvar o link. Tente novamente.");

    return json({ success: true, checkout_url: checkoutUrl, reused: false });
  } catch (error) {
    console.error("Pagar.me checkout setup failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Não foi possível preparar o checkout." }, 502);
  }
});

