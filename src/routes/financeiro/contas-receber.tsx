/**
 * contas-receber.tsx — NexaClinic
 *
 * Lista todas as contas a receber (manuais + agendamentos).
 * Exibe destino de cada lançamento para rastreabilidade.
 */

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Download, TrendingUp, Banknote, Landmark, CreditCard } from 'lucide-react';
import { useFinancial } from '@/hooks/useFinancial';
import { AccountsTable } from '@/components/financial/AccountsTable';
import { AccountForm } from '@/components/financial/AccountForm';
import type { CreateAccountInput, UpdateAccountInput, Account, DestinoFinanceiro } from '@/lib/financial/types';
import { DESTINO_LABELS } from '@/lib/financial/types';

export const Route = createFileRoute('/financeiro/contas-receber')({
  head: () => ({ meta: [{ title: 'Contas a Receber — NexaClinic' }] }),
  component: ContasReceber,
});

function DestinoIcon({ d }: { d: DestinoFinanceiro }) {
  if (d === 'caixa_central')  return <Banknote   className="h-4 w-4 text-green-600" />;
  if (d === 'conta_bancaria') return <Landmark   className="h-4 w-4 text-teal-600"  />;
  return                             <CreditCard className="h-4 w-4 text-blue-600"  />;
}

function ContasReceber() {
  const {
    summary, loading,
    createAccount, updateAccount, deleteAccount, getAccountsByType,
    exportAccountsToCSV, formatCurrency, resumoDestinos,
  } = useFinancial();

  const [showForm, setShowForm]         = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();
  const [filtroDestino, setFiltroDestino]   = useState<DestinoFinanceiro | 'todos'>('todos');

  const allAccounts = getAccountsByType('receber');
  const accounts = filtroDestino === 'todos'
    ? allAccounts
    : allAccounts.filter((a) => a.destino === filtroDestino);

  const handleSubmit = (data: CreateAccountInput | UpdateAccountInput) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data as UpdateAccountInput);
      setEditingAccount(undefined);
    } else {
      createAccount({ ...(data as CreateAccountInput), type: 'receber' });
    }
    setShowForm(false);
  };

  const handleEdit  = (account: Account) => { setEditingAccount(account); setShowForm(true); };
  const handleClose = () => { setShowForm(false); setEditingAccount(undefined); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-green-100 p-2.5">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contas a Receber</h1>
            <p className="text-sm text-muted-foreground">Receitas separadas por destino financeiro</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportAccountsToCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            <Plus className="h-4 w-4" /> Nova Receita
          </button>
        </div>
      </div>

      {/* KPIs globais */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total a Receber</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceivable)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{formatCurrency(summary.pendingReceivable)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vencidas</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(summary.overdueReceivable)}</p>
          </div>
        </div>
      )}

      {/* Cards de destino */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {resumoDestinos.map((d) => (
            <button
              key={d.destino}
              onClick={() => setFiltroDestino(filtroDestino === d.destino ? 'todos' : d.destino)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                filtroDestino === d.destino
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-white hover:border-primary/40'
              }`}
            >
              <DestinoIcon d={d.destino} />
              <div>
                <p className="text-xs font-semibold text-slate-600">{d.label}</p>
                <p className="text-base font-bold text-slate-800">{formatCurrency(d.total)}</p>
                <p className="text-[11px] text-muted-foreground">{d.entradas} recebimento{d.entradas !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filtro ativo */}
      {filtroDestino !== 'todos' && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <DestinoIcon d={filtroDestino} />
          <span className="text-sm font-medium">Filtrando: {DESTINO_LABELS[filtroDestino]}</span>
          <button
            onClick={() => setFiltroDestino('todos')}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar filtro
          </button>
        </div>
      )}

      <AccountsTable accounts={accounts} onEdit={handleEdit} onDelete={deleteAccount} />

      {showForm && (
        <AccountForm
          onSubmit={handleSubmit}
          onCancel={handleClose}
          initialData={editingAccount}
          defaultType="receber"
        />
      )}
    </div>
  );
}
