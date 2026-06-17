import { createFileRoute } from '@tanstack/react-router';
import { Download, FileText } from 'lucide-react';
import { useFinancial } from '@/hooks/useFinancial';
import { FinancialSummaryCard } from '@/components/financial/FinancialSummaryCard';
import { AccountsTable } from '@/components/financial/AccountsTable';

export const Route = createFileRoute('/financeiro/relatorios')({
  head: () => ({ meta: [{ title: 'Relatórios Financeiros — NexaClinic' }] }),
  component: Relatorios,
});

function Relatorios() {
  const {
    accounts,
    commissions,
    summary,
    loading,
    exportAccountsToCSV,
    exportCommissionsToCSV,
  } = useFinancial();

  const receivableAccounts = accounts.filter((a) => a.type === 'receber');
  const payableAccounts = accounts.filter((a) => a.type === 'pagar');

  const generateFullReport = () => {
    const now = new Date().toLocaleDateString('pt-BR');
    const reportData = `
RELATÓRIO FINANCEIRO - NEXACLINIC
Data: ${now}

RESUMO GERAL
=====================
Saldo Total: R$ ${summary?.balance?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}

Contas a Receber: R$ ${summary?.totalReceivable?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}
Contas a Pagar: R$ ${summary?.totalPayable?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}

Pendentes a Receber: R$ ${summary?.pendingReceivable?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}
Pendentes a Pagar: R$ ${summary?.pendingPayable?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}

Vencidos a Pagar: R$ ${summary?.overduePayable?.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) || '0,00'}

DETALHES POR CATEGORIA
=====================
Contas a Receber: ${receivableAccounts.length} registros
Contas a Pagar: ${payableAccounts.length} registros
Comissões Médicas: ${commissions.length} registros
    `;

    const blob = new Blob([reportData], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio-financeiro-${now.replace(/\//g, '-')}.txt`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Relatórios Financeiros</h1>
          <p className="mt-1 text-gray-600">Exporte e analise dados financeiros</p>
        </div>
      </div>

      {!loading && <FinancialSummaryCard summary={summary} />}

      {/* Export Options */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <button
              onClick={generateFullReport}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Gerar
            </button>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Relatório Geral</h3>
          <p className="text-sm text-gray-600">Resumo completo em formato texto</p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Download className="h-8 w-8 text-green-600" />
            <button
              onClick={exportAccountsToCSV}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              Exportar
            </button>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Contas (CSV)</h3>
          <p className="text-sm text-gray-600">
            {accounts.length} contas a pagar/receber
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <Download className="h-8 w-8 text-purple-600" />
            <button
              onClick={exportCommissionsToCSV}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
            >
              Exportar
            </button>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Comissões (CSV)</h3>
          <p className="text-sm text-gray-600">
            {commissions.length} comissões registradas
          </p>
        </div>
      </div>

      {/* Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contas a Receber</h2>
          <AccountsTable
            accounts={receivableAccounts.slice(0, 5)}
            onEdit={() => {}}
            onDelete={() => {}}
          />
          {receivableAccounts.length > 5 && (
            <p className="text-sm text-gray-600 mt-4">
              +{receivableAccounts.length - 5} registros adicionais
            </p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Contas a Pagar</h2>
          <AccountsTable
            accounts={payableAccounts.slice(0, 5)}
            onEdit={() => {}}
            onDelete={() => {}}
          />
          {payableAccounts.length > 5 && (
            <p className="text-sm text-gray-600 mt-4">
              +{payableAccounts.length - 5} registros adicionais
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
