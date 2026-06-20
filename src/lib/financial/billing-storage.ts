// storage para Faturamento (lotes e faturas de convênios) — agora no Supabase

import { supabase } from "@/lib/supabase";
import type { LoteFaturamento, FaturaConvenio, ItemFaturamento, CreateLoteInput, CreateFaturaInput } from './billing-types';

// ─── Sequenciais ──────────────────────────────────────────────────────────────
// Conta quantos lotes/faturas já existem no ano para gerar o próximo número.
async function nextLoteSeq(year: number): Promise<string> {
  const { count } = await supabase
    .from("lotes_faturamento")
    .select("id", { count: "exact", head: true })
    .like("numero", `${year}/%`);
  const n = (count ?? 0) + 1;
  return `${year}/${String(n).padStart(3, '0')}`;
}

async function nextFaturaSeq(year: number): Promise<string> {
  const { count } = await supabase
    .from("faturas_convenio")
    .select("id", { count: "exact", head: true })
    .like("numero", `FAT-${year}-%`);
  const n = (count ?? 0) + 1;
  return `FAT-${year}-${String(n).padStart(3, '0')}`;
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

function mapLoteToDb(l: Partial<LoteFaturamento>) {
  return {
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

function mapFaturaToDb(f: Partial<FaturaConvenio>) {
  return {
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
  };
}

export const billingStorage = {
  // ── Lotes ────────────────────────────────────────────────────────────────────
  async getLotes(): Promise<LoteFaturamento[]> {
    const { data, error } = await supabase
      .from("lotes_faturamento")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("Erro ao buscar lotes:", error); return []; }
    return (data || []).map(mapLoteFromDb);
  },

  async getLote(id: string): Promise<LoteFaturamento | undefined> {
    const { data, error } = await supabase
      .from("lotes_faturamento")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return undefined;
    return mapLoteFromDb(data);
  },

  async createLote(input: CreateLoteInput): Promise<LoteFaturamento> {
    const now = new Date();
    const year = now.getFullYear();
    const rawItems = input.items ?? [];

    const items: ItemFaturamento[] = rawItems.map(i => ({
      ...i,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId: '', // preenchido após o insert, quando soubermos o id real
    }));
    const totalValue = items.reduce((s, i) => s + i.totalValue, 0);
    const numero = await nextLoteSeq(year);

    const { data, error } = await supabase
      .from("lotes_faturamento")
      .insert(mapLoteToDb({
        convenioId: input.convenioId,
        convenioName: input.convenioName,
        ansCode: input.ansCode,
        competencia: input.competencia,
        numero,
        status: 'aberto',
        totalValue,
        itemCount: items.length,
        fechadoAt: input.fechadoAt,
        enviadoAt: input.enviadoAt,
        pagoAt: input.pagoAt,
        valorPago: input.valorPago,
        valorGlosado: input.valorGlosado,
        observacoes: input.observacoes,
        items,
      }))
      .select()
      .single();

    if (error) { console.error("Erro ao criar lote:", error); throw error; }

    // agora que temos o id real do lote, corrige loteId nos items
    const finalItems = items.map(i => ({ ...i, loteId: data.id }));
    const { data: updated, error: updError } = await supabase
      .from("lotes_faturamento")
      .update({ items: finalItems })
      .eq("id", data.id)
      .select()
      .single();
    if (updError) { console.error("Erro ao ajustar itens do lote:", updError); throw updError; }

    return mapLoteFromDb(updated);
  },

  async updateLote(id: string, patch: Partial<LoteFaturamento>): Promise<LoteFaturamento> {
    const updatePayload: any = mapLoteToDb(patch);
    if (patch.items) {
      updatePayload.total_value = patch.items.reduce((s, i) => s + i.totalValue, 0);
      updatePayload.item_count = patch.items.length;
    }
    // remove chaves undefined para não sobrescrever campos não enviados
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });

    const { data, error } = await supabase
      .from("lotes_faturamento")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();
    if (error) { console.error("Erro ao atualizar lote:", error); throw error; }
    return mapLoteFromDb(data);
  },

  async addItemToLote(loteId: string, item: Omit<ItemFaturamento, 'id' | 'loteId'>): Promise<LoteFaturamento> {
    const lote = await this.getLote(loteId);
    if (!lote) throw new Error('Lote não encontrado');
    const newItem: ItemFaturamento = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      loteId,
    };
    const items = [...lote.items, newItem];
    return this.updateLote(loteId, { items });
  },

  async removeItemFromLote(loteId: string, itemId: string): Promise<LoteFaturamento> {
    const lote = await this.getLote(loteId);
    if (!lote) throw new Error('Lote não encontrado');
    const items = lote.items.filter(i => i.id !== itemId);
    return this.updateLote(loteId, { items });
  },

  async deleteLote(id: string): Promise<void> {
    const { error } = await supabase.from("lotes_faturamento").delete().eq("id", id);
    if (error) { console.error("Erro ao excluir lote:", error); throw error; }
  },

  // ── Faturas ────────────────────────────────────────────────────────────────
  async getFaturas(): Promise<FaturaConvenio[]> {
    const { data, error } = await supabase
      .from("faturas_convenio")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { console.error("Erro ao buscar faturas:", error); return []; }
    return (data || []).map(mapFaturaFromDb);
  },

  async createFatura(input: CreateFaturaInput): Promise<FaturaConvenio> {
    const now = new Date();
    const lotes = (await this.getLotes()).filter(l => input.loteIds.includes(l.id));
    const totalValue = lotes.reduce((s, l) => s + l.totalValue, 0);
    const numero = await nextFaturaSeq(now.getFullYear());

    const { data, error } = await supabase
      .from("faturas_convenio")
      .insert(mapFaturaToDb({
        ...input,
        numero,
        totalValue,
        status: input.status ?? 'pendente',
      }))
      .select()
      .single();
    if (error) { console.error("Erro ao criar fatura:", error); throw error; }
    return mapFaturaFromDb(data);
  },

  async updateFatura(id: string, patch: Partial<FaturaConvenio>): Promise<FaturaConvenio> {
    const updatePayload: any = mapFaturaToDb(patch);
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });
    const { data, error } = await supabase
      .from("faturas_convenio")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();
    if (error) { console.error("Erro ao atualizar fatura:", error); throw error; }
    return mapFaturaFromDb(data);
  },

  async deleteFatura(id: string): Promise<void> {
    const { error } = await supabase.from("faturas_convenio").delete().eq("id", id);
    if (error) { console.error("Erro ao excluir fatura:", error); throw error; }
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

function mapBillingItemToDb(i: Partial<BillingItem>) {
  return {
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

export const billingItemsStorage = {
  async getAll(): Promise<BillingItem[]> {
    const { data, error } = await supabase
      .from("billing_items")
      .select("*")
      .order("data", { ascending: false });
    if (error) { console.error("Erro ao buscar itens de faturamento:", error); return []; }
    return (data || []).map(mapBillingItemFromDb);
  },

  async add(item: BillingItem): Promise<BillingItem> {
    const { data, error } = await supabase
      .from("billing_items")
      .insert(mapBillingItemToDb(item))
      .select()
      .single();
    if (error) { console.error("Erro ao criar item de faturamento:", error); throw error; }
    return mapBillingItemFromDb(data);
  },

  async update(id: string, patch: Partial<BillingItem>): Promise<void> {
    const updatePayload: any = mapBillingItemToDb(patch);
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });
    const { error } = await supabase.from("billing_items").update(updatePayload).eq("id", id);
    if (error) { console.error("Erro ao atualizar item de faturamento:", error); throw error; }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("billing_items").delete().eq("id", id);
    if (error) { console.error("Erro ao excluir item de faturamento:", error); throw error; }
  },
};
