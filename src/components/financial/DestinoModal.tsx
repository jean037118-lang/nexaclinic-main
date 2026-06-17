/**
 * DestinoModal.tsx — NexaClinic
 * Detalhe de destino financeiro: Caixa Central / Conta Bancária / Maquininha
 * Filtro por data, período rápido, busca e status.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  X, Banknote, Landmark, CreditCard, Smartphone, Wallet,
  TrendingUp, Search, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  ArrowDownLeft, Filter, CalendarDays,
} from 'lucide-react';
import type { Account, DestinoFinanceiro, ResumoDestino } from '@/lib/financial/types';

// ─── Props ────────────────────────────────────────────────────────────────────
interface DestinoModalProps {
  open: boolean;
  onClose: () => void;
  destino: DestinoFinanceiro | null;
  resumo: ResumoDestino | null;
  contas: Account[];
  formatCurrency: (v: number) => string;
}

type SortField = 'dueDate' | 'value' | 'description';
type SortDir   = 'asc' | 'desc';
type Periodo   = '7d' | '30d' | '90d' | 'mes_atual' | 'mes_anterior' | 'ano' | 'personalizado';

// ─── Visual por destino ───────────────────────────────────────────────────────
const CFG: Record<DestinoFinanceiro, {
  gradient: string; iconBg: string; badge: string;
  badgeText: string; border: string;
}> = {
  caixa_central:  { gradient:'from-emerald-600 to-green-500', iconBg:'bg-white/20', badge:'bg-green-100',  badgeText:'text-green-800',  border:'border-green-200'  },
  conta_bancaria: { gradient:'from-teal-600 to-cyan-500',    iconBg:'bg-white/20', badge:'bg-teal-100',   badgeText:'text-teal-800',   border:'border-teal-200'   },
  maquininha:     { gradient:'from-blue-600 to-indigo-500',  iconBg:'bg-white/20', badge:'bg-blue-100',   badgeText:'text-blue-800',   border:'border-blue-200'   },
};

const DESTINO_NOME: Record<DestinoFinanceiro, string> = {
  caixa_central:  'Caixa Central',
  conta_bancaria: 'Conta Bancária',
  maquininha:     'Maquininha / Cartão',
};

const STATUS_CFG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  pago:      { icon: <CheckCircle2  className="h-3.5 w-3.5" />, label:'Pago',      color:'text-green-700', bg:'bg-green-50 border-green-200'  },
  pendente:  { icon: <Clock         className="h-3.5 w-3.5" />, label:'Pendente',  color:'text-amber-700', bg:'bg-amber-50 border-amber-200'  },
  vencido:   { icon: <AlertTriangle className="h-3.5 w-3.5" />, label:'Vencido',   color:'text-red-700',   bg:'bg-red-50 border-red-200'      },
  cancelado: { icon: <XCircle       className="h-3.5 w-3.5" />, label:'Cancelado', color:'text-slate-500', bg:'bg-slate-50 border-slate-200'  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function DestinoIcon({ d, cls }: { d: DestinoFinanceiro; cls?: string }) {
  const c = cls ?? 'h-6 w-6 text-white';
  if (d === 'caixa_central')  return <Banknote  className={c} />;
  if (d === 'conta_bancaria') return <Landmark  className={c} />;
  return <CreditCard className={c} />;
}

function MetodoIcon({ m }: { m?: string }) {
  if (m === 'PIX')               return <Smartphone className="h-3.5 w-3.5" />;
  if (m?.startsWith('Cartão'))   return <CreditCard className="h-3.5 w-3.5" />;
  if (m === 'Dinheiro')          return <Banknote   className="h-3.5 w-3.5" />;
  return <Wallet className="h-3.5 w-3.5" />;
}

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return `${day}/${m}/${y}`;
}

function periodoParaDatas(p: Periodo): { from: string; to: string } {
  const hoje = new Date();
  const y = hoje.getFullYear(), m = hoje.getMonth();
  switch (p) {
    case '7d':          return { from: toISO(new Date(hoje.getTime() - 6*864e5)), to: toISO(hoje) };
    case '30d':         return { from: toISO(new Date(hoje.getTime() - 29*864e5)), to: toISO(hoje) };
    case '90d':         return { from: toISO(new Date(hoje.getTime() - 89*864e5)), to: toISO(hoje) };
    case 'mes_atual':   return { from: toISO(new Date(y,m,1)),   to: toISO(new Date(y,m+1,0)) };
    case 'mes_anterior':return { from: toISO(new Date(y,m-1,1)), to: toISO(new Date(y,m,0))   };
    case 'ano':         return { from: `${y}-01-01`,             to: `${y}-12-31`              };
    default:            return { from: '', to: '' };
  }
}

// ─── Linha da tabela ──────────────────────────────────────────────────────────
function ContaRow({ conta, fmt, cfg }: {
  conta: Account;
  fmt: (v: number) => string;
  cfg: typeof CFG[DestinoFinanceiro];
}) {
  const st = STATUS_CFG[conta.status] ?? STATUS_CFG.pendente;
  const rec = conta.type === 'receber';
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
      <td className="py-3 pl-4 pr-2 text-xs text-slate-500 whitespace-nowrap">{fmtDate(conta.dueDate)}</td>
      <td className="py-3 px-2 max-w-[220px]">
        <p className="text-sm font-medium text-slate-800 truncate">{conta.description}</p>
        <p className="text-[11px] text-slate-400">{conta.category}</p>
      </td>
      <td className="py-3 px-2">
        {conta.paymentMethod
          ? <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.badge} ${cfg.badgeText} ${cfg.border}`}>
              <MetodoIcon m={conta.paymentMethod} />{conta.paymentMethod}
            </span>
          : <span className="text-[11px] text-slate-400">—</span>}
      </td>
      <td className="py-3 px-2 text-[11px] text-slate-400">
        {conta.origem === 'agendamento' ? '📅 Agenda' : '✏️ Manual'}
      </td>
      <td className="py-3 px-2">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${st.color} ${st.bg}`}>
          {st.icon}{st.label}
        </span>
      </td>
      <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
        <span className={`text-sm font-bold ${rec ? 'text-green-600' : 'text-red-500'}`}>
          {rec ? '+' : '-'}{fmt(conta.value)}
        </span>
      </td>
    </tr>
  );
}

// ─── Componente interno (hooks sempre chamados) ───────────────────────────────
function DestinoModalInner({
  onClose, destino, resumo, contas, formatCurrency,
}: Omit<DestinoModalProps, 'open'> & { destino: DestinoFinanceiro; resumo: ResumoDestino }) {

  // ── Estado — todos os hooks ANTES de qualquer return condicional ──────────
  const [periodo,      setPeriodo]      = useState<Periodo>('mes_atual');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortField,    setSortField]    = useState<SortField>('dueDate');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [showFilters,  setShowFilters]  = useState(true);   // filtros visíveis por padrão

  const cfg = CFG[destino];

  // Aplica período rápido: atualiza dateFrom / dateTo
  function aplicarPeriodo(p: Periodo) {
    setPeriodo(p);
    if (p !== 'personalizado') {
      const { from, to } = periodoParaDatas(p);
      setDateFrom(from);
      setDateTo(to);
    }
  }

  // Inicializa com mês atual ao montar
  useEffect(() => { aplicarPeriodo('mes_atual'); }, []);

  // ── Filtro + ordenação ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...contas];
    if (dateFrom) list = list.filter(c => c.dueDate >= dateFrom);
    if (dateTo)   list = list.filter(c => c.dueDate <= dateTo);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.description.toLowerCase().includes(q) ||
        (c.category ?? '').toLowerCase().includes(q) ||
        (c.paymentMethod ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'todos') list = list.filter(c => c.status === statusFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'dueDate')     cmp = a.dueDate.localeCompare(b.dueDate);
      if (sortField === 'value')       cmp = a.value - b.value;
      if (sortField === 'description') cmp = a.description.localeCompare(b.description);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [contas, dateFrom, dateTo, search, statusFilter, sortField, sortDir]);

  const totalPago     = filtered.filter(c => c.type === 'receber' && c.status === 'pago').reduce((s,c) => s+c.value, 0);
  const totalSaidoPago = filtered.filter(c => c.type === 'pagar' && c.status === 'pago').reduce((s,c) => s+c.value, 0);
  const totalPendente = filtered.filter(c => c.type === 'receber' && c.status === 'pendente').reduce((s,c) => s+c.value, 0);

  function toggleSort(f: SortField) {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('desc'); }
  }

  function SortIcon({ f }: { f: SortField }) {
    if (sortField !== f) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp   className="h-3 w-3 text-slate-600" />
      : <ChevronDown className="h-3 w-3 text-slate-600" />;
  }

  function limpar() {
    setSearch(''); setStatusFilter('todos');
    aplicarPeriodo('mes_atual');
  }

  const hasFilter = search || statusFilter !== 'todos' || dateFrom || dateTo;

  const PERIODOS: { id: Periodo; label: string }[] = [
    { id:'7d',           label:'7 dias'       },
    { id:'30d',          label:'30 dias'      },
    { id:'mes_atual',    label:'Mês atual'    },
    { id:'mes_anterior', label:'Mês anterior' },
    { id:'90d',          label:'90 dias'      },
    { id:'ano',          label:'Este ano'     },
    { id:'personalizado',label:'Personalizado'},
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-r ${cfg.gradient} px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className={`rounded-xl ${cfg.iconBg} p-2.5`}>
              <DestinoIcon d={destino} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{DESTINO_NOME[destino]}</h2>
              <p className="text-white/70 text-sm">
                {resumo.entradas} lançamento{resumo.entradas !== 1 ? 's' : ''} · detalhamento completo
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/20 hover:bg-white/30 p-1.5 text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 shrink-0">
          {[
            { label:'Saldo do destino', value:formatCurrency(resumo.total),             color:'text-green-600',  icon:<TrendingUp    className="h-4 w-4"/> },
            { label:'Recebido (período filtrado)', value:formatCurrency(totalPago),      color:'text-emerald-600',icon:<ArrowDownLeft className="h-4 w-4"/> },
            { label:'Pendente (período filtrado)', value:formatCurrency(totalPendente),  color:'text-amber-600', icon:<Clock         className="h-4 w-4"/> },
          ].map(k => (
            <div key={k.label} className="flex flex-col items-center justify-center py-3 gap-0.5">
              <div className={`flex items-center gap-1 ${k.color}`}>{k.icon}</div>
              <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide text-center px-2">{k.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filtros ───────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 shrink-0 space-y-3">

          {/* Linha 1: Períodos rápidos */}
          <div className="flex items-center gap-2 flex-wrap">
            <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
            {PERIODOS.map(p => (
              <button
                key={p.id}
                onClick={() => aplicarPeriodo(p.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  periodo === p.id
                    ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-sm`
                    : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
                showFilters ? 'bg-white border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-100'
              }`}
            >
              <Filter className="h-3.5 w-3.5" /> {showFilters ? 'Ocultar filtros' : 'Mais filtros'}
            </button>
          </div>

          {/* Linha 2: Datas personalizadas (sempre visíveis quando periodo=personalizado) */}
          {(showFilters || periodo === 'personalizado') && (
            <div className="flex flex-wrap items-center gap-3">
              {/* Datas */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">De:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPeriodo('personalizado'); }}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">Até:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPeriodo('personalizado'); }}
                  className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
                />
              </div>

              {/* Busca */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar descrição, método..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="todos">Todos os status</option>
                <option value="pago">Pago</option>
                <option value="pendente">Pendente</option>
                <option value="vencido">Vencido</option>
                <option value="cancelado">Cancelado</option>
              </select>

              {hasFilter && (
                <button onClick={limpar} className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap">
                  ✕ Limpar
                </button>
              )}
            </div>
          )}

          {/* Resumo do período selecionado */}
          {(dateFrom || dateTo) && (
            <p className="text-xs text-slate-500">
              Exibindo: {dateFrom ? fmtDate(dateFrom) : '—'} até {dateTo ? fmtDate(dateTo) : '—'}
              {' · '}<strong>{filtered.length}</strong> registro{filtered.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Tabela ────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <Wallet className="h-10 w-10 opacity-30" />
              <p className="text-sm font-medium">Nenhum lançamento para o período selecionado</p>
              <button onClick={limpar} className="text-xs text-blue-500 hover:underline">Limpar filtros</button>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  {([
                    { f:'dueDate',     label:'Data'       },
                    { f:'description', label:'Descrição'  },
                    { f:null,          label:'Método'     },
                    { f:null,          label:'Origem'     },
                    { f:null,          label:'Status'     },
                    { f:'value',       label:'Valor'      },
                  ] as { f: SortField | null; label: string }[]).map(col => (
                    <th
                      key={col.label}
                      onClick={col.f ? () => toggleSort(col.f as SortField) : undefined}
                      className={`py-2.5 px-2 first:pl-4 last:pr-4 last:text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500 select-none ${col.f ? 'cursor-pointer hover:text-slate-700' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {col.f && <SortIcon f={col.f as SortField} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <ContaRow key={c.id} conta={c} fmt={formatCurrency} cfg={cfg} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Rodapé ────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-between shrink-0 bg-slate-50/50">
          <p className="text-xs text-slate-400">
            {filtered.length} lançamento{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
            {hasFilter && ' · filtros ativos'}
          </p>
          <div className="flex items-center gap-3">
            {resumo.metodos.slice(0, 3).map(({ metodo, valor }) => (
              <span key={metodo} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cfg.badge} ${cfg.badgeText} ${cfg.border}`}>
                <MetodoIcon m={metodo} />{metodo}: {formatCurrency(valor)}
              </span>
            ))}
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-sm font-medium text-slate-700 transition-colors">
              Fechar
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Wrapper público — monta/desmonta para resetar estado ─────────────────────
export function DestinoModal(props: DestinoModalProps) {
  if (!props.open || !props.destino || !props.resumo) return null;
  return (
    <DestinoModalInner
      {...props}
      destino={props.destino}
      resumo={props.resumo}
    />
  );
}
