import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
  Plus,
  Shield,
  User,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Mail,
  Phone,
  Pencil,
  Trash2,
  Ban,
  UserCheck,
  Save,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import { arenaService } from '../../services/arena.service';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

/* ==========================================================
   TIPOS
========================================================== */

type UserRole =
  | 'SUPER_ADMIN'
  | 'ARENA_ADMIN'
  | 'ARENA_STAFF'
  | 'CLIENT';

type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE';

interface ArenaMembership {
  id: string;
  arena_id: string;
  arena_name: string;
  arena_slug?: string | null;
  arena_status?: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface PlatformUser {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: string;
  profile_status: string;
  email_confirmed: boolean;
  last_sign_in_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  arena_count: number;
  arena_memberships: ArenaMembership[];
}

/* ==========================================================
   LABELS
========================================================== */

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ARENA_ADMIN: 'Admin da Arena',
  ARENA_STAFF: 'Funcionário',
  CLIENT: 'Cliente',
};

const roleClasses: Record<string, string> = {
  SUPER_ADMIN:
    'bg-purple-500/15 text-purple-300 border-purple-500/30',

  ARENA_ADMIN:
    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',

  ARENA_STAFF:
    'bg-blue-500/15 text-blue-300 border-blue-500/30',

  CLIENT:
    'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

/* ==========================================================
   HELPERS
========================================================== */

function formatPhone(
  value?: string | null,
): string {
  if (!value) return '';

  const digits =
    value.replace(/\D/g, '');

  if (digits.length <= 10) {
    return digits
      .replace(
        /^(\d{2})(\d)/,
        '($1) $2',
      )
      .replace(
        /(\d{4})(\d)/,
        '$1-$2',
      );
  }

  return digits
    .replace(
      /^(\d{2})(\d)/,
      '($1) $2',
    )
    .replace(
      /(\d{5})(\d)/,
      '$1-$2',
    );
}

function cleanPhone(
  value: string,
): string {
  return value.replace(/\D/g, '');
}

/* ==========================================================
   EXTRAIR ERRO REAL DA EDGE FUNCTION
========================================================== */

async function getFunctionErrorMessage(
  error: any,
  fallback: string,
): Promise<string> {
  try {
    /*
     * Supabase FunctionsHttpError normalmente
     * possui o Response em error.context.
     */
    if (
      error?.context instanceof Response
    ) {
      const response =
        error.context;

      const text =
        await response.text();

      if (text) {
        try {
          const json =
            JSON.parse(text);

          return (
            json?.error ||
            json?.message ||
            json?.details ||
            text
          );
        } catch {
          return text;
        }
      }
    }

    /*
     * Alguns erros podem possuir
     * context como objeto ou texto.
     */
    if (
      typeof error?.context ===
      'string'
    ) {
      return error.context;
    }

    if (
      error?.context?.error
    ) {
      return error.context.error;
    }

    if (
      error?.context?.message
    ) {
      return error.context.message;
    }

    if (error?.message) {
      return error.message;
    }

    return fallback;
  } catch (parseError) {
    console.error(
      'Erro ao interpretar erro da Edge Function:',
      parseError,
    );

    return (
      error?.message ||
      fallback
    );
  }
}

/* ==========================================================
   COMPONENTE
========================================================== */

export const UsersPage: React.FC<{
  onNavigate: (path: string) => void;
}> = () => {
  const { profile } = useAuth();

  /* ========================================================
     USUÁRIO LOGADO
  ======================================================== */

  const [currentUserId, setCurrentUserId] =
    useState<string | null>(null);

  /* ========================================================
     USUÁRIOS
  ======================================================== */

  const [users, setUsers] =
    useState<PlatformUser[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  /* ========================================================
     FILTROS
  ======================================================== */

  const [search, setSearch] =
    useState('');

  const [roleFilter, setRoleFilter] =
    useState('ALL');

  const [arenaFilter, setArenaFilter] =
    useState('ALL');

  const [statusFilter, setStatusFilter] =
    useState('ALL');

  /* ========================================================
     NOVO USUÁRIO
  ======================================================== */

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [createLoading, setCreateLoading] =
    useState(false);

  const [createForm, setCreateForm] =
    useState({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role: 'CLIENT' as UserRole,
      arena_id: '',
    });

  /* ========================================================
     GERENCIAR USUÁRIO
  ======================================================== */

  const [isManageModalOpen, setIsManageModalOpen] =
    useState(false);

  const [selectedUser, setSelectedUser] =
    useState<PlatformUser | null>(null);

  const [manageLoading, setManageLoading] =
    useState(false);

  const [statusLoading, setStatusLoading] =
    useState(false);

  const [manageForm, setManageForm] =
    useState({
      full_name: '',
      email: '',
      phone: '',
      role: 'CLIENT' as UserRole,
      arena_id: '',
    });

  /* ========================================================
     EXCLUSÃO
  ======================================================== */

  const [isDeleteModalOpen, setIsDeleteModalOpen] =
    useState(false);

  const [deleteLoading, setDeleteLoading] =
    useState(false);

  /* ========================================================
     USUÁRIO LOGADO
  ======================================================== */

  useEffect(() => {
    const loadCurrentUser =
      async () => {
        try {
          const {
            data: { user },
          } =
            await supabase.auth.getUser();

          if (user) {
            setCurrentUserId(
              user.id,
            );
          }
        } catch (err) {
          console.error(
            'Erro ao obter usuário atual:',
            err,
          );
        }
      };

    loadCurrentUser();
  }, []);

  /* ========================================================
     CARREGAR USUÁRIOS
  ======================================================== */

  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const data =
        await arenaService.getPlatformUsers();

      setUsers(
        (data || []) as PlatformUser[],
      );
    } catch (err: any) {
      console.error(
        'Erro ao carregar usuários:',
        err,
      );

      setError(
        err?.message ||
          'Não foi possível carregar os usuários da plataforma.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      profile?.role ===
      'SUPER_ADMIN'
    ) {
      loadUsers();
    }
  }, [profile?.role]);

  /* ========================================================
     ARENAS
  ======================================================== */

  const arenas = useMemo(() => {
    const map =
      new Map<string, string>();

    users.forEach((user) => {
      user.arena_memberships?.forEach(
        (membership) => {
          if (
            membership.arena_id &&
            membership.arena_name
          ) {
            map.set(
              membership.arena_id,
              membership.arena_name,
            );
          }
        },
      );
    });

    return Array.from(
      map.entries(),
    ).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
  }, [users]);

  /* ========================================================
     FILTRAR
  ======================================================== */

  const filteredUsers =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return users.filter(
        (user) => {
          /*
           * Perfil
           */
          if (
            roleFilter !==
              'ALL' &&
            user.role !==
              roleFilter
          ) {
            return false;
          }

          /*
           * Status
           */
          if (
            statusFilter !==
              'ALL' &&
            user.profile_status !==
              statusFilter
          ) {
            return false;
          }

          /*
           * Arena
           */
          if (
            arenaFilter !==
              'ALL'
          ) {
            const belongs =
              user.arena_memberships?.some(
                (membership) =>
                  membership.arena_id ===
                  arenaFilter,
              );

            if (!belongs) {
              return false;
            }
          }

          /*
           * Busca
           */
          if (!query) {
            return true;
          }

          return (
            user.full_name
              ?.toLowerCase()
              .includes(query) ||
            user.email
              ?.toLowerCase()
              .includes(query) ||
            user.phone
              ?.toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      users,
      search,
      roleFilter,
      arenaFilter,
      statusFilter,
    ]);

  /* ========================================================
     PROTEÇÃO
  ======================================================== */

  if (
    profile?.role !==
    'SUPER_ADMIN'
  ) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">

        <Shield className="w-10 h-10 text-rose-400 mx-auto mb-3" />

        <h2 className="text-lg font-bold text-white">
          Acesso restrito
        </h2>

        <p className="text-sm text-slate-400 mt-2">
          Somente SUPER_ADMIN pode
          gerenciar os usuários da
          plataforma.
        </p>

      </div>
    );
  }

  /* ========================================================
     RESET CREATE
  ======================================================== */

  const resetCreateForm =
    () => {
      setCreateForm({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'CLIENT',
        arena_id: '',
      });
    };

  /* ========================================================
     ABRIR CREATE
  ======================================================== */

  const openCreateModal =
    () => {
      resetCreateForm();
      setError(null);
      setIsCreateModalOpen(true);
    };

  /* ========================================================
     FECHAR CREATE
  ======================================================== */

  const closeCreateModal =
    () => {
      if (createLoading) {
        return;
      }

      setIsCreateModalOpen(false);
      resetCreateForm();
    };

  /* ========================================================
     CRIAR USUÁRIO
  ======================================================== */

  const handleCreateUser =
    async (
      event: React.FormEvent,
    ) => {
      event.preventDefault();

      setError(null);

      try {
        setCreateLoading(true);

        if (
          !createForm.full_name.trim()
        ) {
          throw new Error(
            'Informe o nome completo.',
          );
        }

        if (
          !createForm.email.trim()
        ) {
          throw new Error(
            'Informe o e-mail.',
          );
        }

        if (
          createForm.password.length <
          6
        ) {
          throw new Error(
            'A senha deve possuir pelo menos 6 caracteres.',
          );
        }

        if (
          (
            createForm.role ===
              'ARENA_ADMIN' ||
            createForm.role ===
              'ARENA_STAFF'
          ) &&
          !createForm.arena_id
        ) {
          throw new Error(
            'Selecione a arena do usuário.',
          );
        }

        const { data, error } =
          await supabase.functions.invoke(
            'manage-platform-user',
            {
              body: {
                action: 'CREATE',

                user: {
                  full_name:
                    createForm.full_name.trim(),

                  email:
                    createForm.email
                      .trim()
                      .toLowerCase(),

                  phone:
                    cleanPhone(
                      createForm.phone,
                    ),

                  password:
                    createForm.password,

                  role:
                    createForm.role,

                  arena_id:
                    createForm.role ===
                    'SUPER_ADMIN'
                      ? null
                      : createForm.arena_id ||
                        null,
                },
              },
            },
          );

        if (error) {
          const message =
            await getFunctionErrorMessage(
              error,
              'Erro ao criar usuário.',
            );

          throw new Error(
            message,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              data?.message ||
              'A Edge Function não confirmou a criação.',
          );
        }

        setIsCreateModalOpen(
          false,
        );

        resetCreateForm();

        await loadUsers();
      } catch (err: any) {
        console.error(
          'Erro ao criar usuário:',
          err,
        );

        setError(
          err?.message ||
            'Erro ao criar usuário.',
        );
      } finally {
        setCreateLoading(false);
      }
    };

  /* ========================================================
     ABRIR GERENCIAR
  ======================================================== */

  const openManageModal =
    (user: PlatformUser) => {
      const membership =
        user.arena_memberships?.find(
          (item) =>
            item.role ===
              'ARENA_ADMIN' ||
            item.role ===
              'ARENA_STAFF',
        ) ||
        user.arena_memberships?.[0];

      setSelectedUser(user);

      setManageForm({
        full_name:
          user.full_name || '',

        email:
          user.email || '',

        phone:
          formatPhone(
            user.phone,
          ),

        role:
          (user.role as UserRole) ||
          'CLIENT',

        arena_id:
          membership?.arena_id ||
          '',
      });

      setError(null);

      setIsManageModalOpen(true);
    };

  /* ========================================================
     FECHAR GERENCIAR
  ======================================================== */

  const closeManageModal =
    () => {
      if (
        manageLoading ||
        statusLoading
      ) {
        return;
      }

      setIsManageModalOpen(false);
      setSelectedUser(null);
    };

  /* ========================================================
     ATUALIZAR USUÁRIO
  ======================================================== */

  const handleUpdateUser =
    async (
      event: React.FormEvent,
    ) => {
      event.preventDefault();

      if (!selectedUser) {
        return;
      }

      setError(null);

      try {
        setManageLoading(true);

        if (
          !manageForm.full_name.trim()
        ) {
          throw new Error(
            'Informe o nome completo.',
          );
        }

        if (
          (
            manageForm.role ===
              'ARENA_ADMIN' ||
            manageForm.role ===
              'ARENA_STAFF'
          ) &&
          !manageForm.arena_id
        ) {
          throw new Error(
            'Selecione a arena do usuário.',
          );
        }

        const payload = {
          action: 'UPDATE',

          user_id:
            selectedUser.id,

          user: {
            full_name:
              manageForm.full_name.trim(),

            phone:
              cleanPhone(
                manageForm.phone,
              ),

            role:
              manageForm.role,

            arena_id:
              manageForm.role ===
              'SUPER_ADMIN'
                ? null
                : manageForm.arena_id ||
                  null,
          },
        };

        console.log(
          '[ArenaPro] UPDATE usuário:',
          payload,
        );

        const { data, error } =
          await supabase.functions.invoke(
            'manage-platform-user',
            {
              body: payload,
            },
          );

        if (error) {
          const message =
            await getFunctionErrorMessage(
              error,
              'Erro ao atualizar usuário.',
            );

          throw new Error(
            message,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              data?.message ||
              'A Edge Function não confirmou a atualização.',
          );
        }

        await loadUsers();

        setIsManageModalOpen(
          false,
        );

        setSelectedUser(null);

        setError(null);
      } catch (err: any) {
        console.error(
          'Erro ao atualizar usuário:',
          err,
        );

        setError(
          err?.message ||
            'Erro ao atualizar usuário.',
        );
      } finally {
        setManageLoading(false);
      }
    };

  /* ========================================================
     ATIVAR / DESATIVAR
  ======================================================== */

  const handleToggleStatus =
    async () => {
      if (!selectedUser) {
        return;
      }

      if (
        selectedUser.id ===
        currentUserId
      ) {
        setError(
          'Você não pode alterar o status do próprio usuário.',
        );

        return;
      }

      setError(null);

      try {
        setStatusLoading(true);

        const action =
          selectedUser.profile_status ===
          'ACTIVE'
            ? 'DEACTIVATE'
            : 'ACTIVATE';

        const payload = {
          action,

          user_id:
            selectedUser.id,
        };

        console.log(
          '[ArenaPro] Alterar status:',
          payload,
        );

        const { data, error } =
          await supabase.functions.invoke(
            'manage-platform-user',
            {
              body: payload,
            },
          );

        if (error) {
          const message =
            await getFunctionErrorMessage(
              error,
              'Erro ao alterar status do usuário.',
            );

          throw new Error(
            message,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              data?.message ||
              'A Edge Function não confirmou a alteração do status.',
          );
        }

        await loadUsers();

        setIsManageModalOpen(
          false,
        );

        setSelectedUser(null);
      } catch (err: any) {
        console.error(
          'Erro ao alterar status:',
          err,
        );

        setError(
          err?.message ||
            'Erro ao alterar status.',
        );
      } finally {
        setStatusLoading(false);
      }
    };

  /* ========================================================
     ABRIR EXCLUSÃO
  ======================================================== */

  const openDeleteModal =
    () => {
      if (!selectedUser) {
        return;
      }

      if (
        selectedUser.id ===
        currentUserId
      ) {
        setError(
          'Você não pode excluir o próprio usuário.',
        );

        return;
      }

      setIsDeleteModalOpen(true);
    };

  /* ========================================================
     FECHAR EXCLUSÃO
  ======================================================== */

  const closeDeleteModal =
    () => {
      if (deleteLoading) {
        return;
      }

      setIsDeleteModalOpen(false);
    };

  /* ========================================================
     EXCLUIR USUÁRIO
  ======================================================== */

  const handleDeleteUser =
    async () => {
      if (!selectedUser) {
        return;
      }

      if (
        selectedUser.id ===
        currentUserId
      ) {
        setError(
          'Você não pode excluir o próprio usuário.',
        );

        setIsDeleteModalOpen(
          false,
        );

        return;
      }

      setError(null);

      try {
        setDeleteLoading(true);

        const payload = {
          action: 'DELETE',

          user_id:
            selectedUser.id,
        };

        console.log(
          '[ArenaPro] DELETE usuário:',
          payload,
        );

        const { data, error } =
          await supabase.functions.invoke(
            'manage-platform-user',
            {
              body: payload,
            },
          );

        if (error) {
          const message =
            await getFunctionErrorMessage(
              error,
              'Erro ao excluir usuário.',
            );

          throw new Error(
            message,
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              data?.message ||
              'A Edge Function não confirmou a exclusão.',
          );
        }

        setIsDeleteModalOpen(
          false,
        );

        setIsManageModalOpen(
          false,
        );

        setSelectedUser(null);

        await loadUsers();
      } catch (err: any) {
        console.error(
          'Erro ao excluir usuário:',
          err,
        );

        setError(
          err?.message ||
            'Erro ao excluir usuário.',
        );

        setIsDeleteModalOpen(
          false,
        );
      } finally {
        setDeleteLoading(false);
      }
    };

  /* ========================================================
     RENDER
  ======================================================== */

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* ======================================================
          CABEÇALHO
      ====================================================== */}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

        <div>

          <div className="flex items-center gap-2">

            <h2 className="text-xl font-bold text-white tracking-tight">
              Usuários da Plataforma
            </h2>

            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
              SUPER ADMIN
            </span>

          </div>

          <p className="text-xs text-slate-400 mt-1">
            Controle global de usuários,
            permissões e vínculos com arenas.
          </p>

        </div>

        <div className="flex items-center gap-2">

          <button
            type="button"
            onClick={
              loadUsers
            }
            disabled={
              loading
            }
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >

            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />

            Atualizar

          </button>

          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition"
          >

            <Plus className="w-4 h-4" />

            Novo Usuário

          </button>

        </div>

      </div>

      {/* ======================================================
          ERRO
      ====================================================== */}

      {error && (

        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-300 text-xs flex items-start gap-3">

          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />

          <span className="flex-1 break-words">
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            className="text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

        </div>

      )}

      {/* ======================================================
          CARDS
      ====================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* TOTAL */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

          <div className="flex items-center justify-between">

            <div>

              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Total
              </span>

              <div className="text-xl font-extrabold text-white mt-1">
                {users.length}
              </div>

            </div>

            <Users className="w-5 h-5 text-slate-400" />

          </div>

        </div>

        {/* SUPER ADMINS */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

          <div className="flex items-center justify-between">

            <div>

              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Super Admins
              </span>

              <div className="text-xl font-extrabold text-purple-300 mt-1">
                {
                  users.filter(
                    (u) =>
                      u.role ===
                      'SUPER_ADMIN',
                  ).length
                }
              </div>

            </div>

            <Shield className="w-5 h-5 text-purple-300" />

          </div>

        </div>

        {/* ADMINISTRADORES */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

          <div className="flex items-center justify-between">

            <div>

              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Administradores
              </span>

              <div className="text-xl font-extrabold text-emerald-300 mt-1">
                {
                  users.filter(
                    (u) =>
                      u.role ===
                      'ARENA_ADMIN',
                  ).length
                }
              </div>

            </div>

            <Building2 className="w-5 h-5 text-emerald-300" />

          </div>

        </div>

        {/* CLIENTES */}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

          <div className="flex items-center justify-between">

            <div>

              <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                Clientes
              </span>

              <div className="text-xl font-extrabold text-blue-300 mt-1">
                {
                  users.filter(
                    (u) =>
                      u.role ===
                      'CLIENT',
                  ).length
                }
              </div>

            </div>

            <User className="w-5 h-5 text-blue-300" />

          </div>

        </div>

      </div>

      {/* ======================================================
          FILTROS
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">

          {/* BUSCA */}

          <div className="relative">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

            <input
              type="text"
              value={
                search
              }
              onChange={(e) =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="Buscar por nome, e-mail ou telefone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />

          </div>

          {/* PERFIL */}

          <select
            value={
              roleFilter
            }
            onChange={(e) =>
              setRoleFilter(
                e.target.value,
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >

            <option value="ALL">
              Todos os perfis
            </option>

            <option value="SUPER_ADMIN">
              Super Admin
            </option>

            <option value="ARENA_ADMIN">
              Admin da Arena
            </option>

            <option value="ARENA_STAFF">
              Funcionário
            </option>

            <option value="CLIENT">
              Cliente
            </option>

          </select>

          {/* ARENA */}

          <select
            value={
              arenaFilter
            }
            onChange={(e) =>
              setArenaFilter(
                e.target.value,
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >

            <option value="ALL">
              Todas as arenas
            </option>

            {arenas.map(
              ([id, name]) => (
                <option
                  key={id}
                  value={id}
                >
                  {name}
                </option>
              ),
            )}

          </select>

          {/* STATUS */}

          <select
            value={
              statusFilter
            }
            onChange={(e) =>
              setStatusFilter(
                e.target.value,
              )
            }
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >

            <option value="ALL">
              Todos os status
            </option>

            <option value="ACTIVE">
              Ativos
            </option>

            <option value="INACTIVE">
              Inativos
            </option>

          </select>

        </div>

      </div>

      {/* ======================================================
          TABELA
      ====================================================== */}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">

        <div className="overflow-x-auto">

          <table className="w-full text-left text-xs">

            <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">

              <tr>

                <th className="px-4 py-3">
                  Usuário
                </th>

                <th className="px-4 py-3">
                  E-mail
                </th>

                <th className="px-4 py-3">
                  Perfil
                </th>

                <th className="px-4 py-3">
                  Arena / Vínculo
                </th>

                <th className="px-4 py-3">
                  Status
                </th>

                <th className="px-4 py-3 text-right">
                  Ações
                </th>

              </tr>

            </thead>

            <tbody className="divide-y divide-slate-800/60">

              {loading ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center"
                  >

                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto mb-3" />

                    <p className="text-xs text-slate-400">
                      Carregando usuários da plataforma...
                    </p>

                  </td>

                </tr>

              ) : filteredUsers.length === 0 ? (

                <tr>

                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center"
                  >

                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />

                    <p className="text-sm font-semibold text-slate-300">
                      Nenhum usuário encontrado
                    </p>

                    <p className="text-xs text-slate-500 mt-1">
                      Ajuste os filtros ou cadastre um novo usuário.
                    </p>

                  </td>

                </tr>

              ) : (

                filteredUsers.map(
                  (user) => {

                    const isCurrentUser =
                      user.id ===
                      currentUserId;

                    return (

                      <tr
                        key={
                          user.id
                        }
                        className="hover:bg-slate-800/40 transition"
                      >

                        {/* USUÁRIO */}

                        <td className="px-4 py-3">

                          <div className="flex items-center gap-3">

                            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">

                              {user.role ===
                              'SUPER_ADMIN' ? (

                                <Shield className="w-4 h-4 text-purple-300" />

                              ) : (

                                <User className="w-4 h-4 text-slate-400" />

                              )}

                            </div>

                            <div>

                              <div className="flex items-center gap-2">

                                <div className="font-semibold text-slate-200">
                                  {user.full_name}
                                </div>

                                {isCurrentUser && (

                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                                    Você
                                  </span>

                                )}

                              </div>

                              {user.phone && (

                                <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">

                                  <Phone className="w-3 h-3" />

                                  {formatPhone(
                                    user.phone,
                                  )}

                                </div>

                              )}

                            </div>

                          </div>

                        </td>

                        {/* EMAIL */}

                        <td className="px-4 py-3">

                          <div className="flex items-center gap-1.5 text-slate-400">

                            <Mail className="w-3.5 h-3.5" />

                            {user.email}

                          </div>

                        </td>

                        {/* PERFIL */}

                        <td className="px-4 py-3">

                          <span
                            className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                              roleClasses[
                                user.role
                              ] ||
                              roleClasses.CLIENT
                            }`}
                          >

                            {roleLabels[
                              user.role
                            ] ||
                              user.role}

                          </span>

                        </td>

                        {/* ARENA */}

                        <td className="px-4 py-3">

                          {user.role ===
                          'SUPER_ADMIN' ? (

                            <span className="text-slate-400">
                              Global
                            </span>

                          ) : user.arena_memberships?.length >
                            0 ? (

                            <div className="space-y-1">

                              {user.arena_memberships
                                .slice(
                                  0,
                                  2,
                                )
                                .map(
                                  (
                                    membership,
                                  ) => (

                                    <div
                                      key={
                                        membership.id
                                      }
                                      className="flex items-center gap-1.5 text-slate-300"
                                    >

                                      <Building2 className="w-3 h-3 text-slate-500" />

                                      {
                                        membership.arena_name
                                      }

                                    </div>

                                  ),
                                )}

                              {user.arena_memberships.length >
                                2 && (

                                <span className="text-[10px] text-slate-500">

                                  +
                                  {user.arena_memberships.length -
                                    2}{' '}
                                  arenas

                                </span>

                              )}

                            </div>

                          ) : (

                            <span className="text-slate-600">
                              Sem vínculo
                            </span>

                          )}

                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-3">

                          {user.profile_status ===
                          'ACTIVE' ? (

                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 inline-flex items-center gap-1">

                              <CheckCircle2 className="w-3 h-3" />

                              ATIVO

                            </span>

                          ) : (

                            <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 inline-flex items-center gap-1">

                              <XCircle className="w-3 h-3" />

                              INATIVO

                            </span>

                          )}

                        </td>

                        {/* AÇÕES */}

                        <td className="px-4 py-3 text-right">

                          <button
                            type="button"
                            onClick={() =>
                              openManageModal(
                                user,
                              )
                            }
                            className="text-xs font-semibold text-slate-400 hover:text-emerald-400 transition inline-flex items-center gap-1.5"
                          >

                            <Pencil className="w-3.5 h-3.5" />

                            Gerenciar

                          </button>

                        </td>

                      </tr>

                    );
                  },
                )

              )}

            </tbody>

          </table>

        </div>

        {!loading &&
          filteredUsers.length >
            0 && (

          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-[10px] text-slate-500">

            Exibindo{' '}

            <span className="text-slate-300 font-bold">
              {filteredUsers.length}
            </span>{' '}

            de{' '}

            <span className="text-slate-300 font-bold">
              {users.length}
            </span>{' '}

            usuários.

          </div>

        )}

      </div>

      {/* ======================================================
          MODAL NOVO USUÁRIO
      ====================================================== */}

      {isCreateModalOpen && (

        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">

              <div>

                <h3 className="text-base font-bold text-white">
                  Novo Usuário
                </h3>

                <p className="text-xs text-slate-500 mt-0.5">
                  Crie um novo acesso para a plataforma.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeCreateModal
                }
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition"
              >

                <X className="w-4 h-4" />

              </button>

            </div>

            <form
              onSubmit={
                handleCreateUser
              }
              className="p-5 space-y-4"
            >

              {/* NOME */}

              <div>

                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Nome completo
                </label>

                <input
                  type="text"
                  value={
                    createForm.full_name
                  }
                  onChange={(e) =>
                    setCreateForm(
                      (current) => ({
                        ...current,
                        full_name:
                          e.target.value,
                      }),
                    )
                  }
                  placeholder="Nome completo"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* EMAIL */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    E-mail
                  </label>

                  <input
                    type="email"
                    value={
                      createForm.email
                    }
                    onChange={(e) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          email:
                            e.target.value,
                        }),
                      )
                    }
                    placeholder="usuario@email.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                </div>

                {/* TELEFONE */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Telefone
                  </label>

                  <input
                    type="text"
                    value={
                      createForm.phone
                    }
                    onChange={(e) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          phone:
                            formatPhone(
                              e.target.value,
                            ),
                        }),
                      )
                    }
                    placeholder="(34) 98888-8888"
                    maxLength={15}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                </div>

                {/* SENHA */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Senha
                  </label>

                  <input
                    type="password"
                    value={
                      createForm.password
                    }
                    onChange={(e) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          password:
                            e.target.value,
                        }),
                      )
                    }
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />

                </div>

                {/* PERFIL */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Perfil
                  </label>

                  <select
                    value={
                      createForm.role
                    }
                    onChange={(e) => {

                      const role =
                        e.target.value as UserRole;

                      setCreateForm(
                        (current) => ({
                          ...current,
                          role,
                          arena_id:
                            role ===
                            'SUPER_ADMIN'
                              ? ''
                              : current.arena_id,
                        }),
                      );

                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >

                    <option value="CLIENT">
                      Cliente
                    </option>

                    <option value="ARENA_STAFF">
                      Funcionário
                    </option>

                    <option value="ARENA_ADMIN">
                      Admin da Arena
                    </option>

                    <option value="SUPER_ADMIN">
                      Super Admin
                    </option>

                  </select>

                </div>

              </div>

              {/* ARENA */}

              {createForm.role !==
                'SUPER_ADMIN' && (

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">

                    Arena

                    {(
                      createForm.role ===
                        'ARENA_ADMIN' ||
                      createForm.role ===
                        'ARENA_STAFF'
                    ) && (

                      <span className="text-rose-400">
                        {' '}*
                      </span>

                    )}

                  </label>

                  <select
                    value={
                      createForm.arena_id
                    }
                    onChange={(e) =>
                      setCreateForm(
                        (current) => ({
                          ...current,
                          arena_id:
                            e.target.value,
                        }),
                      )
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >

                    <option value="">
                      {createForm.role ===
                      'CLIENT'
                        ? 'Nenhuma arena'
                        : 'Selecione uma arena'}
                    </option>

                    {arenas.map(
                      ([id, name]) => (
                        <option
                          key={id}
                          value={id}
                        >
                          {name}
                        </option>
                      ),
                    )}

                  </select>

                </div>

              )}

              {/* AÇÕES */}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">

                <button
                  type="button"
                  onClick={
                    closeCreateModal
                  }
                  disabled={
                    createLoading
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs font-bold disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    createLoading
                  }
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >

                  {createLoading ? (

                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>

                  ) : (

                    <>
                      <Plus className="w-4 h-4" />
                      Criar Usuário
                    </>

                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL GERENCIAR
      ====================================================== */}

      {isManageModalOpen &&
        selectedUser && (

        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">

            {/* HEADER */}

            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <h3 className="text-base font-bold text-white">
                    Gerenciar Usuário
                  </h3>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      roleClasses[
                        selectedUser.role
                      ] ||
                      roleClasses.CLIENT
                    }`}
                  >

                    {roleLabels[
                      selectedUser.role
                    ] ||
                      selectedUser.role}

                  </span>

                </div>

                <p className="text-xs text-slate-500 mt-0.5">
                  Edite os dados, permissões e status.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  closeManageModal
                }
                disabled={
                  manageLoading ||
                  statusLoading
                }
                className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
              >

                <X className="w-4 h-4" />

              </button>

            </div>

            {/* FORM */}

            <form
              onSubmit={
                handleUpdateUser
              }
              className="p-5 space-y-4"
            >

              {/* NOME */}

              <div>

                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Nome completo
                </label>

                <input
                  type="text"
                  value={
                    manageForm.full_name
                  }
                  onChange={(e) =>
                    setManageForm(
                      (current) => ({
                        ...current,
                        full_name:
                          e.target.value,
                      }),
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />

              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* EMAIL */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    E-mail
                  </label>

                  <div className="relative">

                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />

                    <input
                      type="email"
                      value={
                        manageForm.email
                      }
                      disabled
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-500 cursor-not-allowed"
                    />

                  </div>

                  <p className="text-[9px] text-slate-600 mt-1">
                    O e-mail não pode ser alterado nesta tela.
                  </p>

                </div>

                {/* TELEFONE */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Telefone
                  </label>

                  <div className="relative">

                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />

                    <input
                      type="text"
                      value={
                        manageForm.phone
                      }
                      onChange={(e) =>
                        setManageForm(
                          (current) => ({
                            ...current,
                            phone:
                              formatPhone(
                                e.target.value,
                              ),
                          }),
                        )
                      }
                      maxLength={15}
                      placeholder="(34) 98888-8888"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />

                  </div>

                </div>

                {/* PERFIL */}

                <div>

                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                    Perfil
                  </label>

                  <select
                    value={
                      manageForm.role
                    }
                    disabled={
                      selectedUser.id ===
                      currentUserId
                    }
                    onChange={(e) => {

                      const role =
                        e.target.value as UserRole;

                      setManageForm(
                        (current) => ({
                          ...current,
                          role,
                          arena_id:
                            role ===
                            'SUPER_ADMIN'
                              ? ''
                              : current.arena_id,
                        }),
                      );

                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >

                    <option value="CLIENT">
                      Cliente
                    </option>

                    <option value="ARENA_STAFF">
                      Funcionário
                    </option>

                    <option value="ARENA_ADMIN">
                      Admin da Arena
                    </option>

                    <option value="SUPER_ADMIN">
                      Super Admin
                    </option>

                  </select>

                  {selectedUser.id ===
                    currentUserId && (

                    <p className="text-[9px] text-amber-500 mt-1">
                      Você não pode alterar o próprio perfil.
                    </p>

                  )}

                </div>

                {/* ARENA */}

                {manageForm.role !==
                  'SUPER_ADMIN' && (

                  <div>

                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">

                      Arena

                      {(
                        manageForm.role ===
                          'ARENA_ADMIN' ||
                        manageForm.role ===
                          'ARENA_STAFF'
                      ) && (

                        <span className="text-rose-400">
                          {' '}*
                        </span>

                      )}

                    </label>

                    <select
                      value={
                        manageForm.arena_id
                      }
                      onChange={(e) =>
                        setManageForm(
                          (current) => ({
                            ...current,
                            arena_id:
                              e.target.value,
                          }),
                        )
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >

                      <option value="">
                        {manageForm.role ===
                        'CLIENT'
                          ? 'Nenhuma arena'
                          : 'Selecione uma arena'}
                      </option>

                      {arenas.map(
                        ([id, name]) => (
                          <option
                            key={id}
                            value={id}
                          >
                            {name}
                          </option>
                        ),
                      )}

                    </select>

                  </div>

                )}

              </div>

              {/* STATUS */}

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">

                <div className="flex items-center justify-between">

                  <div>

                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Status do acesso
                    </span>

                    <p className="text-xs text-slate-400 mt-1">
                      {selectedUser.profile_status ===
                      'ACTIVE'
                        ? 'Usuário pode acessar a plataforma.'
                        : 'Usuário está sem acesso à plataforma.'}
                    </p>

                  </div>

                  {selectedUser.profile_status ===
                  'ACTIVE' ? (

                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 flex items-center gap-1">

                      <CheckCircle2 className="w-3 h-3" />

                      ATIVO

                    </span>

                  ) : (

                    <span className="px-2 py-1 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 flex items-center gap-1">

                      <XCircle className="w-3 h-3" />

                      INATIVO

                    </span>

                  )}

                </div>

              </div>

              {/* AÇÕES */}

              <div className="pt-3 border-t border-slate-800">

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">

                  {/* ATIVAR / DESATIVAR */}

                  <button
                    type="button"
                    onClick={
                      handleToggleStatus
                    }
                    disabled={
                      selectedUser.id ===
                        currentUserId ||
                      statusLoading ||
                      manageLoading
                    }
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      selectedUser.profile_status ===
                      'ACTIVE'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    }`}
                  >

                    {statusLoading ? (

                      <Loader2 className="w-4 h-4 animate-spin" />

                    ) : selectedUser.profile_status ===
                      'ACTIVE' ? (

                      <Ban className="w-4 h-4" />

                    ) : (

                      <UserCheck className="w-4 h-4" />

                    )}

                    {selectedUser.profile_status ===
                    'ACTIVE'
                      ? 'Desativar'
                      : 'Ativar'}

                  </button>

                  <div className="flex items-center justify-end gap-2">

                    {/* EXCLUIR */}

                    <button
                      type="button"
                      onClick={
                        openDeleteModal
                      }
                      disabled={
                        selectedUser.id ===
                        currentUserId
                      }
                      className="px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition text-xs font-bold flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                    >

                      <Trash2 className="w-4 h-4" />

                      Excluir

                    </button>

                    {/* CANCELAR */}

                    <button
                      type="button"
                      onClick={
                        closeManageModal
                      }
                      disabled={
                        manageLoading ||
                        statusLoading
                      }
                      className="px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs font-bold"
                    >
                      Cancelar
                    </button>

                    {/* SALVAR */}

                    <button
                      type="submit"
                      disabled={
                        manageLoading ||
                        statusLoading
                      }
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 transition text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                    >

                      {manageLoading ? (

                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>

                      ) : (

                        <>
                          <Save className="w-4 h-4" />
                          Salvar
                        </>

                      )}

                    </button>

                  </div>

                </div>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ======================================================
          MODAL CONFIRMAÇÃO DE EXCLUSÃO
      ====================================================== */}

      {isDeleteModalOpen &&
        selectedUser && (

        <div className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">

          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl overflow-hidden">

            {/* HEADER */}

            <div className="px-5 py-4 border-b border-slate-800">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">

                  <AlertTriangle className="w-5 h-5 text-rose-400" />

                </div>

                <div>

                  <h3 className="text-base font-bold text-white">
                    Excluir usuário?
                  </h3>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Esta ação não poderá ser desfeita.
                  </p>

                </div>

              </div>

            </div>

            {/* CONTEÚDO */}

            <div className="p-5">

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">

                <div className="flex items-center gap-3">

                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">

                    {selectedUser.role ===
                    'SUPER_ADMIN' ? (

                      <Shield className="w-4 h-4 text-purple-300" />

                    ) : (

                      <User className="w-4 h-4 text-slate-400" />

                    )}

                  </div>

                  <div className="min-w-0">

                    <p className="text-sm font-bold text-slate-200 truncate">
                      {selectedUser.full_name}
                    </p>

                    <p className="text-xs text-slate-500 truncate">
                      {selectedUser.email}
                    </p>

                  </div>

                </div>

              </div>

              <div className="mt-4 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">

                <p className="text-xs text-rose-300 leading-relaxed">

                  O usuário será removido
                  permanentemente do sistema,
                  incluindo seu acesso à
                  plataforma e seus vínculos
                  com arenas.

                </p>

              </div>

              {/* BOTÕES */}

              <div className="flex justify-end gap-2 mt-5">

                <button
                  type="button"
                  onClick={
                    closeDeleteModal
                  }
                  disabled={
                    deleteLoading
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition text-xs font-bold disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={
                    handleDeleteUser
                  }
                  disabled={
                    deleteLoading
                  }
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >

                  {deleteLoading ? (

                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Excluindo...
                    </>

                  ) : (

                    <>
                      <Trash2 className="w-4 h-4" />
                      Sim, excluir
                    </>

                  )}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};