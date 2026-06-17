/**
 * fluxo-caixa.tsx — NexaClinic
 *
 * Fluxo de caixa agora permite filtrar por destino:
 *  - Todos os destinos (visão consolidada)
 *  - Caixa Central
 *  - Conta Bancária
 *  - Maquininha
 */

import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { BarChart3, Banknote, Landmark, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { useFinancial } from '@/hooks/useFinancial';
import { CashFlowChart } from '@/components/financial/CashFlowChart';
import type { DestinoFinanceiro } from '@/lib/financial/types';

export const Route = createFileRoute('/financeiro/fluxo-caixa')({
  head: () => ({ meta: [{ title: 'Fluxo de Caixa — NexaClinic' }] }),
  component: FluxoCaixa,
});

const DESTINO_OPTIONS: { value: DestinoFinanceiro | 'todos'; label: string; icon: React.ReactNode }[] = [
  { value: 'todos',         label: 'Todos',          icon: <BarChart3 className="h-4 w-4" /> },
  { value: 'caixa_central', label: 'Caixa Central',  icon: <Banknote  className="h-4 w-4" /> },
  { value: 'conta_bancaria',label: 'Conta Bancária', icon: <Landmark  className="h-4 w-4" /> },
  { value: 'maquininha',    label: 'Maquininha',     icon: <CreditCard className="h-4 w-4" /> },
];

function FluxoCaixa() {
  const { calculateCashFlow, formatCurrency, summary, loading, resumoDestinos } = useFinancial();
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [destino, setDestino] = useState<DestinoFinanceiro | 'todos'>('todos');

  const cashFlow = calculateCashFlow(days, destino === 'todos' ? undefined : destino);

  const totalEntradas = cashFlow.reduce((s, d) => s + d.entrada, 0);
  const totalSaidas   = cashFlow.reduce((s, d) => s + d.saida,   0);
  const saldoFinal    = totalEntradas - totalSaidas;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-2.5">
          <BarChart3 className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Entradas e saídas por destino financeiro</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Período */}
        <div className="flex rounded-lg border bg-white overflow-hidden">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-primary text-white'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {d} dias
            </button>
          ))}
        </div>

        {/* Destino */}
        <div className="flex rounded-lg border bg-white overflow-hidden">
          {DESTINO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDestino(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                destino === opt.value
                  ? 'bg-primary text-white'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Resumo do período filtrado */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entradas</p>
            </div>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saídas</p>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p>
          </div>
          <div className={`rounded-xl border p-4 ${saldoFinal >= 0 ? 'border-emerald-100 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Saldo do Período</p>
            <p className={`text-xl font-bold ${saldoFinal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {formatCurrency(saldoFinal)}
            </p>
          </div>
        </div>
      )}

      {/* Gráfico */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <CashFlowChart data={cashFlow} />
      </div>

      {/* Tabela de totais por destino */}
      {!loading && destino === 'todos' && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-4">Totais por Destino</h3>
          <div className="space-y-2">
            {resumoDestinos.map((d) => (
              <div key={d.destino} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {d.destino === 'caixa_central'  && <Banknote   className="h-4 w-4 text-green-600" />}
                  {d.destino === 'conta_bancaria' && <Landmark   className="h-4 w-4 text-teal-600" />}
                  {d.destino === 'maquininha'     && <CreditCard className="h-4 w-4 text-blue-600" />}
                  <span className="text-sm font-medium">{d.label}</span>
                  <span className="text-xs text-muted-foreground">({d.entradas} lançamentos)</span>
                </div>
                <span className="text-sm font-bold text-green-600">{formatCurrency(d.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
