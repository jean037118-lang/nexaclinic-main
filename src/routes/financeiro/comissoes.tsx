import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Download } from 'lucide-react';
import { useFinancial } from '@/hooks/useFinancial';
import { CommissionsTable } from '@/components/financial/CommissionsTable';
import { CommissionForm } from '@/components/financial/CommissionForm';
import { CreateCommissionInput, UpdateCommissionInput, MedicalCommission } from '@/lib/financial/types';

export const Route = createFileRoute('/financeiro/comissoes')({
  head: () => ({ meta: [{ title: 'Comissões Médicas — NexaClinic' }] }),
  component: Comissoes,
});

function Comissoes() {
  const {
    commissions,
    createCommission,
    updateCommission,
    deleteCommission,
    exportCommissionsToCSV,
  } = useFinancial();

  const [showForm, setShowForm] = useState(false);
  const [editingCommission, setEditingCommission] = useState<MedicalCommission | undefined>();
  const [filterMonth, setFilterMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const filteredCommissions = commissions.filter((c) => c.month === filterMonth);

  const stats = {
    total: filteredCommissions.reduce((sum, c) => sum + c.value, 0),
    paid: filteredCommissions
      .filter((c) => c.status === 'pago')
      .reduce((sum, c) => sum + c.value, 0),
    pending: filteredCommissions
      .filter((c) => c.status !== 'pago')
      .reduce((sum, c) => sum + c.value, 0),
    count: filteredCommissions.length,
  };

  const handleSubmit = (data: CreateCommissionInput | UpdateCommissionInput) => {
    if (editingCommission) {
      updateCommission(editingCommission.id, data as UpdateCommissionInput);
      setEditingCommission(undefined);
    } else {
      createCommission(data as CreateCommissionInput);
    }
    setShowForm(false);
  };

  const handleEdit = (commission: MedicalCommission) => {
    setEditingCommission(commission);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCommission(undefined);
  };

  const handlePayAll = () => {
    const pendingCommissions = filteredCommissions.filter((c) => c.status !== 'pago');
    if (pendingCommissions.length === 0) {
      alert('Não há comissões pendentes para este mês');
      return;
    }

    if (
      confirm(
        `Tem certeza que deseja marcar ${pendingCommissions.length} comissão(ões) como paga(s)?`
      )
    ) {
      const today = new Date().toISOString().split('T')[0];
      pendingCommissions.forEach((commission) => {
        updateCommission(commission.id, {
          status: 'pago',
          paidAt: today,
        });
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Comissões Médicas</h1>
          <p className="mt-1 text-gray-600">Gerencie comissões e pagamentos dos médicos</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCommissionsToCSV}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="h-4 w-4" />
            Nova Comissão
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total de Comissões</p>
          <p className="text-2xl font-bold text-blue-600">{stats.count}</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total a Pagar</p>
          <p className="text-2xl font-bold text-red-600">
            R$ {stats.total.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Já Pagos</p>
          <p className="text-2xl font-bold text-green-600">
            R$ {stats.paid.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-600">
            R$ {stats.pending.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filtrar por mês:</label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {stats.pending > 0 && (
          <button
            onClick={handlePayAll}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Pagar Todas Pendentes
          </button>
        )}
      </div>

      {/* Table */}
      <CommissionsTable
        commissions={filteredCommissions}
        onEdit={handleEdit}
        onDelete={deleteCommission}
      />

      {showForm && (
        <CommissionForm
          onSubmit={handleSubmit}
          onCancel={handleCloseForm}
          initialData={editingCommission}
        />
      )}
    </div>
  );
}
