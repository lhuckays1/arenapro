import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { UserCheck, Shield, User, Plus } from 'lucide-react';

export const UsersPage: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { profile } = useAuth();

  const usersList = [
    {
      id: '1',
      name: 'Rodrigo Gestor',
      email: 'admin@arenaxp.com',
      role: 'ARENA_ADMIN',
      status: 'ACTIVE',
    },
    {
      id: '2',
      name: 'Carlos Atendente',
      email: 'staff@arenaxp.com',
      role: 'ARENA_STAFF',
      status: 'ACTIVE',
    },
  ];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Usuários da Arena</h2>
          <p className="text-xs text-slate-400">Controle de acessos de administradores e funcionários da unidade</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Nome / Usuário</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Nível de Acesso</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {usersList.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/40 transition">
                <td className="px-4 py-3 font-semibold text-slate-200">{u.name}</td>
                <td className="px-4 py-3 text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    u.role === 'ARENA_ADMIN'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                    {u.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
