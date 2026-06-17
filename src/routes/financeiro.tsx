/**
 * financeiro.tsx — Hub financeiro com painel de destinos
 *
 * Exibe:
 *  1. KPIs globais (recebido, pagar, saldo)
 *  2. Cards de destinos: Caixa Central / Conta Bancária / Maquininha
 *  3. Breakdown por método de pagamento dentro de cada destino
 *  4. Últimos recebimentos com rastreabilidade
 *
 * NOVO: Clicar em um card de destino abre o DestinoModal com
 *       todos os lançamentos do destino + filtro por data.
 */

import { useState, useCallback } from 'react';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  CreditCard, TrendingUp, TrendingDown, Users2, BarChart3,
  ArrowRight, Banknote, Smartphone, Wallet, Receipt,
  CheckCircle2, AlertCircle, Building2, Landmark, ExternalLink,
  Plus, ArrowRightLeft,
} from 'lucide-react';
import { MovimentacaoModal } from '@/components/financial/MovimentacaoModal';
import { useFinancial } from '@/hooks/useFinancial';
import type { DestinoFinanceiro, ResumoDestino } from '@/lib/financial/types';
import { DestinoModal } from '@/components/financial/DestinoModal';

export const Route = createFileRoute('/financeiro')({
  head: () => ({ meta: [{ title: 'Financeiro — NexaClinic' }] }),
  component: FinanceiroLayout,
});

function FinanceiroLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHub = pathname === '/financeiro' || pathname === '/financeiro/';
  if (!isHub) return <Outlet />;
  return <FinanceiroHub />;
}

// ─── Ícone do destino ──────────────────────────────────────────────────────────
function DestinoIcon({ destino, className }: { destino: DestinoFinanceiro; className?: string }) {
  if (destino === 'caixa_central')  return <Banknote className={className} />;
  if (destino === 'conta_bancaria') return <Landmark className={className} />;
  return <CreditCard className={className} />;
}

const DESTINO_CONFIG: Record<DestinoFinanceiro, {
  color: string; bg: string; border: string; textColor: string; badgeBg: string;
}> = {
  caixa_central:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  textColor: 'text-green-800',  badgeBg: 'bg-green-100'  },
  conta_bancaria: { color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',   textColor: 'text-teal-800',   badgeBg: 'bg-teal-100'   },
  maquininha:     { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   textColor: 'text-blue-800',   badgeBg: 'bg-blue-100'   },
};

// ─── Ícone por método ─────────────────────────────────────────────────────────
function MetodoIcon({ method }: { method: string }) {
  if (method === 'PIX')               return <Smartphone className="h-3.5 w-3.5" />;
  if (method?.toLowerCase().includes('crédit') || method?.toLowerCase().includes('credit')) return <CreditCard className="h-3.5 w-3.5" />;
  if (method?.toLowerCase().includes('débit')  || method?.toLowerCase().includes('debit'))  return <CreditCard className="h-3.5 w-3.5" />;
  if (method === 'Dinheiro')          return <Banknote className="h-3.5 w-3.5" />;
  return <Wallet className="h-3.5 w-3.5" />;
}

