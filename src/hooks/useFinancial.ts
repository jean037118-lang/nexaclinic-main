/**
 * useFinancial.ts — NexaClinic (v2 — com destinos financeiros)
 *
 * ARQUITETURA DE DESTINOS:
 * ┌──────────────────────────────────────────────────────┐
 * │  Pagamento da Agenda                                 │
 * │    Dinheiro / Cheque    → Caixa Central              │
 * │    PIX / Transferência  → Conta Bancária             │
 * │    Cartão Créd/Déb      → Maquininha                 │
 * └──────────────────────────────────────────────────────┘
 *
 * RASTREABILIDADE:
 *  - Toda conta carrega: paymentMethod, destino, origem, origemId
 *  - Agendamentos → origem='agendamento', origemId=appointment.id
 *  - Lançamentos manuais → origem='manual'
 *  - Nunca se perde de onde veio nem para onde foi
 *
 * SEPARAÇÃO DE VISÕES:
 *  - resumoDestinos        → saldo por destino (caixa / banco / maquininha)
 *  - resumoPorMetodo       → breakdown por forma de pagamento
 *  - getContasByDestino()  → filtra lançamentos por destino
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { financialStorage } from '@/lib/financial/storage';
import {
  metodoParaDestinoDefault,
  DESTINO_LABELS,
  METODOS_PAGAMENTO,
  type Account,
  type MedicalCommission,
  type FinancialSummary,
  type CashFlowData,
  type CreateAccountInput,
  type UpdateAccountInput,
  type DestinoFinanceiro,
  type MetodoPagamento,
  type ResumoDestino,
} from '@/lib/financial/types';

export { METODOS_PAGAMENTO };
export type { MetodoPagamento, DestinoFinanceiro };

// ─── Tipo raw do agendamento ───────────────────────────────────────────────────
interface AppointmentRaw {
  id: string;
  patientName: string;
  professionalId: string;
  date: string;
  start: string;
  procedure?: string;
  insurance?: string;
  status: string;
  paid?: boolean;
  pago?: boolean;
  amount?: number;
  procedureValue?: number;
  paymentMethod?: string;
  cardBrand?: string;
  taxaMDR?: number;
  valorLiquido?: number;
  valorTaxaMDR?: number;
  numeroParcelas?: number;
  datasParcelas?: string[];
  sentToBilling?: boolean;
  // Pagamento dividido em 2 formas (ex: parte em Dinheiro, parte no Cartão).
  // Quando presente, cada item vira uma Account própria com seu destino,
  // em vez de jogar o valor todo em um único destino.
  paymentSplit?: { method: string; amount: number; cardBrand?: string; authCode?: string }[];
}

const APPT_KEY = 'nexaclinic_appointments_v3';

function loadPaidAppointments(): AppointmentRaw[] {
  try {
    const raw = localStorage.getItem(APPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // ✅ Garante que o dado é array antes de filtrar — localStorage pode conter
    // objeto ou null se houve migração de chave ou gravação incorreta.
    const all: AppointmentRaw[] = Array.isArray(parsed) ? parsed : [];
    return all.filter(
      (a) =>
        (a.paid === true || a.pago === true) &&
        a.status !== 'cancelado' &&
        a.status !== 'faltou'
    );
  } catch {
    return [];
  }
}

/**
 * Converte agendamento pago → Account(s) virtual com destino correto.
 * A forma de pagamento define automaticamente o destino:
 *   Dinheiro → caixa_central
 *   PIX      → conta_bancaria
 *   Cartão   → maquininha
 *
 * Quando o pagamento foi dividido em 2 formas (ex: parte Dinheiro + parte
 * Cartão), retorna DUAS Accounts — uma por forma de pagamento — cada uma
 * com seu próprio destino e valor, em vez de jogar o total em um destino só.
 */
