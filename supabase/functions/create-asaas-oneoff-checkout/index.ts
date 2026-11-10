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
    console.error("Asaas request failed", method, response.status);
    throw new AsaasError(`O Asaas não conseguiu preparar a cobrança (HTTP ${response.status}). Confira os dados informados.`, response.status);
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
const isOpenPayment = (payment: any) => ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"].includes(String(payment?.status));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL"), serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), asaasKey = Deno.env.get("ASAAS_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !asaasKey) return json({ error: "A cobrança ainda não foi configurada no servidor." }, 503);
  const asaasBaseUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3";
  const requestOrigin = req.headers.get("Origin") || "";
  const sandboxPreviewOrigin = "https://arenapro-git-feat-pagarme-sandbox-billing-lhuckays1s-projects.vercel.app";
  if (asaasBaseUrl === "https://api-sandbox.asaas.com/v3" && requestOrigin !== sandboxPreviewOrigin) {
    return json({ error: "Pagamentos de teste só podem ser gerados no Preview. A cobrança real ainda não está ativada." }, 503);
  }
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(authHeader.slice(7).trim());
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  let payload: { arena_id?: string; billing_type?: BillingType; payer?: Payer };
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const arenaId = String(payload?.arena_id || ""), billingType = payload?.billing_type;
  if (!/^[0-9a-f-]{36}$/i.test(arenaId)) return json({ error: "Arena inválida." }, 400);
  if (billingType !== "PIX" && billingType !== "BOLETO") return json({ error: "Escolha Pix ou boleto." }, 400);
  const payer = payload.payer || {};
  const name = String(payer.name || "").trim(), email = String(payer.email || "").trim().toLowerCase(), cpfCnpj = digits(payer.cpfCnpj), rawPhone = digits(payer.phone), postalCode = digits(payer.postalCode), addressNumber = String(payer.addressNumber || "").trim();
  const phone = rawPhone.startsWith("55") && [12, 13].includes(rawPhone.length) ? rawPhone.slice(2) : rawPhone;
  if (name.length < 3 || !validEmail(email) || ![11, 14].includes(cpfCnpj.length) || ![10, 11].includes(phone.length) || postalCode.length !== 8 || !addressNumber) return json({ error: "Preencha nome, e-mail, CPF/CNPJ, telefone, CEP e número do endereço para emitir a cobrança." }, 400);

  const { data: membership } = await admin.from("arena_users").select("arena_id").eq("arena_id", arenaId).eq("user_id", authData.user.id).eq("role", "ARENA_ADMIN").eq("status", "ACTIVE").maybeSingle();
  if (!membership) return json({ error: "Somente o administrador da arena pode regularizar a assinatura." }, 403);
  const { data: subscription, error: subError } = await admin.from("arena_subscriptions").select("id, arena_id, plan_id, status, monthly_price, current_period_end, external_subscription_id, billing_provider, external_customer_id, plan:subscription_plans(name)").eq("arena_id", arenaId).maybeSingle();
  if (subError) return json({ error: "Não foi possível consultar a assinatura." }, 500);
  if (!subscription) return json({ error: "A arena ainda não possui um plano associado." }, 404);
  const today = dateInSaoPaulo(0);
  if (["CANCELLED", "SUSPENDED"].includes(subscription.status)) return json({ error: "A assinatura está suspensa ou cancelada. Entre em contato com o suporte ArenaPro." }, 409);
  if (subscription.status === "ACTIVE" && (!subscription.current_period_end || subscription.current_period_end >= today)) return json({ error: "A assinatura já está ativa." }, 409);
  if (subscription.billing_provider && subscription.billing_provider !== "ASAAS") return json({ error: "Esta assinatura está vinculada a outro meio de cobrança. Fale com o suporte antes de trocar." }, 409);

  const { data: reservation, error: reserveError } = await admin.rpc("reserve_asaas_oneoff_checkout", { p_subscription_id: subscription.id, p_billing_type: billingType });
  if (reserveError) return json({ error: "Não foi possível reservar a cobrança. A atualização do fluxo ainda não está ativa." }, 503);
  if (reservation?.state !== "reserved") {
    const errors: Record<string, string> = { in_progress: "Já estamos preparando uma cobrança para esta arena. Aguarde alguns instantes.", already_active: "A assinatura já está ativa.", other_gateway: "Esta assinatura está vinculada a outro meio de cobrança. Contate o suporte.", subscription_blocked: "A assinatura está suspensa ou cancelada.", not_found: "Assinatura não encontrada.", invalid_billing_type: "Forma de pagamento inválida." };
    return json({ error: errors[reservation?.state] || "Não foi possível iniciar a cobrança." }, 409);
  }
  const operationId = String(reservation.operation_id || "");

  try {
    const base = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com/v3";
    if (subscription.external_subscription_id) {
      if (base !== "https://api-sandbox.asaas.com/v3") throw new AsaasError("Esta arena ainda tem uma recorrência antiga. O suporte precisa migrá-la com segurança.", 409);
      const { data: latest } = await admin.from("arena_subscription_payments").select("status, created_at").eq("subscription_id", subscription.id).eq("provider", "ASAAS").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (latest?.status !== "REFUNDED" || !latest.created_at || Date.now() - new Date(latest.created_at).getTime() > 30 * 86400000) throw new AsaasError("Há uma recorrência antiga vinculada. Para evitar cobranças duplicadas, ela precisa ser revisada antes de gerar um novo Pix ou boleto.", 409);
      // Asaas removes pending/overdue installments when a recurring subscription
      // is deleted. This is only allowed here for the already-refunded Sandbox test.
      try { await asaasRequest(`/subscriptions/${encodeURIComponent(subscription.external_subscription_id)}`, asaasKey, "DELETE"); }
      catch (error) { if (!(error instanceof AsaasError) || error.status !== 404) throw error; }
      const { error: detachError } = await admin.from("arena_subscriptions").update({ external_subscription_id: null, status: "PAST_DUE", paid_at: null, checkout_url: null, checkout_url_created_at: null, updated_at: new Date().toISOString() }).eq("id", subscription.id).eq("external_subscription_id", subscription.external_subscription_id);
      if (detachError) throw new Error("A recorrência Sandbox foi encerrada, mas o ArenaPro ainda está sincronizando a assinatura. Atualize esta página em instantes.");
    }

    const existing = await asaasRequest(`/payments?externalReference=${encodeURIComponent(subscription.id)}&limit=100`, asaasKey, "GET");
    const pendingPayments = (existing?.data || []).filter((item: any) => isOpenPayment(item) && !item?.subscription);
    const pending = pendingPayments.find((item: any) => String(item?.billingType || "") === billingType);
    if (!pending && pendingPayments.length) throw new AsaasError("Já existe uma cobrança pendente por outra forma de pagamento. Use a cobrança existente ou aguarde sua expiração.", 409);
    let payment = pending;
    let reused = Boolean(pending);
    if (!payment?.id) {
      let customerId = String(subscription.external_customer_id || "");
      if (!customerId) {
        const found = await asaasRequest(`/customers?externalReference=${encodeURIComponent(subscription.id)}&limit=10`, asaasKey, "GET");
        customerId = String((found?.data || []).find((item: any) => item?.id)?.id || "");
      }
      if (customerId) await asaasRequest(`/customers/${encodeURIComponent(customerId)}`, asaasKey, "PUT", { name, email, cpfCnpj, mobilePhone: phone, postalCode, addressNumber, externalReference: subscription.id });
      else {
        const createdCustomer = await asaasRequest("/customers", asaasKey, "POST", { name, email, cpfCnpj, mobilePhone: phone, postalCode, addressNumber, externalReference: subscription.id });
        customerId = String(createdCustomer?.id || "");
      }
      if (!customerId) throw new Error("O Asaas não retornou um cadastro de pagador válido.");
      const amount = Number(subscription.monthly_price);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("O preço do plano precisa ser configurado antes da cobrança.");
      payment = await asaasRequest("/payments", asaasKey, "POST", {
        customer: customerId, billingType, value: Math.round(amount * 100) / 100, dueDate: dateInSaoPaulo(3),
        description: `Assinatura ArenaPro - ${String((subscription.plan as any)?.name || "Plano").slice(0, 60)}`,
        externalReference: subscription.id,
      });
      reused = false;
    }
    if (!payment?.id) throw new Error("O Asaas não retornou uma cobrança válida.");

    const { data: currentPayment } = await admin.from("arena_subscription_payments").select("id").eq("provider", "ASAAS").eq("provider_payment_id", String(payment.id)).maybeSingle();
    if (!currentPayment) {
      const { error: insertError } = await admin.from("arena_subscription_payments").insert({
        subscription_id: subscription.id, provider: "ASAAS", provider_payment_id: String(payment.id), status: String(payment.status || "PENDING"),
        amount_cents: Math.max(0, Math.round(Number(payment.value || 0) * 100)), due_date: payment.dueDate || null,
        description: `Asaas cobrança avulsa ${billingType}`, payment_method: billingType,
      });
      if (insertError && insertError.code !== "23505") throw new Error("A cobrança foi criada, mas o ArenaPro não conseguiu registrar o histórico. Atualize em instantes.");
    }

    let details: Record<string, unknown> = {};
    if (billingType === "PIX") {
      const pix = await asaasRequest(`/payments/${encodeURIComponent(String(payment.id))}/pixQrCode`, asaasKey, "GET");
      details = { pix: { encoded_image: pix?.encodedImage || null, payload: pix?.payload || null, expiration_date: pix?.expirationDate || null } };
    } else {
      const identification = await asaasRequest(`/payments/${encodeURIComponent(String(payment.id))}/identificationField`, asaasKey, "GET");
      details = { boleto: { identification_field: identification?.identificationField || identification?.barCode || null, bank_slip_url: String(payment?.bankSlipUrl || "").startsWith("https://") ? payment.bankSlipUrl : null } };
    }
    await admin.from("arena_subscriptions").update({ checkout_operation_started_at: null, updated_at: new Date().toISOString() }).eq("id", subscription.id).eq("checkout_operation_id", operationId);
    return json({ success: true, reused, billing_type: billingType, payment_id: String(payment.id), due_date: payment.dueDate || null, amount: Number(payment.value || subscription.monthly_price), ...details });
  } catch (error) {
    await admin.rpc("release_asaas_oneoff_checkout", { p_subscription_id: subscription.id, p_operation_id: operationId });
    if (error instanceof AsaasError) return json({ error: error.message }, error.status === 409 ? 409 : 502);
    console.error("Asaas one-off checkout failed", error instanceof Error ? error.message : "unknown error");
    return json({ error: error instanceof Error ? error.message : "Não foi possível preparar a cobrança." }, 502);
  }
});

