/**
 * MovimentacaoModal.tsx — NexaClinic
 * Modal para registrar:
 *   - Saída de caixa (retirada de dinheiro de um destino)
 *   - Transferência entre destinos (ex: Caixa → Banco)
 */

import { useState, useEffect } from 'react';
import {
  X, Banknote, Landmark, CreditCard, ArrowRightLeft,
  TrendingDown, AlertCircle, CheckCircle2,
} from 'lucide-react';
import type { DestinoFinanceiro } from '@/lib/financial/types';
import {
  DESTINO_LABELS, metodoParaDestinoDefault, METODOS_PAGAMENTO,
} from '@/lib/financial/types';
import { financialStorage } from '@/lib/financial/storage';
import { toast } from 'sonner';

// ─── Props ────────────────────────────────────────────────────────────────────
export interface MovimentacaoModalProps {
  open: boolean;
  onClose: () => void;
  /** Se informado, pré-seleciona o destino de origem */
  destinoInicial?: DestinoFinanceiro;
  /** Chamado após salvar para recarregar dados */
  onSaved: () => void;
  formatCurrency: (v: number) => string;
  /** Saldo disponível por destino */
  saldos: Record<DestinoFinanceiro, number>;
}

type Modo = 'saida' | 'transferencia';

// ─── Config visual ────────────────────────────────────────────────────────────
const DCFG: Record<DestinoFinanceiro, {
  label: string; gradient: string; iconBg: string; border: string; text: string;
}> = {
  caixa_central:  { label:'Caixa Central',        gradient:'from-emerald-600 to-green-500', iconBg:'bg-green-100',  border:'border-green-300',  text:'text-green-800'  },
  conta_bancaria: { label:'Conta Bancária',        gradient:'from-teal-600 to-cyan-500',     iconBg:'bg-teal-100',   border:'border-teal-300',   text:'text-teal-800'   },
  maquininha:     { label:'Maquininha / Cartão',  gradient:'from-blue-600 to-indigo-500',   iconBg:'bg-blue-100',   border:'border-blue-300',   text:'text-blue-800'   },
};

const DESTINOS: DestinoFinanceiro[] = ['caixa_central', 'conta_bancaria', 'maquininha'];

const CATEGORIAS_SAIDA = [
  'Retirada / Sangria',
  'Pagamento de fornecedor',
  'Despesa administrativa',
  'Aluguel',
  'Salário / Honorários',
  'Material de escritório',
  'Manutenção',
  'Impostos e taxas',
  'Outro',
];

function DestinoIcon({ d, cls }: { d: DestinoFinanceiro; cls?: string }) {
  const c = cls ?? 'h-5 w-5';
  if (d === 'caixa_central')  return <Banknote  className={c} />;
  if (d === 'conta_bancaria') return <Landmark  className={c} />;
  return <CreditCard className={c} />;
}