function apptToAccount(a: AppointmentRaw): Account[] {
  if (a.paymentSplit && a.paymentSplit.length > 0) {
    return a.paymentSplit
      .filter((s) => s.amount > 0)
      .map((s, idx) => {
        const metodo  = (s.method ?? 'Dinheiro') as MetodoPagamento;
        const destino = metodoParaDestinoDefault(metodo);
        const isCard  = metodo === 'Cartão de Crédito' || metodo === 'Cartão de Débito';
        // Rateia a taxa MDR proporcionalmente apenas na parcela em cartão
        const valorReal = isCard && a.valorTaxaMDR && a.amount
          ? parseFloat((s.amount - (a.valorTaxaMDR * (s.amount / a.amount))).toFixed(2))
          : s.amount;
        return {
          id:            `appt_${a.id}_${idx + 1}`,
          type:          'receber',
          description:   `${a.procedure || 'Consulta'} — ${a.patientName} (${idx + 1}ª forma)`,
          value:         valorReal,
          dueDate:       a.date,
          category:      a.insurance || 'Particular',
          status:        'pago',
          paymentMethod: metodo,
          destino,
          origem:        'agendamento',
          origemId:      a.id,
          notes:         `Pagamento dividido — Forma ${idx + 1}: ${metodo} | Destino: ${DESTINO_LABELS[destino]}` + (s.cardBrand ? ` | Bandeira: ${s.cardBrand}` : ''),
          createdAt:     `${a.date}T${a.start || '08:00'}:00`,
          updatedAt:     `${a.date}T${a.start || '08:00'}:00`,
        } as Account;
      });
  }

  const valor   = a.amount ?? a.procedureValue ?? 0;
  const metodo  = (a.paymentMethod ?? 'Dinheiro') as MetodoPagamento;
  const destino = metodoParaDestinoDefault(metodo);
  // Para cartão: usar valorLiquido (já com MDR descontado) como valor real da clínica
  const valorReal = (metodo === 'Cartão de Crédito' || metodo === 'Cartão de Débito') && a.valorLiquido
    ? a.valorLiquido
    : (a.amount ?? a.procedureValue ?? 0);

  return [{
    id:            `appt_${a.id}`,
    type:          'receber',
    description:   `${a.procedure || 'Consulta'} — ${a.patientName}`,
    value:         valorReal,
    dueDate:       a.date,
    category:      a.insurance || 'Particular',
    status:        'pago',
    paymentMethod: metodo,
    destino,
    origem:        'agendamento',
    origemId:      a.id,
    notes:         `Forma: ${metodo} | Destino: ${DESTINO_LABELS[destino]}` + (a.taxaMDR ? ` | MDR ${a.taxaMDR}% = R$ ${a.valorTaxaMDR?.toFixed(2) ?? '?'} | Líquido: R$ ${valorReal.toFixed(2)}` : '') + (a.numeroParcelas && a.numeroParcelas > 1 ? ` | ${a.numeroParcelas}x` : ''),
    createdAt:     `${a.date}T${a.start || '08:00'}:00`,
    updatedAt:     `${a.date}T${a.start || '08:00'}:00`,
  }];
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
}

