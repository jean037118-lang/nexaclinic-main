import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Download, TrendingDown } from 'lucide-react';
import { useFinancial } from '@/hooks/useFinancial';
import { AccountsTable } from '@/components/financial/AccountsTable';
import { AccountForm } from '@/components/financial/AccountForm';
import type { CreateAccountInput, UpdateAccountInput, Account } from '@/lib/financial/types';

export const Route = createFileRoute('/financeiro/contas-pagar')({
  head: () => ({ meta: [{ title: 'Contas a Pagar — NexaClinic' }] }),
  component: ContasPagar,
});

function ContasPagar() {
  const { summary, loading, createAccount, updateAccount, deleteAccount, getAccountsByType, exportAccountsToCSV, formatCurrency } = useFinancial();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | undefined>();

  const accounts = getAccountsByType('pagar');

  const handleSubmit = (data: CreateAccountInput | UpdateAccountInput) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data as UpdateAccountInput);
      setEditingAccount(undefined);
    } else {
      createAccount({ ...(data as CreateAccountInput), type: 'pagar' });
    }
    setShowForm(false);
  };

  const handleEdit = (account: Account) => { setEditingAccount(account); setShowForm(true); };
  const handleClose = () => { setShowForm(false); setEditingAccount(undefined); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-red-100 p-2.5">
            <TrendingDown className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Gerencie todas as despesas do consultório</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportAccountsToCSV} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
            <Download className="h-4 w-4" /> Exportar
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors">
            <Plus className="h-4 w-4" /> Nova Despesa
          </button>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total a Pagar</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(summary.totalPayable)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendentes</p>
            <p className="mt-1 text-2xl font-bold text-yellow-600">{formatCurrency(summary.pendingPayable)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vencidas</p>
            <p className="mt-1 text-2xl font-bold text-red-800">{formatCurrency(summary.overduePayable)}</p>
          </div>
        </div>
      )}

      <AccountsTable accounts={accounts} onEdit={handleEdit} onDelete={deleteAccount} />

      {showForm && (
        <AccountForm
          onSubmit={handleSubmit}
          onCancel={handleClose}
          initialData={editingAccount}
          defaultType="pagar"
        />
      )}
    </div>
  );
}
