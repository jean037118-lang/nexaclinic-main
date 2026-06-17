
export type LoteStatus = 'aberto' | 'fechado' | 'enviado' | 'pago' | 'glosado';
export type FaturaStatus = 'pendente' | 'enviada' | 'paga' | 'glosada' | 'recurso';

export interface ItemFaturamento {
  id: string;
  loteId: string;
  appointmentId?: string;
  patientName: string;
  patientCpf?: string;
  carteirinha?: string;
  procedure: string;
  procedureCode?: string; // código TUSS
  date: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  professionalName?: string;
  professionalCrm?: string;
  authorizationCode?: string;
  status: 'incluido' | 'glosado' | 'aprovado';
  glosaReason?: string;
}

export interface LoteFaturamento {
  id: string;
  convenioId: string;
  convenioName: string;
  ansCode?: string;
  competencia: string; // "YYYY-MM" — mês de referência
  numero: string;      // número sequencial do lote, ex: "2025/001"
  status: LoteStatus;
  totalValue: number;
  itemCount: number;
  createdAt: string;
  fechadoAt?: string;
  enviadoAt?: string;
  pagoAt?: string;
  valorPago?: number;
  valorGlosado?: number;
  observacoes?: string;
  items: ItemFaturamento[];
}

export interface FaturaConvenio {
  id: string;
  convenioId: string;
  convenioName: string;
  ansCode?: string;
  competencia: string;
  numero: string;       // ex: "FAT-2025-001"
  loteIds: string[];    // lotes incluídos na fatura
  status: FaturaStatus;
  totalValue: number;
  valorPago?: number;
  valorGlosado?: number;
  dataEnvio?: string;
  dataPagamento?: string;
  dataVencimento?: string;
  protocolo?: string;   // protocolo de envio ao convênio
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateLoteInput = Omit<LoteFaturamento, 'id' | 'createdAt' | 'totalValue' | 'itemCount' | 'items'> & {
  items?: Omit<ItemFaturamento, 'id' | 'loteId'>[];
};

export type CreateFaturaInput = Omit<FaturaConvenio, 'id' | 'createdAt' | 'updatedAt' | 'totalValue'>;