// ─── Componente interno (todos os hooks antes de qualquer return) ──────────────
function MovimentacaoInner({
  onClose, destinoInicial, onSaved, formatCurrency, saldos,
}: Omit<MovimentacaoModalProps, 'open'>) {

  const [modo,        setModo]        = useState<Modo>('saida');
  const [origem,      setOrigem]      = useState<DestinoFinanceiro>(destinoInicial ?? 'caixa_central');
  const [destino,     setDestino]     = useState<DestinoFinanceiro>('conta_bancaria');
  const [valor,       setValor]       = useState('');
  const [descricao,   setDescricao]   = useState('');
  const [categoria,   setCategoria]   = useState(CATEGORIAS_SAIDA[0]);
  const [data,        setData]        = useState(() => new Date().toISOString().split('T')[0]);
  const [metodo,      setMetodo]      = useState<string>('Dinheiro');
  const [obs,         setObs]         = useState('');
  const [salvando,    setSalvando]    = useState(false);
  const [erros,       setErros]       = useState<string[]>([]);

  // Quando muda origem na transferência, ajusta destino para não ser igual
  useEffect(() => {
    if (modo === 'transferencia' && destino === origem) {
      const outro = DESTINOS.find(d => d !== origem);
      if (outro) setDestino(outro);
    }
  }, [origem, modo]);

  // Pré-preenche método ao mudar modo/origem
  useEffect(() => {
    if (modo === 'saida') setMetodo('Dinheiro');
  }, [modo]);

  const valorNum = parseFloat(valor.replace(',', '.')) || 0;
  const saldoOrigem = saldos[origem] ?? 0;
  const saldoInsuficiente = valorNum > saldoOrigem && saldoOrigem > 0;

  function validar(): string[] {
    const e: string[] = [];
    if (!valor || valorNum <= 0) e.push('Informe um valor maior que zero.');
    if (!descricao.trim() && modo === 'saida') e.push('Informe a descrição.');
    if (!data) e.push('Informe a data.');
    if (modo === 'transferencia' && origem === destino) e.push('Origem e destino não podem ser iguais.');
    return e;
  }

  async function salvar() {
    const e = validar();
    if (e.length) { setErros(e); return; }
    setErros([]);
    setSalvando(true);

    const now = new Date().toISOString();
    const id = `mov_${Date.now()}`;

    try {
      if (modo === 'saida') {
        // ── Saída simples: uma conta a pagar marcada como paga ───────────────
        financialStorage.saveAccount({
          id,
          type: 'pagar',
          description: descricao.trim() || categoria,
          value: valorNum,
          dueDate: data,
          category: categoria,
          status: 'pago',
          paymentMethod: metodo as any,
          destino: origem,                // saiu deste destino
          origem: 'manual',
          notes: obs.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        });
        toast.success(`Saída registrada — ${formatCurrency(valorNum)}`, {
          description: `${DESTINO_LABELS[origem]} → ${descricao || categoria}`,
        });

      } else {
        // ── Transferência: saída da origem + entrada no destino ───────────────
        const desc = descricao.trim() || `Transferência ${DESTINO_LABELS[origem]} → ${DESTINO_LABELS[destino]}`;

        // Saída da origem
        financialStorage.saveAccount({
          id: `${id}_saida`,
          type: 'pagar',
          description: `[Transf. saída] ${desc}`,
          value: valorNum,
          dueDate: data,
          category: 'Transferência entre destinos',
          status: 'pago',
          destino: origem,
          origem: 'manual',
          notes: `Transferência para ${DESTINO_LABELS[destino]}. ${obs}`.trim(),
          createdAt: now,
          updatedAt: now,
        });

        // Entrada no destino
        financialStorage.saveAccount({
          id: `${id}_entrada`,
          type: 'receber',
          description: `[Transf. entrada] ${desc}`,
          value: valorNum,
          dueDate: data,
          category: 'Transferência entre destinos',
          status: 'pago',
          destino: destino,
          origem: 'manual',
          notes: `Transferência de ${DESTINO_LABELS[origem]}. ${obs}`.trim(),
          createdAt: now,
          updatedAt: now,
        });

        toast.success(`Transferência registrada — ${formatCurrency(valorNum)}`, {
          description: `${DESTINO_LABELS[origem]} → ${DESTINO_LABELS[destino]}`,
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error('Erro ao salvar movimentação.');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  }

  const destinos_destino = DESTINOS.filter(d => d !== origem);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-r ${modo === 'saida' ? 'from-red-600 to-rose-500' : 'from-violet-600 to-purple-500'} px-6 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5">
              {modo === 'saida'
                ? <TrendingDown className="h-6 w-6 text-white" />
                : <ArrowRightLeft className="h-6 w-6 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {modo === 'saida' ? 'Registrar Saída' : 'Transferência entre Destinos'}
              </h2>
              <p className="text-white/70 text-sm">
                {modo === 'saida' ? 'Retirada ou despesa de um destino' : 'Mover valor entre Caixa, Banco ou Maquininha'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg bg-white/20 hover:bg-white/30 p-1.5 text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Seletor de modo ───────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200 shrink-0">
          {([
            { id: 'saida',         label: '↓ Saída / Retirada', icon: TrendingDown    },
            { id: 'transferencia', label: '⇄ Transferência',    icon: ArrowRightLeft  },
          ] as { id: Modo; label: string; icon: any }[]).map(m => {
            const Icon = m.icon;
            const active = modo === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setModo(m.id); setErros([]); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold border-b-2 transition-all ${
                  active
                    ? m.id === 'saida'
                      ? 'border-red-500 text-red-700 bg-red-50'
                      : 'border-violet-500 text-violet-700 bg-violet-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" /> {m.label}
              </button>
            );
          })}
        </div>

        {/* ── Formulário ────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {/* Erros */}
          {erros.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 space-y-1">
              {erros.map((e, i) => (
                <p key={i} className="text-sm text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          {/* Origem */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {modo === 'saida' ? 'Destino de saída *' : 'Origem *'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DESTINOS.map(d => {
                const cfg = DCFG[d];
                const sel = origem === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOrigem(d)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all text-center ${
                      sel ? `${cfg.border} ${cfg.iconBg} shadow-sm` : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <DestinoIcon d={d} cls={`h-5 w-5 ${sel ? cfg.text : 'text-slate-400'}`} />
                    <span className={`text-[11px] font-semibold leading-tight ${sel ? cfg.text : 'text-slate-500'}`}>
                      {cfg.label}
                    </span>
                    <span className={`text-[10px] font-bold ${sel ? cfg.text : 'text-slate-400'}`}>
                      {formatCurrency(saldos[d] ?? 0)}
                    </span>
                  </button>
                );
              })}
            </div>
            {saldoInsuficiente && (
              <p className="mt-1.5 text-xs text-amber-700 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Valor maior que o saldo disponível ({formatCurrency(saldoOrigem)})
              </p>
            )}
          </div>

          {/* Destino — só na transferência */}
          {modo === 'transferencia' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Destino *</label>
              <div className="grid grid-cols-2 gap-2">
                {destinos_destino.map(d => {
                  const cfg = DCFG[d];
                  const sel = destino === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDestino(d)}
                      className={`flex items-center gap-2.5 rounded-xl border-2 p-3 transition-all ${
                        sel ? `${cfg.border} ${cfg.iconBg} shadow-sm` : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <DestinoIcon d={d} cls={`h-5 w-5 ${sel ? cfg.text : 'text-slate-400'}`} />
                      <div className="text-left">
                        <p className={`text-xs font-semibold ${sel ? cfg.text : 'text-slate-600'}`}>{cfg.label}</p>
                        <p className={`text-[10px] ${sel ? cfg.text : 'text-slate-400'}`}>{formatCurrency(saldos[d] ?? 0)}</p>
                      </div>
                      {sel && <CheckCircle2 className={`ml-auto h-4 w-4 ${cfg.text}`} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fluxo visual da transferência */}
          {modo === 'transferencia' && (
            <div className="flex items-center justify-center gap-3 py-1">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${DCFG[origem].iconBg} ${DCFG[origem].text} text-xs font-semibold`}>
                <DestinoIcon d={origem} cls="h-3.5 w-3.5" />
                {DCFG[origem].label}
              </div>
              <ArrowRightLeft className="h-4 w-4 text-slate-400" />
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${DCFG[destino].iconBg} ${DCFG[destino].text} text-xs font-semibold`}>
                <DestinoIcon d={destino} cls="h-3.5 w-3.5" />
                {DCFG[destino].label}
              </div>
            </div>
          )}

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valor (R$) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder="0,00"
                  className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    saldoInsuficiente ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Data *</label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Categoria — só saída */}
          {modo === 'saida' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Categoria *</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CATEGORIAS_SAIDA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Método — só saída */}
          {modo === 'saida' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Forma de pagamento</label>
              <div className="flex flex-wrap gap-2">
                {METODOS_PAGAMENTO.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetodo(m)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      metodo === m
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {modo === 'saida' ? 'Descrição *' : 'Descrição (opcional)'}
            </label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder={modo === 'saida' ? 'Ex: Retirada para despesas do mês' : 'Ex: Sangria para depósito bancário'}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Observações</label>
            <textarea
              rows={2}
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Informações adicionais..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Resumo */}
          {valorNum > 0 && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              modo === 'saida' ? 'border-red-100 bg-red-50' : 'border-violet-100 bg-violet-50'
            }`}>
              {modo === 'saida' ? (
                <p className="text-red-800">
                  Será registrada uma <strong>saída de {formatCurrency(valorNum)}</strong> do{' '}
                  <strong>{DCFG[origem].label}</strong> na categoria <strong>{categoria}</strong>.
                </p>
              ) : (
                <p className="text-violet-800">
                  Serão registradas: saída de <strong>{formatCurrency(valorNum)}</strong> do{' '}
                  <strong>{DCFG[origem].label}</strong> e entrada de <strong>{formatCurrency(valorNum)}</strong>{' '}
                  no <strong>{DCFG[destino].label}</strong>.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Rodapé ────────────────────────────────────────────────────── */}
        <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-end gap-3 bg-slate-50/50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60 flex items-center gap-2 ${
              modo === 'saida'
                ? 'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600'
                : 'bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600'
            }`}
          >
            {salvando
              ? 'Salvando...'
              : modo === 'saida'
                ? '↓ Registrar Saída'
                : '⇄ Confirmar Transferência'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper público ──────────────────────────────────────────────────────────
export function MovimentacaoModal(props: MovimentacaoModalProps) {
  if (!props.open) return null;
  return <MovimentacaoInner {...props} />;
}
