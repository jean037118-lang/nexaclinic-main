/**
 * types.ts — NexaClinic Financial
 *
 * DESTINOS DE PAGAMENTO:
 *  - caixa_central  → Dinheiro
 *  - conta_bancaria → PIX, Transferência
 *  - maquininha     → Cartão de Crédito, Cartão de Débito
 *
 * Cada pagamento da agenda ou lançamento manual
 * é roteado para um destino específico, mantendo
 * rastreabilidade completa de origem → destino.
 */

// ─── Métodos de pagamento ─────────────────────────────────────────────────────
export const METODOS_PAGAMENTO = [
  'Dinheiro',
  'PIX',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Cheque',
  'Transferência',
] as const;

export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];

// ─── Destinos financeiros ─────────────────────────────────────────────────────
export type DestinoFinanceiro = 'caixa_central' | 'conta_bancaria' | 'maquininha';

/** Mapeia automaticamente o método de pagamento para o destino correto */
export function metodoParaDestinoDefault(metodo: string): DestinoFinanceiro {
  // Normaliza para comparação case-insensitive e sem acento
  const m = (metodo ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (m === 'dinheiro' || m === 'cheque')                            return 'caixa_central';
  if (m === 'pix' || m === 'transferencia' || m === 'transferência') return 'conta_bancaria';
  if (m.startsWith('cartao') || m.startsWith('cartão') ||
      m.includes('credito')  || m.includes('crédito') ||
      m.includes('debito')   || m.includes('débito'))               return 'maquininha';

  // Fallback explícito — nunca joga cartão no caixa central
  return 'caixa_central';
}

export const DESTINO_LABELS: Record<DestinoFinanceiro, string> = {
  caixa_central: 'Caixa Central',
  conta_bancaria: 'Conta Bancária',
  maquininha: 'Maquininha (Cartão)',
};

export const DESTINO_METODOS: Record<DestinoFinanceiro, MetodoPagamento[]> = {
  caixa_central:  ['Dinheiro', 'Cheque'],
  conta_bancaria: ['PIX', 'Transferência'],
  maquininha:     ['Cartão de Crédito', 'Cartão de Débito'],
};

// ─── Contas (A Pagar / A Receber) ────────────────────────────────────────────
export type AccountType    = 'pagar' | 'receber';
export type PaymentStatus  = 'pendente' | 'pago' | 'vencido' | 'cancelado';

export interface Account {
  id:          string;
  type:        AccountType;
  description: string;
  value:       number;
  dueDate:     string;      // YYYY-MM-DD
  category:    string;
  status:      PaymentStatus;
  // Rastreabilidade de pagamento
  paymentMethod?: MetodoPagamento | string;
  destino?:       DestinoFinanceiro;
  // Origem: 'manual' | 'agendamento'
  origem?:        'manual' | 'agendamento';
  origemId?:      string;   // ID do agendamento quando origem = 'agendamento'
  notes?:         string;
  createdAt:   string;
  updatedAt:   string;
}

// ─── Resumo de destinos ───────────────────────────────────────────────────────
export interface ResumoDestino {
  destino:  DestinoFinanceiro;
  label:    string;
  total:    number;          // total recebido no período
  entradas: number;          // count de lançamentos
  metodos:  { metodo: string; valor: number }[];
}

// ─── Comissões ────────────────────────────────────────────────────────────────
export interface MedicalCommission {
  id:         string;
  doctorName: string;
  doctorId?:  string;
  value:      number;
  percentage?: number;
  month:      string;
  status:     'pendente' | 'pago';
  notes?:     string;
  createdAt:  string;
  updatedAt:  string;
}

// ─── Resumo financeiro ────────────────────────────────────────────────────────
export interface FinancialSummary {
  totalReceivable:   number;
  totalPayable:      number;
  balance:           number;
  pendingReceivable: number;
  pendingPayable:    number;
  overdueReceivable: number;
  overduePayable:    number;
  totalCommissions:  number;
  accountsCount:     number;
  commissionsCount:  number;
  // Por destino
  caixaCentral:   number;
  contaBancaria:  number;
  maquininha:     number;
}

export interface CashFlowData {
  date:    string;
  entrada: number;
  saida:   number;
  saldo:   number;
}

export type CreateAccountInput = Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: PaymentStatus;
};

export type UpdateAccountInput = Partial<Omit<Account, 'id' | 'createdAt'>>;
