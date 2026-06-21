// storage para Faturamento (lotes e faturas de convênios)
//
// Arquitetura: cache em memória (Map) que espelha o Supabase.
// Leituras (getLotes/getFaturas/etc) são síncronas, lendo do cache.
// Escritas atualizam o cache imediatamente (UI responde na hora) e
// disparam a gravação no Supabase em segundo plano.
//
// IMPORTANTE: chame `initBillingStorage()` uma vez (ex: no useEffect da
// página de Faturamento) antes de depender dos dados — ele popula o cache
// a partir do banco. Sem isso, getLotes()/getFaturas() retornam vazio.

import { supabase } from "@/lib/supabase";
import type { LoteFaturamento, FaturaConvenio, ItemFaturamento, CreateLoteInput, CreateFaturaInput } from './billing-types';

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // fallback simples caso crypto.randomUUID não esteja disponível
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Cache ──────────────────────────────────────────────────────────────────
const lotesCache = new Map<string, LoteFaturamento>();
const faturasCache = new Map<string, FaturaConvenio>();
let lotesCarregados = false;
let faturasCarregadas = false;

function sortByCreatedAtDesc<T extends { createdAt: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

// ─── Mapeamento Lote ────────────────────────────────────────────────────────
function mapLoteFromDb(row: any): LoteFaturamento {
  return {
    id: row.id,
    convenioId: row.convenio_id,
    convenioName: row.convenio_name,
    ansCode: row.ans_code ?? undefined,
    competencia: row.competencia,
    numero: row.numero,
    status: row.status,
    totalValue: Number(row.total_value ?? 0),
    itemCount: row.item_count ?? 0,
    createdAt: row.created_at,
    fechadoAt: row.fechado_at ?? undefined,
    enviadoAt: row.enviado_at ?? undefined,
    pagoAt: row.pago_at ?? undefined,
    valorPago: row.valor_pago != null ? Number(row.valor_pago) : undefined,
    valorGlosado: row.valor_glosado != null ? Number(row.valor_glosado) : undefined,
    observacoes: row.observacoes ?? undefined,
    items: row.items ?? [],
  };
}

function mapLoteToDb(l: LoteFaturamento) {
  return {
    id: l.id,
    convenio_id: l.convenioId,
    convenio_name: l.convenioName,
    ans_code: l.ansCode ?? null,
    competencia: l.competencia,
    numero: l.numero,
    status: l.status,
    total_value: l.totalValue,
    item_count: l.itemCount,
    fechado_at: l.fechadoAt ?? null,
    enviado_at: l.enviadoAt ?? null,
    pago_at: l.pagoAt ?? null,
    valor_pago: l.valorPago ?? null,
    valor_glosado: l.valorGlosado ?? null,
    observacoes: l.observacoes ?? null,
    items: l.items ?? [],
    created_at: l.createdAt,
  };
}

// ─── Mapeamento Fatura ────────────────────────────────────────────────────────
function mapFaturaFromDb(row: any): FaturaConvenio {
  return {
    id: row.id,
    convenioId: row.convenio_id,
    convenioName: row.convenio_name,
    ansCode: row.ans_code ?? undefined,
    competencia: row.competencia,
    numero: row.numero,
    loteIds: row.lote_ids ?? [],
    status: row.status,
    totalValue: Number(row.total_value ?? 0),
    valorPago: row.valor_pago != null ? Number(row.valor_pago) : undefined,
    valorGlosado: row.valor_glosado != null ? Number(row.valor_glosado) : undefined,
    dataEnvio: row.data_envio ?? undefined,
    dataPagamento: row.data_pagamento ?? undefined,
    dataVencimento: row.data_vencimento ?? undefined,
    protocolo: row.protocolo ?? undefined,
    observacoes: row.observacoes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFaturaToDb(f: FaturaConvenio) {
  return {
    id: f.id,
    convenio_id: f.convenioId,
    convenio_name: f.convenioName,
    ans_code: f.ansCode ?? null,
    competencia: f.competencia,
    numero: f.numero,
    lote_ids: f.loteIds ?? [],
    status: f.status,
    total_value: f.totalValue,
    valor_pago: f.valorPago ?? null,
    valor_glosado: f.valorGlosado ?? null,
    data_envio: f.dataEnvio ?? null,
    data_pagamento: f.dataPagamento ?? null,
    data_vencimento: f.dataVencimento ?? null,
    protocolo: f.protocolo ?? null,
    observacoes: f.observacoes ?? null,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  };
}

// ─── Inicialização (popula o cache a partir do Supabase) ────────────────────
export async function initBillingStorage(): Promise<void> {
  const [lotesRes, faturasRes] = await Promise.all([
    supabase.from("lotes_faturamento").select("*"),
    supabase.from("faturas_convenio").select("*"),
  ]);

  if (lotesRes.error) {
    console.error("Erro ao carregar lotes de faturamento:", lotesRes.error);
  } else {
    lotesCache.clear();
    (lotesRes.data || []).forEach((row) => lotesCache.set(row.id, mapLoteFromDb(row)));
    lotesCarregados = true;
  }

  if (faturasRes.error) {
    console.error("Erro ao carregar faturas de convênio:", faturasRes.error);
  } else {
    faturasCache.clear();
    (faturasRes.data || []).forEach((row) => faturasCache.set(row.id, mapFaturaFromDb(row)));
    faturasCarregadas = true;
  }
}

export function billingStorageEstaCarregado(): boolean {
  return lotesCarregados && faturasCarregadas;
}

export const billingStorage = {
  // ── Lotes ────────────────────────────────────────────────────────────────────
  getLotes(): LoteFaturamento[] {
    return sortByCreatedAtDesc(Array.from(lotesCache.values()));
  },

  getLote(id: string): LoteFaturamento | undefined {
    return lotesCache.get(id);
  },

  createLote(input: CreateLoteInput): LoteFaturamento {
    const now = new Date();
    const year = now.getFullYear();
    const id = uuid();

    const items: ItemFaturamento[] = (input.items ?? []).map((i) => ({
      ...i,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId: id,
    }));
    const totalValue = items.reduce((s, i) => s + i.totalValue, 0);

    // numeração sequencial baseada no que já está em cache (aproximada — ok p/ uso da clínica)
    const doAno = this.getLotes().filter((l) => l.numero.startsWith(`${year}/`)).length;
    const numero = `${year}/${String(doAno + 1).padStart(3, "0")}`;

    const lote: LoteFaturamento = {
      id,
      convenioId: input.convenioId,
      convenioName: input.convenioName,
      ansCode: input.ansCode,
      competencia: input.competencia,
      numero,
      status: "aberto",
      totalValue,
      itemCount: items.length,
      createdAt: now.toISOString(),
      fechadoAt: input.fechadoAt,
      enviadoAt: input.enviadoAt,
      pagoAt: input.pagoAt,
      valorPago: input.valorPago,
      valorGlosado: input.valorGlosado,
      observacoes: input.observacoes,
      items,
    };

    lotesCache.set(id, lote);

    supabase.from("lotes_faturamento").insert(mapLoteToDb(lote)).then(({ error }) => {
      if (error) console.error("Erro ao gravar lote no Supabase:", error);
    });

    return lote;
  },

  updateLote(id: string, patch: Partial<LoteFaturamento>): LoteFaturamento {
    const atual = lotesCache.get(id);
    if (!atual) throw new Error("Lote não encontrado");
    const updated: LoteFaturamento = { ...atual, ...patch };
    if (patch.items) {
      updated.totalValue = patch.items.reduce((s, i) => s + i.totalValue, 0);
      updated.itemCount = patch.items.length;
    }
    lotesCache.set(id, updated);

    supabase.from("lotes_faturamento").update(mapLoteToDb(updated)).eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao atualizar lote no Supabase:", error);
    });

    return updated;
  },

  addItemToLote(loteId: string, item: Omit<ItemFaturamento, "id" | "loteId">): LoteFaturamento {
    const lote = this.getLote(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    const newItem: ItemFaturamento = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId,
    };
    return this.updateLote(loteId, { items: [...lote.items, newItem] });
  },

  removeItemFromLote(loteId: string, itemId: string): LoteFaturamento {
    const lote = this.getLote(loteId);
    if (!lote) throw new Error("Lote não encontrado");
    return this.updateLote(loteId, { items: lote.items.filter((i) => i.id !== itemId) });
  },

  deleteLote(id: string): void {
    lotesCache.delete(id);
    supabase.from("lotes_faturamento").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao excluir lote no Supabase:", error);
    });
  },

  // ── Faturas ────────────────────────────────────────────────────────────────
  getFaturas(): FaturaConvenio[] {
    return sortByCreatedAtDesc(Array.from(faturasCache.values()));
  },

  createFatura(input: CreateFaturaInput): FaturaConvenio {
    const now = new Date();
    const year = now.getFullYear();
    const id = uuid();
    const lotes = this.getLotes().filter((l) => input.loteIds.includes(l.id));
    const totalValue = lotes.reduce((s, l) => s + l.totalValue, 0);

    const doAno = this.getFaturas().filter((f) => f.numero.startsWith(`FAT-${year}-`)).length;
    const numero = `FAT-${year}-${String(doAno + 1).padStart(3, "0")}`;

    const fatura: FaturaConvenio = {
      ...input,
      id,
      numero,
      totalValue,
      status: input.status ?? "pendente",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    faturasCache.set(id, fatura);
    supabase.from("faturas_convenio").insert(mapFaturaToDb(fatura)).then(({ error }) => {
      if (error) console.error("Erro ao gravar fatura no Supabase:", error);
    });

    return fatura;
  },

  updateFatura(id: string, patch: Partial<FaturaConvenio>): FaturaConvenio {
    const atual = faturasCache.get(id);
    if (!atual) throw new Error("Fatura não encontrada");
    const updated: FaturaConvenio = { ...atual, ...patch, updatedAt: new Date().toISOString() };
    faturasCache.set(id, updated);

    supabase.from("faturas_convenio").update(mapFaturaToDb(updated)).eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao atualizar fatura no Supabase:", error);
    });

    return updated;
  },

  deleteFatura(id: string): void {
    faturasCache.delete(id);
    supabase.from("faturas_convenio").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao excluir fatura no Supabase:", error);
    });
  },
};