// ─── Card de destino (clicável) ───────────────────────────────────────────────
function DestinoCard({
  destino, label, total, entradas, metodos, formatCurrency, onClick,
}: {
  destino:  DestinoFinanceiro;
  label:    string;
  total:    number;
  entradas: number;
  metodos:  { metodo: string; valor: number }[];
  formatCurrency: (v: number) => string;
  onClick: () => void;
  onSaida?: () => void;
  onTransferencia?: () => void;
}) {
  const cfg = DESTINO_CONFIG[destino];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5 flex flex-col gap-3
        transition-all duration-150 hover:shadow-lg hover:-translate-y-0.5 hover:brightness-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        cursor-pointer group
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded-lg p-2 ${cfg.badgeBg}`}>
            <DestinoIcon destino={destino} className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${cfg.textColor}`}>{label}</p>
            <p className="text-[11px] text-muted-foreground">{entradas} recebimento{entradas !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className={`text-xl font-black ${cfg.color}`}>
            {formatCurrency(total)}
          </p>
          <ExternalLink className={`h-3.5 w-3.5 ${cfg.color} opacity-0 group-hover:opacity-60 transition-opacity`} />
        </div>
      </div>

      {/* Breakdown por método */}
      {metodos.length > 0 ? (
        <div className="space-y-1.5">
          {metodos
            .sort((a, b) => b.valor - a.valor)
            .map(({ metodo, valor }) => {
              const pct = total > 0 ? (valor / total) * 100 : 0;
              return (
                <div key={metodo} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 w-32 shrink-0">
                    <MetodoIcon method={metodo} />
                    <span className="text-xs text-slate-600 truncate">{metodo}</span>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.badgeBg} border ${cfg.border}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-20 text-right shrink-0">
                    {formatCurrency(valor)}
                  </span>
                </div>
              );
            })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum recebimento neste destino
        </p>
      )}

      {/* Ações rápidas */}
      <div className="flex items-center justify-between pt-1">
        <p className={`text-[10px] ${cfg.textColor} opacity-0 group-hover:opacity-70 transition-opacity font-medium`}>
          Clique para ver detalhes →
        </p>
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onSaida?.(); }}
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border bg-white/80 hover:bg-red-50 border-red-200 text-red-600 font-semibold transition-colors`}
          >
            ↓ Saída
          </span>
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onTransferencia?.(); }}
            className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border bg-white/80 hover:bg-violet-50 border-violet-200 text-violet-600 font-semibold transition-colors`}
          >
            ⇄ Transferir
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Hub principal ────────────────────────────────────────────────────────────
function FinanceiroHub() {
  const {
    summary, loading, formatCurrency, exportAccountsToCSV,
    resumoDestinos, apptAccounts, getContasByDestino,
  } = useFinancial();

  // ── Estado dos modais ────────────────────────────────────────────────────────
  const [modalDestino,      setModalDestino]      = useState<DestinoFinanceiro | null>(null);
  const [movModalOpen,      setMovModalOpen]      = useState(false);
  const [movDestino,        setMovDestino]        = useState<DestinoFinanceiro | undefined>(undefined);
  const [movModoInicial,    setMovModoInicial]    = useState<'saida'|'transferencia'>('saida');

  // Força re-render após salvar movimentação
  const [refreshKey, setRefreshKey] = useState(0);
  const handleMovSaved = useCallback(() => setRefreshKey(k => k + 1), []);

  function abrirSaida(destino: DestinoFinanceiro) {
    setMovDestino(destino);
    setMovModoInicial('saida');
    setMovModalOpen(true);
  }

  function abrirTransferencia(destino: DestinoFinanceiro) {
    setMovDestino(destino);
    setMovModoInicial('transferencia');
    setMovModalOpen(true);
  }

  // Saldos por destino (recebido - saído)
  const saldosPorDestino: Record<DestinoFinanceiro, number> = {
    caixa_central:  summary.caixaCentral,
    conta_bancaria: summary.contaBancaria,
    maquininha:     summary.maquininha,
  };

  const modalResumo: ResumoDestino | null =
    modalDestino ? resumoDestinos.find((r) => r.destino === modalDestino) ?? null : null;

  const modalContas = modalDestino ? getContasByDestino(modalDestino) : [];

  // ──────────────────────────────────────────────────────────────────────────
  const ultimosPagamentos = apptAccounts
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
    .slice(0, 8);

  const kpis = [
    {
      label: 'Total Recebido',
      value: formatCurrency(summary.totalReceivable),
      color: 'text-green-600',
      bg: 'bg-green-50', border: 'border-green-100',
      icon: TrendingUp,
    },
    {
      label: 'Total a Pagar',
      value: formatCurrency(summary.totalPayable),
      color: 'text-red-600',
      bg: 'bg-red-50', border: 'border-red-100',
      icon: TrendingDown,
    },
    {
      label: 'Saldo Geral',
      value: formatCurrency(summary.balance),
      color: summary.balance >= 0 ? 'text-green-700' : 'text-red-700',
      bg: summary.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50',
      border: summary.balance >= 0 ? 'border-emerald-100' : 'border-red-200',
      icon: Wallet,
    },
    {
      label: 'A Receber (Pendente)',
      value: formatCurrency(summary.pendingReceivable),
      color: 'text-amber-600',
      bg: 'bg-amber-50', border: 'border-amber-100',
      icon: AlertCircle,
    },
  ];

  const modules = [
    {
      to: '/financeiro/contas-receber',
      icon: TrendingUp, iconColor: 'text-green-600', iconBg: 'bg-green-100',
      title: 'Contas a Receber', desc: 'Receitas e cobranças',
      stat: formatCurrency(summary.totalReceivable), statColor: 'text-green-600',
    },
    {
      to: '/financeiro/contas-pagar',
      icon: TrendingDown, iconColor: 'text-red-600', iconBg: 'bg-red-100',
      title: 'Contas a Pagar', desc: 'Despesas e pagamentos',
      stat: formatCurrency(summary.totalPayable), statColor: 'text-red-600',
    },
    {
      to: '/financeiro/comissoes',
      icon: Users2, iconColor: 'text-purple-600', iconBg: 'bg-purple-100',
      title: 'Comissões Médicas', desc: 'Repasses e comissões',
      stat: formatCurrency(summary.totalCommissions), statColor: 'text-purple-600',
    },
    {
      to: '/financeiro/fluxo-caixa',
      icon: BarChart3, iconColor: 'text-blue-600', iconBg: 'bg-blue-100',
      title: 'Fluxo de Caixa', desc: 'Entradas e saídas por destino',
      stat: formatCurrency(summary.balance),
      statColor: summary.balance >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">
              Agendamentos + lançamentos manuais · separados por destino
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setMovDestino(undefined); setMovModalOpen(true); }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-500 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:from-violet-700 hover:to-purple-600 transition-all"
          >
            <Plus className="h-4 w-4" /> Nova Movimentação
          </button>
          <button
            onClick={exportAccountsToCSV}
            className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Receipt className="h-4 w-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={i} className={`rounded-xl border ${k.border} ${k.bg} p-4`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                  <Icon className={`h-4 w-4 ${k.color} opacity-70`} />
                </div>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Destinos financeiros ── */}
      {!loading && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Destinos de Recebimento
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {resumoDestinos.map((d) => (
              <DestinoCard
                key={d.destino}
                destino={d.destino}
                label={d.label}
                total={d.total}
                entradas={d.entradas}
                metodos={d.metodos}
                formatCurrency={formatCurrency}
                onClick={() => setModalDestino(d.destino)}
                onSaida={() => abrirSaida(d.destino)}
                onTransferencia={() => abrirTransferencia(d.destino)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Módulos de navegação */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Módulos</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <Link
                  key={m.to}
                  to={m.to}
                  className="group flex items-start gap-4 rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.iconBg}`}>
                    <Icon className={`h-5 w-5 ${m.iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                    {!loading && (
                      <p className={`mt-1 text-sm font-bold ${m.statColor}`}>{m.stat}</p>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Últimos recebimentos com rastreabilidade */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Últimos Recebimentos
          </h2>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            {ultimosPagamentos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                Nenhum pagamento registrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {ultimosPagamentos.map((a) => {
                  const destino = a.destino;
                  const cfg = destino ? DESTINO_CONFIG[destino] : null;
                  return (
                    <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-slate-800">{a.description}</p>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {new Date(a.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                            </span>
                            {a.paymentMethod && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                <MetodoIcon method={a.paymentMethod} />
                                {a.paymentMethod}
                              </span>
                            )}
                            {cfg && destino && (
                              <button
                                type="button"
                                onClick={() => setModalDestino(destino)}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.textColor} font-medium hover:opacity-80 transition-opacity cursor-pointer`}
                              >
                                {a.destino === 'caixa_central' ? 'Caixa' : a.destino === 'conta_bancaria' ? 'Banco' : 'Máquina'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-green-600 shrink-0">
                        {a.value > 0
                          ? a.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal de detalhe do destino ── */}
      <DestinoModal
        open={modalDestino !== null}
        onClose={() => setModalDestino(null)}
        destino={modalDestino}
        resumo={modalResumo}
        contas={modalContas}
        formatCurrency={formatCurrency}
      />

      <MovimentacaoModal
        open={movModalOpen}
        onClose={() => setMovModalOpen(false)}
        destinoInicial={movDestino}
        onSaved={handleMovSaved}
        formatCurrency={formatCurrency}
        saldos={saldosPorDestino}
      />
    </div>
  );
}
