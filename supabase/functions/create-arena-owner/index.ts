import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

type CreateArenaOwnerPayload = {
  arena: {
    name: string;
    slug: string;
    description?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  };
  owner: {
    full_name: string;
    email: string;
    phone?: string | null;
  };
  plan_id: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {

  // ============================================================
  // CORS / PREFLIGHT
  // ============================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Método não permitido." },
      405
    );
  }

  // ============================================================
  // SUPABASE CONFIG
  // ============================================================

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get(
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      {
        error:
          "Configuração do Supabase incompleta na Edge Function.",
      },
      500
    );
  }

  // ============================================================
  // AUTHORIZATION
  // ============================================================

  const authHeader = req.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return json(
      {
        error: "Usuário não autenticado.",
      },
      401
    );
  }

  const token = authHeader.replace("Bearer ", "").trim();

  // Cliente administrativo usando Service Role.
  // A Service Role fica SOMENTE dentro da Edge Function.
  const admin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // ============================================================
  // VALIDAR USUÁRIO AUTENTICADO
  // ============================================================

  const {
    data: authData,
    error: authError,
  } = await admin.auth.getUser(token);

  if (authError || !authData.user) {
    return json(
      {
        error:
          "Sessão inválida ou expirada.",
      },
      401
    );
  }

  // ============================================================
  // VALIDAR SUPER ADMIN
  // ============================================================

  const {
    data: requester,
    error: requesterError,
  } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", authData.user.id)
    .single();

  if (
    requesterError ||
    requester?.role !== "SUPER_ADMIN"
  ) {
    return json(
      {
        error:
          "Apenas SUPER_ADMIN pode criar arenas e proprietários.",
      },
      403
    );
  }

  // ============================================================
  // LER PAYLOAD
  // ============================================================

  let payload: CreateArenaOwnerPayload;

  try {
    payload = await req.json();
  } catch {
    return json(
      {
        error: "JSON inválido.",
      },
      400
    );
  }

  const arenaName =
    payload?.arena?.name?.trim();

  const slug =
    payload?.arena?.slug
      ?.trim()
      .toLowerCase();

  const ownerName =
    payload?.owner?.full_name?.trim();

  const ownerEmail =
    payload?.owner?.email
      ?.trim()
      .toLowerCase();

  const planId =
    payload?.plan_id;

  // ============================================================
  // VALIDAÇÕES
  // ============================================================

  if (
    !arenaName ||
    !slug ||
    !ownerName ||
    !ownerEmail ||
    !planId
  ) {
    return json(
      {
        error:
          "Arena, proprietário e plano são obrigatórios.",
      },
      400
    );
  }

  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
  ) {
    return json(
      {
        error:
          "Slug inválido. Use apenas letras minúsculas, números e hífens.",
      },
      400
    );
  }

  // ============================================================
  // VALIDAR PLANO
  // ============================================================

  const {
    data: plan,
    error: planError,
  } = await admin
    .from("subscription_plans")
    .select(
      "id, name, monthly_price, status"
    )
    .eq("id", planId)
    .single();

  if (
    planError ||
    !plan ||
    plan.status !== "ACTIVE"
  ) {
    return json(
      {
        error:
          "Plano selecionado não está disponível.",
      },
      400
    );
  }

  // ============================================================
  // VERIFICAR SLUG
  // ============================================================

  const {
    data: existingArena,
  } = await admin
    .from("arenas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (existingArena) {
    return json(
      {
        error:
          "Já existe uma arena com este slug.",
      },
      409
    );
  }

  // ============================================================
  // CRIAR ARENA
  // ============================================================

  const {
    data: arena,
    error: arenaError,
  } = await admin
    .from("arenas")
    .insert({
      name: arenaName,
      slug,
      description:
        payload.arena.description ?? null,
      phone:
        payload.arena.phone ?? null,
      whatsapp:
        payload.arena.whatsapp ?? null,
      email:
        payload.arena.email ??
        ownerEmail,
      address:
        payload.arena.address ?? null,
      city:
        payload.arena.city ?? null,
      state:
        payload.arena.state ?? null,
      zip_code:
        payload.arena.zip_code ?? null,
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (arenaError || !arena) {
    return json(
      {
        error:
          arenaError?.message ||
          "Não foi possível criar a arena.",
      },
      400
    );
  }

  // ============================================================
  // CRIAR CONVITE DO PROPRIETÁRIO
  // ============================================================

  const {
    data: inviteData,
    error: inviteError,
  } =
    await admin.auth.admin.inviteUserByEmail(
      ownerEmail,
      {
        data: {
          full_name: ownerName,
          phone:
            payload.owner.phone ?? null,
          invited_as: "ARENA_ADMIN",
          arena_id: arena.id,
        },
      }
    );

  if (
    inviteError ||
    !inviteData.user
  ) {

    await admin
      .from("arenas")
      .delete()
      .eq("id", arena.id);

    return json(
      {
        error:
          inviteError?.message ||
          "Não foi possível enviar o convite ao proprietário.",
      },
      400
    );
  }

  const ownerId =
    inviteData.user.id;

  // ============================================================
  // TRANSFORMAR PROFILE EM ARENA_ADMIN
  // ============================================================

  const {
    error: profileError,
  } = await admin
    .from("profiles")
    .update({
      full_name: ownerName,
      phone:
        payload.owner.phone ?? null,
      role: "ARENA_ADMIN",
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", ownerId);

  if (profileError) {

    await admin.auth.admin.deleteUser(
      ownerId
    );

    await admin
      .from("arenas")
      .delete()
      .eq("id", arena.id);

    return json(
      {
        error:
          `Não foi possível configurar o proprietário: ${profileError.message}`,
      },
      400
    );
  }

  // ============================================================
  // VINCULAR PROPRIETÁRIO À ARENA
  // ============================================================

  const {
    error: membershipError,
  } = await admin
    .from("arena_users")
    .insert({
      arena_id: arena.id,
      user_id: ownerId,
      role: "ARENA_ADMIN",
      status: "ACTIVE",
    });

  if (membershipError) {

    await admin.auth.admin.deleteUser(
      ownerId
    );

    await admin
      .from("arenas")
      .delete()
      .eq("id", arena.id);

    return json(
      {
        error:
          `Não foi possível vincular o proprietário à arena: ${membershipError.message}`,
      },
      400
    );
  }

  // ============================================================
  // CRIAR ASSINATURA PENDENTE
  // ============================================================

  const {
    error: subscriptionError,
  } = await admin
    .from("arena_subscriptions")
    .insert({
      arena_id: arena.id,
      plan_id: plan.id,
      status: "PENDING",
      monthly_price:
        plan.monthly_price,
      notes:
        "Criada pelo SUPER_ADMIN. Aguardando primeiro pagamento.",
    });

  if (subscriptionError) {

    await admin.auth.admin.deleteUser(
      ownerId
    );

    await admin
      .from("arenas")
      .delete()
      .eq("id", arena.id);

    return json(
      {
        error:
          `Não foi possível criar a assinatura: ${subscriptionError.message}`,
      },
      400
    );
  }

  // ============================================================
  // SUCESSO
  // ============================================================

  return json({
    success: true,

    arena,

    owner: {
      id: ownerId,
      email: ownerEmail,
      role: "ARENA_ADMIN",
      invitation_sent: true,
    },

    subscription: {
      status: "PENDING",
      plan_id: plan.id,
      monthly_price:
        plan.monthly_price,
    },
  });
});