// ======================================================
// ITENS DE FATURAMENTO
// ======================================================

export interface BillingItem {
  id: string;
  appointmentId?: string;
  convenioId: string;
  convenioNome: string;
  paciente: string;
  profissional: string;
  procedimento: string;
  valor: number;
  status: 'pendente' | 'loteado' | 'faturado';
  data: string;
}

const billingItemsCache = new Map<string, BillingItem>();
let billingItemsCarregados = false;

function mapBillingItemFromDb(row: any): BillingItem {
  return {
    id: row.id,
    appointmentId: row.appointment_id ?? undefined,
    convenioId: row.convenio_id,
    convenioNome: row.convenio_nome,
    paciente: row.paciente,
    profissional: row.profissional,
    procedimento: row.procedimento,
    valor: Number(row.valor ?? 0),
    status: row.status,
    data: row.data,
  };
}

function mapBillingItemToDb(i: BillingItem) {
  return {
    id: i.id,
    appointment_id: i.appointmentId ?? null,
    convenio_id: i.convenioId,
    convenio_nome: i.convenioNome,
    paciente: i.paciente,
    profissional: i.profissional,
    procedimento: i.procedimento,
    valor: i.valor,
    status: i.status,
    data: i.data,
  };
}

export async function initBillingItemsStorage(): Promise<void> {
  const { data, error } = await supabase.from("billing_items").select("*");
  if (error) {
    console.error("Erro ao carregar itens de faturamento:", error);
    return;
  }
  billingItemsCache.clear();
  (data || []).forEach((row) => billingItemsCache.set(row.id, mapBillingItemFromDb(row)));
  billingItemsCarregados = true;
}

export const billingItemsStorage = {
  getAll(): BillingItem[] {
    return Array.from(billingItemsCache.values());
  },

  add(item: BillingItem): BillingItem {
    const id = item.id || uuid();
    const saved = { ...item, id };
    billingItemsCache.set(id, saved);
    supabase.from("billing_items").insert(mapBillingItemToDb(saved)).then(({ error }) => {
      if (error) console.error("Erro ao gravar item de faturamento no Supabase:", error);
    });
    return saved;
  },

  update(id: string, patch: Partial<BillingItem>): void {
    const atual = billingItemsCache.get(id);
    if (!atual) return;
    const updated = { ...atual, ...patch };
    billingItemsCache.set(id, updated);
    supabase.from("billing_items").update(mapBillingItemToDb(updated)).eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao atualizar item de faturamento no Supabase:", error);
    });
  },

  remove(id: string): void {
    billingItemsCache.delete(id);
    supabase.from("billing_items").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Erro ao excluir item de faturamento no Supabase:", error);
    });
  },
};
