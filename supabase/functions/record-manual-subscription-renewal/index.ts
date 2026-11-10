import { createClient } from "npm:@supabase/supabase-js@2.112.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2.112.4/cors";

type RenewalPayload = {
  subscription_id?: string;
  payment_method?: string;
  reference?: string | null;
  notes?: string;
  duration_days?: number;
  confirmed_payment_received?: boolean;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const paymentMethods = new Set([
  "PIX", "CASH", "BANK_TRANSFER", "CREDIT_CARD", "DEBIT_CARD", "OTHER",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Serviço de assinatura não configurado." }, 503);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authHeader.slice("Bearer ".length).trim();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "SUPER_ADMIN") {
    return json({ error: "Apenas o SUPER_ADMIN pode registrar uma renovação manual." }, 403);
  }

  let payload: RenewalPayload;
  try { payload = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }

  const subscriptionId = String(payload?.subscription_id || "").trim();
  const paymentMethod = String(payload?.payment_method || "").trim();
  const notes = String(payload?.notes || "").trim();
  const reference = String(payload?.reference || "").trim();
  const durationDays = Number(payload?.duration_days);

  if (!/^[0-9a-f-]{36}$/i.test(subscriptionId)) return json({ error: "Assinatura inválida." }, 400);
  if (!paymentMethods.has(paymentMethod)) return json({ error: "Selecione uma forma de pagamento válida." }, 400);
  if (notes.length < 5 || notes.length > 500) return json({ error: "Informe uma observação de 5 a 500 caracteres." }, 400);
  if (reference.length > 120) return json({ error: "A referência deve ter até 120 caracteres." }, 400);
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) return json({ error: "O período precisa ser um número inteiro entre 1 e 365 dias." }, 400);
  if (payload?.confirmed_payment_received !== true) {
    return json({ error: "Confirme que o pagamento foi recebido antes de renovar." }, 400);
  }

  const { data, error } = await admin.rpc("record_manual_subscription_renewal", {
    p_subscription_id: subscriptionId,
    p_actor_id: authData.user.id,
    p_payment_method: paymentMethod,
    p_reference: reference || null,
    p_notes: notes,
    p_duration_days: durationDays,
  });

  if (error) {
    const message = error.message || "Não foi possível registrar a renovação manual.";
    if (message.includes("INVALID_RENEWAL_DURATION")) return json({ error: "O período precisa ser um número inteiro entre 1 e 365 dias." }, 400);
    if (message.includes("RECURRING_SUBSCRIPTION_LINKED")) {
      return json({ error: "Esta assinatura está vinculada a uma recorrência automática. Para evitar cobranças duplicadas, regularize pelo gateway ou encerre a recorrência antes de usar pagamento manual." }, 409);
    }
    if (message.includes("ASAAS_PAYMENT_PENDING")) {
      return json({ error: "Existe uma cobrança Asaas pendente ou vencida para esta arena. Cancele ou regularize essa cobrança no Asaas antes de registrar um pagamento manual, para evitar cobrança duplicada." }, 409);
    }
    if (message.includes("CHECKOUT_IN_PROGRESS")) {
      return json({ error: "Há uma cobrança sendo preparada para esta arena. Aguarde alguns instantes e tente novamente." }, 409);
    }
    if (message.includes("SUBSCRIPTION_REQUIRES_REVIEW")) {
      return json({ error: "A assinatura está suspensa ou cancelada. Revise a situação antes de renová-la." }, 409);
    }
    if (message.includes("SUBSCRIPTION_PRICE_NOT_CONFIGURED")) {
      return json({ error: "Configure um valor mensal maior que zero antes de renovar." }, 409);
    }
    if (message.includes("SUBSCRIPTION_NOT_FOUND")) return json({ error: "Assinatura não encontrada." }, 404);
    console.error("Manual subscription renewal failed", message);
    return json({ error: "Não foi possível registrar a renovação manual." }, 500);
  }

  return json({ success: true, renewal: data });
});