// ═══════════════════════════════════════════════════════════════════════════════
export function useFinancial() {
  const [manualAccounts, setManualAccounts] = useState<Account[]>([]);
  const [commissions, setCommissions]       = useState<MedicalCommission[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      // ✅ financialStorage agora é assíncrono (Supabase) — precisa de await,
      // senão recebemos a Promise em vez do array e quebra o .map/.filter adiante.
      const [rawAccounts, rawCommissions] = await Promise.all([
        financialStorage.getAccounts(),
        financialStorage.getCommissions(),
      ]);
      setManualAccounts(Array.isArray(rawAccounts) ? rawAccounts : []);
      setCommissions(Array.isArray(rawCommissions) ? rawCommissions : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      setManualAccounts([]);
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Permite recarregar manualmente após operações feitas fora dos helpers
  // deste hook (ex: MovimentacaoModal salvando direto via financialStorage).
  const reload = useCallback(() => { carregar(); }, [carregar]);

  // Agendamentos pagos → accounts virtuais (com destino calculado)
  const apptAccounts = useMemo<Account[]>(() => {
    return loadPaidAppointments().flatMap(apptToAccount);
  }, []);

  // Todas as contas unificadas
  // ✅ Array.isArray guards evitam "r is not iterable" caso alguma fonte retorne
  // null/undefined (ex: storage falhou silenciosamente antes do setLoading(false)).
  const accounts = useMemo<Account[]>(
    () => [
      ...(Array.isArray(manualAccounts) ? manualAccounts : []),
      ...(Array.isArray(apptAccounts)   ? apptAccounts   : []),
    ],
    [manualAccounts, apptAccounts]
  );

  // ── Resumo financeiro global ───────────────────────────────────────────────
  const summary: FinancialSummary = useMemo(() => {
    const receivable = accounts.filter((a) => a.type === 'receber');
    const payable    = accounts.filter((a) => a.type === 'pagar');
    const recebido   = receivable.filter((a) => a.status === 'pago').reduce((s, a) => s + a.value, 0);
    const pago       = payable.filter((a) => a.status === 'pago').reduce((s, a) => s + a.value, 0);

    const byDestino = (d: DestinoFinanceiro) => {
      const entradas = accounts
        .filter((a) => a.type === 'receber' && a.status === 'pago' && a.destino === d)
        .reduce((s, a) => s + a.value, 0);
      const saidas = accounts
        .filter((a) => a.type === 'pagar' && a.status === 'pago' && a.destino === d)
        .reduce((s, a) => s + a.value, 0);
      return entradas - saidas;
    };

    return {
      totalReceivable:   receivable.reduce((s, a) => s + a.value, 0),
      totalPayable:      payable.reduce((s, a) => s + a.value, 0),
      balance:           recebido - pago,
      pendingReceivable: receivable.filter((a) => a.status === 'pendente').reduce((s, a) => s + a.value, 0),
      pendingPayable:    payable.filter((a) => a.status === 'pendente').reduce((s, a) => s + a.value, 0),
      overdueReceivable: receivable.filter((a) => a.status === 'vencido').reduce((s, a) => s + a.value, 0),
      overduePayable:    payable.filter((a) => a.status === 'vencido').reduce((s, a) => s + a.value, 0),
      totalCommissions:  (Array.isArray(commissions) ? commissions : []).reduce((s, c) => s + c.value, 0),
      accountsCount:     accounts.length,
      commissionsCount:  commissions.length,
      caixaCentral:  byDestino('caixa_central'),
      contaBancaria: byDestino('conta_bancaria'),
      maquininha:    byDestino('maquininha'),
    };
  }, [accounts, commissions]);

  // ── Resumo detalhado por destino ───────────────────────────────────────────
  const resumoDestinos: ResumoDestino[] = useMemo(() => {
    const destinos: DestinoFinanceiro[] = ['caixa_central', 'conta_bancaria', 'maquininha'];
    return destinos.map((d) => {
      const entradas = accounts.filter(
        (a) => a.type === 'receber' && a.status === 'pago' && a.destino === d
      );
      const saidas = accounts.filter(
        (a) => a.type === 'pagar' && a.status === 'pago' && a.destino === d
      );
      const totalEntradas = entradas.reduce((s, a) => s + a.value, 0);
      const totalSaidas   = saidas.reduce((s, a) => s + a.value, 0);
      const saldo         = totalEntradas - totalSaidas;

      const metodoMap: Record<string, number> = {};
      entradas.forEach((c) => {
        const m = c.paymentMethod ?? 'Outros';
        metodoMap[m] = (metodoMap[m] ?? 0) + c.value;
      });
      return {
        destino:  d,
        label:    DESTINO_LABELS[d],
        total:    saldo,           // saldo real = entradas - saídas
        entradas: entradas.length,
        metodos:  Object.entries(metodoMap).map(([metodo, valor]) => ({ metodo, valor })),
      };
    });
  }, [accounts]);

  // ── Resumo por método de pagamento ────────────────────────────────────────
  const resumoPorMetodo = useMemo(() => {
    const result: Record<string, number> = {};
    METODOS_PAGAMENTO.forEach((m) => { result[m] = 0; });
    result['Outros'] = 0;

    accounts
      .filter((a) => a.type === 'receber' && a.status === 'pago')
      .forEach((a) => {
        const method = a.paymentMethod?.trim() || 'Outros';
        const key = METODOS_PAGAMENTO.includes(method as MetodoPagamento) ? method : 'Outros';
        result[key] = (result[key] ?? 0) + a.value;
      });

    return Object.entries(result)
      .filter(([, v]) => v > 0)
      .map(([method, value]) => ({ method, value }))
      .sort((a, b) => b.value - a.value);
  }, [accounts]);

  // ── Filtrar contas por destino ─────────────────────────────────────────────
  const getContasByDestino = useCallback(
    (destino: DestinoFinanceiro) =>
      accounts.filter((a) => a.destino === destino),
    [accounts]
  );

  // ── CRUD contas manuais ────────────────────────────────────────────────────
  const createAccount = useCallback(async (data: CreateAccountInput) => {
    try {
      // Garante que contas manuais recebidas também têm destino calculado
      const destino = data.destino ?? (
        data.paymentMethod
          ? metodoParaDestinoDefault(data.paymentMethod)
          : undefined
      );
      const newAccount: Account = {
        ...data,
        destino,
        origem: 'manual',
        id:        '', // gerado pelo Supabase (uuid)
        status:    data.status ?? 'pendente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const saved = await financialStorage.saveAccount(newAccount);
      setManualAccounts((prev) => [...prev, saved]);
      return saved;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta';
      setError(msg);
      throw err;
    }
  }, []);

  const updateAccount = useCallback(async (accountId: string, updates: UpdateAccountInput) => {
    if (accountId.startsWith('appt_')) return; // imutável — veio da agenda
    try {
      const all = await financialStorage.getAccounts();
      const idx = all.findIndex((a) => a.id === accountId);
      if (idx === -1) throw new Error('Conta não encontrada');

      // Recalcula destino se o método de pagamento mudou
      const paymentMethod = updates.paymentMethod ?? all[idx].paymentMethod;
      const destino = updates.destino ?? (
        paymentMethod ? metodoParaDestinoDefault(paymentMethod) : all[idx].destino
      );

      const updated: Account = {
        ...all[idx],
        ...updates,
        destino,
        id:        all[idx].id,
        createdAt: all[idx].createdAt,
        updatedAt: new Date().toISOString(),
      };
      const saved = await financialStorage.saveAccount(updated);
      setManualAccounts((prev) => prev.map((a) => (a.id === accountId ? saved : a)));
      return saved;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar conta';
      setError(msg);
      throw err;
    }
  }, []);

  const deleteAccount = useCallback(async (accountId: string) => {
    if (accountId.startsWith('appt_')) return;
    try {
      await financialStorage.deleteAccount(accountId);
      setManualAccounts((prev) => prev.filter((a) => a.id !== accountId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao deletar conta';
      setError(msg);
      throw err;
    }
  }, []);

  const getAccountsByType = useCallback(
    (type: 'pagar' | 'receber') => accounts.filter((a) => a.type === type),
    [accounts]
  );

  // ── CRUD comissões ─────────────────────────────────────────────────────────
  const createCommission = useCallback(
    async (data: Omit<MedicalCommission, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        const newC: MedicalCommission = {
          ...data,
          id:        '', // gerado pelo Supabase (uuid)
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const saved = await financialStorage.saveCommission(newC);
        setCommissions((prev) => [...prev, saved]);
        return saved;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao criar comissão');
        throw err;
      }
    },
    []
  );

  const updateCommission = useCallback(async (id: string, updates: Partial<MedicalCommission>) => {
    try {
      const all = await financialStorage.getCommissions();
      const idx = all.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error('Comissão não encontrada');
      const updated: MedicalCommission = {
        ...all[idx],
        ...updates,
        id:        all[idx].id,
        createdAt: all[idx].createdAt,
        updatedAt: new Date().toISOString(),
      };
      const saved = await financialStorage.saveCommission(updated);
      setCommissions((prev) => prev.map((c) => (c.id === id ? saved : c)));
      return saved;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar comissão');
      throw err;
    }
  }, []);

  const deleteCommission = useCallback(async (id: string) => {
    try {
      await financialStorage.deleteCommission(id);
      setCommissions((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar comissão');
      throw err;
    }
  }, []);

  // ── Fluxo de caixa por destino ─────────────────────────────────────────────
  const getCashFlow = useCallback(
    (
      startDate: string,
      endDate: string,
      destino?: DestinoFinanceiro
    ): CashFlowData[] => {
      const start = new Date(startDate + 'T00:00:00');
      const end   = new Date(endDate   + 'T23:59:59');

      const data: Record<string, { entrada: number; saida: number }> = {};
      const cur = new Date(start);
      while (cur <= end) {
        data[cur.toISOString().split('T')[0]] = { entrada: 0, saida: 0 };
        cur.setDate(cur.getDate() + 1);
      }

      const filteredAccounts = destino
        ? accounts.filter((a) => a.destino === destino)
        : accounts;

      filteredAccounts
        .filter((a) => a.status === 'pago')
        .forEach((a) => {
          const key = (a.updatedAt || a.dueDate || '').split('T')[0];
          if (data[key]) {
            if (a.type === 'receber') data[key].entrada += a.value;
            else                      data[key].saida   += a.value;
          }
        });

      let saldoAcumulado = 0;
      return Object.entries(data).map(([date, { entrada, saida }]) => {
        saldoAcumulado += entrada - saida;
        return { date: fmtDate(date), entrada, saida, saldo: saldoAcumulado };
      });
    },
    [accounts]
  );

  const calculateCashFlow = useCallback(
    (days: 7 | 30 | 90 = 30, destino?: DestinoFinanceiro): CashFlowData[] => {
      const end   = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days + 1);
      return getCashFlow(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
        destino
      );
    },
    [getCashFlow]
  );

  // ── Exportar CSV com rastreabilidade completa ──────────────────────────────
  const exportAccountsToCSV = useCallback(() => {
    const rows = [
      [
        'Tipo', 'Descrição', 'Valor', 'Data', 'Status',
        'Categoria', 'Forma Pagamento', 'Destino', 'Origem', 'ID Origem',
      ],
      ...accounts.map((a) => [
        a.type === 'receber' ? 'A Receber' : 'A Pagar',
        a.description,
        a.value.toFixed(2).replace('.', ','),
        fmtDate(a.dueDate),
        a.status,
        a.category,
        a.paymentMethod ?? '—',
        a.destino ? DESTINO_LABELS[a.destino] : '—',
        a.origem ?? '—',
        a.origemId ?? '—',
      ]),
    ];
    const csv  = rows.map((r) => r.map((v) => `"${v}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `financeiro-nexaclinic-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [accounts]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatDate = (dateStr: string) => fmtDate(dateStr);

  return {
    // Dados
    accounts,
    manualAccounts,
    apptAccounts,
    commissions,
    loading,
    error,
    reload,
    // Resumos
    summary,
    resumoDestinos,
    resumoPorMetodo,
    // Filtros
    getAccountsByType,
    getContasByDestino,
    // CRUD contas
    createAccount,
    updateAccount,
    deleteAccount,
    // CRUD comissões
    createCommission,
    updateCommission,
    deleteCommission,
    // Fluxo de caixa
    calculateCashFlow,
    getCashFlow,
    // Utilitários
    exportAccountsToCSV,
    formatCurrency,
    formatDate,
    METODOS_PAGAMENTO,
  };
}
