import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.4/cors";

type BillingType = "PIX" | "BOLETO";
type Payer = { name?: string; email?: string; cpfCnpj?: string; phone?: string; postalCode?: string; addressNumber?: string };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

class AsaasError extends Error { constructor(message: string, readonly status: number) { super(message); } }
const asaasRequest = async (path: string, key: string, method = "GET", body?: unknown) => {
  const base = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3";
  if (base !== "https://api-sandbox.asaas.com/v3" && base !== "https://api.asaas.com/v3") throw new Error("ASAAS_API_URL deve ser a URL oficial de Sandbox ou Produção.");
  if (base === "https://api.asaas.com/v3" && Deno.env.get("ASAAS_LIVE_BILLING_ENABLED") !== "true") throw new Error("Cobranças reais estão desabilitadas até a liberação do ambiente de produção.");
  const response = await fetch(`${base}${path}`, { method, headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "ArenaPro/1.0" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // Provider error payloads can echo payer fields; keep those out of application logs.
    console.error("Asaas request failed", method, response.status);
    throw new AsaasError(`O Asaas não conseguiu preparar o pagamento (HTTP ${response.status}). Confira os dados informados.`, response.status);
  }
  return data;
};
const digits = (value: unknown) => String(value || "").replace(/\D/g, "");
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const dateInSaoPaulo = (days: number) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const date = new Date(Date.UTC(Number(parts.find(p => p.type === "year")?.value), Number(parts.find(p => p.type === "month")?.value) - 1, Number(parts.find(p => p.type === "day")?.value) + days));
  return date.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), asaasKey = Deno.env.get("ASAAS_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !asaasKey) return json({ error: "A cobrança ainda não foi configurada no servidor." }, 503);
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7).trim());
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  let payload: { arena_id?: string; billing_type?: BillingType; payer?: Payer };
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const arenaId = String(payload?.arena_id || ""), billingType = payload?.billing_type;
  if (!/^[0-9a-f-]{36}$/i.test(arenaId)) return json({ error: "Arena inválida." }, 400);
  if (billingType != null && billingType !== "PIX" && billingType !== "BOLETO") return json({ error: "Escolha Pix ou boleto." }, 400);
  const payer = payload.payer || {};
  const name = String(payer.name || "").trim(), email = String(payer.email || "").trim().toLowerCase(), cpfCnpj = digits(payer.cpfCnpj), rawPhone = digits(payer.phone), postalCode = digits(payer.postalCode), addressNumber = String(payer.addressNumber || "").trim();
  const phone = rawPhone.startsWith("55") && [12, 13].includes(rawPhone.length) ? rawPhone.slice(2) : rawPhone;
  if (billingType && (name.length < 3 || !validEmail(email) || ![11, 14].includes(cpfCnpj.length) || ![10, 11].includes(phone.length) || postalCode.length !== 8 || !addressNumber)) return json({ error: "Preencha nome, e-mail, CPF/CNPJ, telefone, CEP e número do endereço para emitir a cobrança." }, 400);

  const { data: membership } = await admin.from("arena_users").select("arena_id").eq("arena_id", arenaId).eq("user_id", authData.user.id).eq("role", "ARENA_ADMIN").eq("status", "ACTIVE").maybeSingle();
  if (!membership) return json({ error: "Somente o administrador da arena pode regularizar a assinatura." }, 403);
  const { data: subscription, error: subError } = await admin.from("arena_subscriptions").select("id, arena_id, plan_id, status, monthly_price, current_period_end, checkout_url, external_checkout_id, external_subscription_id, billing_provider, checkout_billing_type, external_customer_id, plan:subscription_plans(name)").eq("arena_id", arenaId).maybeSingle();
  if (subError) return json({ error: "Não foi possível consultar a assinatura." }, 500);
  if (!subscription) return json({ error: "A arena ainda não possui um plano associado." }, 404);
  if (["CANCELLED", "SUSPENDED"].includes(subscription.status)) return json({ error: "A assinatura está suspensa ou cancelada. Entre em contato com o suporte ArenaPro." }, 409);
  const today = dateInSaoPaulo(0);
  if (subscription.status === "ACTIVE" && (!subscription.current_period_end || subscription.current_period_end >= today)) return json({ error: "A assinatura já está ativa." }, 409);
  if (subscription.billing_provider && subscription.billing_provider !== "ASAAS") return json({ error: "Esta assinatura está vinculada a outro meio de cobrança. Fale com o suporte antes de trocar para evitar cobranças duplicadas." }, 409);
  if (subscription.external_plan_id) return json({ error: "Esta assinatura possui uma recorrência antiga vinculada. O suporte precisa revisar antes de migrar o meio de cobrança." }, 409);
  // Backward compatibility for the currently published app while the new in-app screen rolls out.
  if (!billingType) {
    if (subscription.checkout_url) return json({ success: true, checkout_url: subscription.checkout_url, reused: true });
    if (subscription.external_subscription_id) return await pendingLegacyHostedPayment(asaasKey, subscription.external_subscription_id);
    const amount = Number(subscription.monthly_price);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: "O preço do plano precisa ser configurado antes da cobrança." }, 409);
    const { data: arena } = await admin.from("arenas").select("name").eq("id", arenaId).single();
    if (!arena) return json({ error: "Arena não encontrada." }, 404);
    try {
      const link = await asaasRequest("/paymentLinks", asaasKey, "POST", {
        name: `ArenaPro - ${String(arena.name).slice(0, 45)}`,
        description: `Assinatura mensal ArenaPro - ${String(arena.name).slice(0, 90)}`,
        value: Math.round(amount * 100) / 100, billingType: "UNDEFINED", chargeType: "RECURRENT",
        subscriptionCycle: "MONTHLY", dueDateLimitDays: 3, externalReference: subscription.id, notificationEnabled: false,
      });
      const url = String(link?.url || ""), id = String(link?.id || "");
      if (!id || !url || new URL(url).protocol !== "https:") throw new Error("O Asaas não retornou um checkout válido.");
      const { error } = await admin.from("arena_subscriptions").update({ billing_provider: "ASAAS", external_checkout_id: id, checkout_url: url, checkout_url_created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id);
      if (error) throw new Error("Não foi possível associar o checkout à assinatura.");
      return json({ success: true, checkout_url: url, reused: false });
    } catch (error) {
      console.error("Legacy Asaas checkout setup failed", error instanceof Error ? error.message : "unknown error");
      return json({ error: error instanceof Error ? error.message : "Não foi possível preparar a cobrança." }, 502);
    }
  }
  if (subscription.checkout_billing_type && subscription.checkout_billing_type !== billingType) return json({ error: `Já existe uma cobrança ${subscription.checkout_billing_type === "PIX" ? "Pix" : "por boleto"} pendente. Conclua ou aguarde a expiração antes de trocar o método.` }, 409);

  const amount = Number(subscription.monthly_price);
  if (!Number.isFinite(amount) || amount <= 0) return json({ error: "O preço do plano precisa ser configurado antes da cobrança." }, 409);
  const arenaResult = await admin.from("arenas").select("name").eq("id", arenaId).single();
  if (arenaResult.error || !arenaResult.data) return json({ error: "Arena não encontrada." }, 404);
  const arena = arenaResult.data;

  // Recover a previous Asaas subscription after a network timeout before ever creating another one.
  if (subscription.external_subscription_id) return await pendingPayment(admin, asaasKey, subscription.external_subscription_id, subscription.checkout_billing_type || billingType, true);
  try {
    const existing = await asaasRequest(`/subscriptions?externalReference=${encodeURIComponent(subscription.id)}&limit=10`, asaasKey, "GET");
    const match = (existing?.data || []).find((item: any) => !["INACTIVE", "DELETED"].includes(String(item?.status)));
    if (match?.id) {
      const { error } = await admin.from("arena_subscriptions").update({ billing_provider: "ASAAS", external_subscription_id: String(match.id), external_customer_id: String(match.customer || "") || null, checkout_billing_type: billingType, checkout_url: null, external_checkout_id: null, updated_at: new Date().toISOString() }).eq("id", subscription.id);
      if (error) return json({ error: "Encontramos uma assinatura existente no provedor, mas não foi possível sincronizá-la. Contate o suporte para evitar cobrança duplicada." }, 500);
      return await pendingPayment(admin, asaasKey, String(match.id), billingType, true);
    }
  } catch (error) {
    console.error("Asaas subscription reconciliation failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Não foi possível conferir se já existe uma cobrança. Tente novamente em instantes." }, 502);
  }

  const { data: reservation, error: reserveError } = await admin.rpc("reserve_asaas_in_app_checkout", { p_subscription_id: subscription.id, p_billing_type: billingType });
  if (reserveError) return json({ error: "Não foi possível reservar o checkout. A migração de cobrança pode ainda não estar ativa." }, 503);
  if (reservation?.state !== "reserved") {
    if (reservation?.state === "existing_subscription" && reservation.provider_subscription_id) return await pendingPayment(admin, asaasKey, String(reservation.provider_subscription_id), reservation.billing_type || billingType, true);
    const errors: Record<string, string> = { in_progress: "Estamos preparando uma cobrança. Aguarde alguns instantes e atualize esta tela.", billing_type_locked: "Existe uma tentativa de cobrança por outro método. Aguarde alguns minutos e atualize a tela.", already_active: "A assinatura já está ativa.", other_gateway: "Esta assinatura está vinculada a outro meio de cobrança. Contate o suporte.", subscription_blocked: "A assinatura está suspensa ou cancelada.", not_found: "Assinatura não encontrada.", invalid_billing_type: "Método de pagamento inválido." };
    return json({ error: errors[reservation?.state] || "Não foi possível iniciar o pagamento." }, 409);
  }
  const operationId = String(reservation.operation_id || "");
  try {
    // Reuse an existing customer when known; personal data stays in this request and Asaas only.
    let customerId = String(subscription.external_customer_id || "");
    if (!customerId) {
      const found = await asaasRequest(`/customers?externalReference=${encodeURIComponent(subscription.id)}&limit=10`, asaasKey, "GET");
      customerId = String((found?.data || []).find((item: any) => item?.id)?.id || "");
    }
    if (customerId) {
      await asaasRequest(`/customers/${encodeURIComponent(customerId)}`, asaasKey, "PUT", { name, email, cpfCnpj, mobilePhone: phone, postalCode, addressNumber, externalReference: subscription.id, notificationDisabled: true });
    } else {
      const customer = await asaasRequest("/customers", asaasKey, "POST", { name, email, cpfCnpj, mobilePhone: phone, postalCode, addressNumber, externalReference: subscription.id, notificationDisabled: true });
      customerId = String(customer?.id || "");
    }
    if (!customerId) throw new Error("O Asaas não retornou um cadastro de pagador válido.");

    // Retire o link Sandbox antigo antes da nova recorrência, para nunca deixar duas cobranças ativas.
    if (subscription.external_checkout_id && Deno.env.get("ASAAS_API_URL") !== "https://api.asaas.com/v3") {
      try { await asaasRequest(`/paymentLinks/${encodeURIComponent(subscription.external_checkout_id)}`, asaasKey, "DELETE"); }
      catch (error) {
        if (!(error instanceof AsaasError) || error.status !== 404) throw new Error("Não foi possível encerrar o checkout Sandbox anterior; nenhuma nova recorrência foi criada. Tente novamente ou contate o suporte.");
      }
    }

    const nextDueDate = dateInSaoPaulo(3);
    const created = await asaasRequest("/subscriptions", asaasKey, "POST", {
      customer: customerId, billingType, value: Math.round(amount * 100) / 100, cycle: "MONTHLY", nextDueDate,
      description: `Assinatura ArenaPro - ${String((subscription.plan as any)?.name || "Plano").slice(0, 60)}`,
      externalReference: subscription.id,
    });
    const providerSubscriptionId = String(created?.id || "");
    if (!providerSubscriptionId) throw new Error("O Asaas não retornou a assinatura criada.");
    const { data: completed, error: completeError } = await admin.rpc("complete_asaas_in_app_checkout", {
      p_subscription_id: subscription.id, p_operation_id: operationId, p_provider_subscription_id: providerSubscriptionId, p_provider_customer_id: customerId, p_billing_type: billingType,
    });
    if (completeError || !completed?.success) {
      console.error("Asaas checkout persistence failed", completeError?.message || "operation mismatch", providerSubscriptionId);
      return json({ error: "A cobrança foi iniciada mas ainda estamos sincronizando. Aguarde alguns instantes e atualize a tela; não inicie outra cobrança." }, 202);
    }
    return await pendingPayment(admin, asaasKey, providerSubscriptionId, billingType, false);
  } catch (error) {
    if (error instanceof AsaasError && error.status >= 400 && error.status < 500) {
      await admin.rpc("release_asaas_in_app_checkout_attempt", { p_subscription_id: subscription.id, p_operation_id: operationId });
    }
    console.error("Asaas in-app checkout failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Não foi possível preparar o pagamento." }, error instanceof AsaasError && error.status === 400 ? 400 : 502);
  }
});

