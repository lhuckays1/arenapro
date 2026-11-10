import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.4/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const asaasRequest = async (path: string, key: string, method = "POST", body?: unknown) => {
  const base = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3";
  if (base !== "https://api-sandbox.asaas.com/v3" && base !== "https://api.asaas.com/v3") {
    throw new Error("ASAAS_API_URL deve ser a URL oficial de Sandbox ou Produção.");
  }
  if (base === "https://api.asaas.com/v3" && Deno.env.get("ASAAS_LIVE_BILLING_ENABLED") !== "true") {
    throw new Error("Cobranças reais do Asaas estão desabilitadas até a aprovação do ambiente de produção.");
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "ArenaPro/1.0" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Asaas request failed", method, path, response.status, JSON.stringify(data).slice(0, 500));
    throw new Error(`O Asaas não conseguiu preparar a cobrança (HTTP ${response.status}). Confira a chave e a configuração da conta.`);
  }
  return data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const asaasKey = Deno.env.get("ASAAS_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !asaasKey) return json({ error: "A cobrança Asaas ainda não foi configurada no servidor." }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7).trim());
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  let payload: { arena_id?: string };
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const arenaId = String(payload?.arena_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(arenaId)) return json({ error: "Arena inválida." }, 400);

  const { data: membership, error: membershipError } = await admin.from("arena_users")
    .select("arena_id").eq("arena_id", arenaId).eq("user_id", authData.user.id)
    .eq("role", "ARENA_ADMIN").eq("status", "ACTIVE").maybeSingle();
  if (membershipError || !membership) return json({ error: "Somente o administrador da arena pode iniciar a assinatura." }, 403);

  const { data: subscription, error: subscriptionError } = await admin.from("arena_subscriptions")
    .select("id, arena_id, plan_id, status, monthly_price, current_period_end, checkout_url, external_subscription_id, external_plan_id, billing_provider, plan:subscription_plans(name)")
    .eq("arena_id", arenaId).maybeSingle();
  if (subscriptionError) return json({ error: "Não foi possível consultar a assinatura." }, 500);
  if (!subscription) return json({ error: "A arena ainda não possui um plano associado." }, 404);
  if (subscription.status === "CANCELLED" || subscription.status === "SUSPENDED") return json({ error: "A assinatura está suspensa ou cancelada. Entre em contato com o suporte ArenaPro." }, 409);
  const today = new Date().toISOString().slice(0, 10);
  if (subscription.status === "ACTIVE" && (!subscription.current_period_end || subscription.current_period_end >= today)) return json({ error: "A assinatura já está ativa." }, 409);
  if (subscription.billing_provider && subscription.billing_provider !== "ASAAS") return json({ error: "Esta assinatura está vinculada a outro meio de cobrança. Encerre a recorrência anterior e fale com o suporte antes de trocar para evitar cobrança duplicada." }, 409);
  if (!subscription.billing_provider && (subscription.external_subscription_id || subscription.external_plan_id || subscription.checkout_url)) {
    return json({ error: "Esta assinatura ainda tem dados de checkout de um gateway anterior. O suporte precisa confirmar que não há recorrência ativa antes da migração para Asaas." }, 409);
  }

  if (subscription.external_subscription_id) {
    try {
      const payments = await asaasRequest(`/subscriptions/${encodeURIComponent(subscription.external_subscription_id)}/payments?offset=0&limit=20`, asaasKey, "GET");
      const pending = (payments?.data || []).find((payment: any) => ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(String(payment?.status)) && payment?.invoiceUrl);
      if (pending?.invoiceUrl) return json({ success: true, checkout_url: pending.invoiceUrl, reused: true });
      return json({ error: "A recorrência já existe, mas o Asaas ainda não disponibilizou uma cobrança pendente. Atualize em instantes ou consulte o histórico de pagamentos." }, 409);
    } catch (error) {
      console.error("Asaas pending payment lookup failed", error instanceof Error ? error.message : "unknown error");
      return json({ error: error instanceof Error ? error.message : "Não foi possível localizar a cobrança pendente no Asaas." }, 502);
    }
  }

  if (subscription.checkout_url) return json({ success: true, checkout_url: subscription.checkout_url, reused: true });
  const amount = Number(subscription.monthly_price);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "O preço do plano precisa ser configurado antes da cobrança." }, 409);
  const { data: arena } = await admin.from("arenas").select("name").eq("id", arenaId).single();
  if (!arena) return json({ error: "Arena não encontrada." }, 404);

  try {
    const link = await asaasRequest("/paymentLinks", asaasKey, "POST", {
      name: `ArenaPro - ${String(arena.name).slice(0, 45)}`,
      description: `Assinatura mensal ${String((subscription.plan as any)?.name || "ArenaPro")} - ${String(arena.name).slice(0, 90)}`,
      value: Math.round(amount * 100) / 100,
      billingType: "UNDEFINED",
      chargeType: "RECURRENT",
      subscriptionCycle: "MONTHLY",
      externalReference: subscription.id,
      notificationEnabled: true,
    });
    const checkoutUrl = String(link?.url || "");
    const checkoutId = String(link?.id || "");
    if (!checkoutId || !checkoutUrl || new URL(checkoutUrl).protocol !== "https:") throw new Error("O Asaas não retornou um link de pagamento válido.");

    const { error: updateError } = await admin.from("arena_subscriptions").update({
      billing_provider: "ASAAS",
      external_checkout_id: checkoutId,
      checkout_url: checkoutUrl,
      checkout_url_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", subscription.id);
    if (updateError) {
      try { await asaasRequest(`/paymentLinks/${encodeURIComponent(checkoutId)}`, asaasKey, "DELETE"); } catch { /* best-effort cleanup */ }
      throw new Error("O link foi criado, mas não foi possível associá-lo à assinatura. Tente novamente.");
    }
    return json({ success: true, checkout_url: checkoutUrl, reused: false });
  } catch (error) {
    console.error("Asaas checkout setup failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Não foi possível preparar a cobrança Asaas." }, 502);
  }
});
