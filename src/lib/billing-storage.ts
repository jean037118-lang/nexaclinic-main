// storage para Faturamento (lotes e faturas de convênios)

import type { LoteFaturamento, FaturaConvenio, ItemFaturamento, CreateLoteInput, CreateFaturaInput } from './billing-types';

const KEYS = {
  LOTES: 'nexaclinic_lotes_faturamento',
  FATURAS: 'nexaclinic_faturas_convenio',
  SEQ_LOTE: 'nexaclinic_seq_lote',
  SEQ_FATURA: 'nexaclinic_seq_fatura',
};

// ─── Sequenciais ──────────────────────────────────────────────────────────────
function nextLoteSeq(year: number): string {
  const key = `${KEYS.SEQ_LOTE}_${year}`;
  const n = parseInt(localStorage.getItem(key) ?? '0') + 1;
  localStorage.setItem(key, String(n));
  return `${year}/${String(n).padStart(3, '0')}`;
}

function nextFaturaSeq(year: number): string {
  const key = `${KEYS.SEQ_FATURA}_${year}`;
  const n = parseInt(localStorage.getItem(key) ?? '0') + 1;
  localStorage.setItem(key, String(n));
  return `FAT-${year}-${String(n).padStart(3, '0')}`;
}

// ─── Lotes ────────────────────────────────────────────────────────────────────
export const billingStorage = {
  getLotes(): LoteFaturamento[] {
    try {
      const data = localStorage.getItem(KEYS.LOTES);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  saveLotes(lotes: LoteFaturamento[]): void {
    localStorage.setItem(KEYS.LOTES, JSON.stringify(lotes));
  },

  getLote(id: string): LoteFaturamento | undefined {
    return this.getLotes().find(l => l.id === id);
  },

  createLote(input: CreateLoteInput): LoteFaturamento {
    const now = new Date();
    const year = now.getFullYear();
    const rawItems = input.items ?? [];

    const items: ItemFaturamento[] = rawItems.map(i => ({
      ...i,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId: '', // preenchido abaixo
    }));

    const totalValue = items.reduce((s, i) => s + i.totalValue, 0);

    const lote: LoteFaturamento = {
      id: `lote_${Date.now()}`,
      convenioId: input.convenioId,
      convenioName: input.convenioName,
      ansCode: input.ansCode,
      competencia: input.competencia,
      numero: nextLoteSeq(year),
      status: 'aberto',
      totalValue,
      itemCount: items.length,
      createdAt: now.toISOString(),
      fechadoAt: input.fechadoAt,
      enviadoAt: input.enviadoAt,
      pagoAt: input.pagoAt,
      valorPago: input.valorPago,
      valorGlosado: input.valorGlosado,
      observacoes: input.observacoes,
      items: items.map(i => ({ ...i, loteId: '' })), // será corrigido
    };

    // corrige loteId nos items
    lote.items = items.map(i => ({ ...i, loteId: lote.id }));

    const lotes = this.getLotes();
    lotes.unshift(lote);
    this.saveLotes(lotes);
    return lote;
  },

  updateLote(id: string, patch: Partial<LoteFaturamento>): LoteFaturamento {
    const lotes = this.getLotes();
    const idx = lotes.findIndex(l => l.id === id);
    if (idx === -1) throw new Error('Lote não encontrado');
    const updated = { ...lotes[idx], ...patch };
    // recalcula totais se items mudaram
    if (patch.items) {
      updated.totalValue = patch.items.reduce((s, i) => s + i.totalValue, 0);
      updated.itemCount = patch.items.length;
    }
    lotes[idx] = updated;
    this.saveLotes(lotes);
    return updated;
  },

  addItemToLote(loteId: string, item: Omit<ItemFaturamento, 'id' | 'loteId'>): LoteFaturamento {
    const lote = this.getLote(loteId);
    if (!lote) throw new Error('Lote não encontrado');
    const newItem: ItemFaturamento = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId,
    };
    const items = [...lote.items, newItem];
    return this.updateLote(loteId, { items });
  },

  removeItemFromLote(loteId: string, itemId: string): LoteFaturamento {
    const lote = this.getLote(loteId);
    if (!lote) throw new Error('Lote não encontrado');
    const items = lote.items.filter(i => i.id !== itemId);
    return this.updateLote(loteId, { items });
  },

  deleteLote(id: string): void {
    const lotes = this.getLotes().filter(l => l.id !== id);
    this.saveLotes(lotes);
  },

  // ─── Faturas ────────────────────────────────────────────────────────────────
  getFaturas(): FaturaConvenio[] {
    try {
      const data = localStorage.getItem(KEYS.FATURAS);
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  },

  saveFaturas(faturas: FaturaConvenio[]): void {
    localStorage.setItem(KEYS.FATURAS, JSON.stringify(faturas));
  },

  createFatura(input: CreateFaturaInput): FaturaConvenio {
    const now = new Date();
    // totalValue soma dos lotes
    const lotes = this.getLotes().filter(l => input.loteIds.includes(l.id));
    const totalValue = lotes.reduce((s, l) => s + l.totalValue, 0);

    const fatura: FaturaConvenio = {
      ...input,
      id: `fat_${Date.now()}`,
      numero: nextFaturaSeq(now.getFullYear()),
      totalValue,
      status: input.status ?? 'pendente',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const faturas = this.getFaturas();
    faturas.unshift(fatura);
    this.saveFaturas(faturas);
    return fatura;
  },

  updateFatura(id: string, patch: Partial<FaturaConvenio>): FaturaConvenio {
    const faturas = this.getFaturas();
    const idx = faturas.findIndex(f => f.id === id);
    if (idx === -1) throw new Error('Fatura não encontrada');
    faturas[idx] = { ...faturas[idx], ...patch, updatedAt: new Date().toISOString() };
    this.saveFaturas(faturas);
    return faturas[idx];
  },

  deleteFatura(id: string): void {
    const faturas = this.getFaturas().filter(f => f.id !== id);
    this.saveFaturas(faturas);
  },
};