async function pendingPayment(admin: ReturnType<typeof createClient>, key: string, subscriptionId: string, billingType: string, reused: boolean) {
  try {
    const response = await asaasRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?offset=0&limit=20`, key, "GET");
    const payment = (response?.data || []).find((item: any) => ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(String(item?.status)));
    if (!payment?.id) return json({ success: true, processing: true, reused, message: "Pagamento criado. O Asaas está preparando os dados; atualize em alguns instantes." }, 202);
    let details: Record<string, unknown> = {};
    if (billingType === "PIX") {
      const pix = await asaasRequest(`/payments/${encodeURIComponent(String(payment.id))}/pixQrCode`, key, "GET");
      details = { pix: { encoded_image: pix?.encodedImage || null, payload: pix?.payload || null, expiration_date: pix?.expirationDate || null } };
    } else {
      const identification = await asaasRequest(`/payments/${encodeURIComponent(String(payment.id))}/identificationField`, key, "GET");
      const bankSlipUrl = String(payment?.bankSlipUrl || "");
      details = { boleto: { identification_field: identification?.identificationField || identification?.barCode || null, bank_slip_url: bankSlipUrl.startsWith("https://") ? bankSlipUrl : null } };
    }
    return json({ success: true, reused, billing_type: billingType, payment_id: payment.id, due_date: payment.dueDate || null, amount: payment.value, ...details });
  } catch (error) {
    console.error("Asaas payment details lookup failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "A assinatura existe, mas não conseguimos carregar os dados de pagamento. Atualize em instantes; não gere outra cobrança." }, 502);
  }
}

async function pendingLegacyHostedPayment(key: string, subscriptionId: string) {
  try {
    const payments = await asaasRequest(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?offset=0&limit=20`, key, "GET");
    const pending = (payments?.data || []).find((payment: any) => ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(String(payment?.status)) && payment?.invoiceUrl);
    if (pending?.invoiceUrl) return json({ success: true, checkout_url: pending.invoiceUrl, reused: true });
    return json({ error: "A recorrência já existe, mas o Asaas ainda não disponibilizou uma cobrança pendente. Atualize em instantes ou consulte o histórico." }, 409);
  } catch (error) {
    console.error("Legacy Asaas pending payment lookup failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Não foi possível localizar a cobrança no Asaas." }, 502);
  }
}

