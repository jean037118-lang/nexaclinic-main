/**
 * storage.ts — NexaClinic Financial Storage
 *
 * Gerencia persistência de contas manuais e comissões no Supabase.
 * Os agendamentos pagos vivem na tabela 'agendamentos'
 * e são lidos via useFinancial (não armazenados aqui).
 */

import { supabase } from "@/lib/supabase";
import type { Account, MedicalCommission } from './types';

function mapAccountFromDb(row: any): Account {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    value: Number(row.value ?? 0),
    dueDate: row.due_date ?? "",
    category: row.category ?? "",
    status: row.status,
    paymentMethod: row.payment_method ?? undefined,
    destino: row.destino ?? undefined,
    origem: row.origem ?? undefined,
    origemId: row.origem_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccountToDb(a: Partial<Account>) {
  return {
    type: a.type,
    description: a.description,
    value: a.value,
    due_date: a.dueDate || null,
    category: a.category,
    status: a.status,
    payment_method: a.paymentMethod ?? null,
    destino: a.destino ?? null,
    origem: a.origem ?? null,
    origem_id: a.origemId ?? null,
    notes: a.notes ?? null,
  };
}

function mapCommissionFromDb(row: any): MedicalCommission {
  return {
    id: row.id,
    doctorName: row.doctor_name,
    doctorId: row.doctor_id ?? undefined,
    value: Number(row.value ?? 0),
    percentage: row.percentage != null ? Number(row.percentage) : undefined,
    month: row.month,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommissionToDb(c: Partial<MedicalCommission>) {
  return {
    doctor_name: c.doctorName,
    doctor_id: c.doctorId ?? null,
    value: c.value,
    percentage: c.percentage ?? null,
    month: c.month,
    status: c.status,
    notes: c.notes ?? null,
  };
}

export const financialStorage = {
  // ── Contas ──────────────────────────────────────────────────────────────────
  async getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("due_date", { ascending: true });
    if (error) {
      console.error("Erro ao buscar contas:", error);
      return [];
    }
    return (data || []).map(mapAccountFromDb);
  },

  async saveAccount(account: Account): Promise<Account> {
    if (account.id) {
      const { data, error } = await supabase
        .from("accounts")
        .update(mapAccountToDb(account))
        .eq("id", account.id)
        .select()
        .single();
      if (error) { console.error("Erro ao atualizar conta:", error); throw error; }
      return mapAccountFromDb(data);
    }
    const { data, error } = await supabase
      .from("accounts")
      .insert(mapAccountToDb(account))
      .select()
      .single();
    if (error) { console.error("Erro ao criar conta:", error); throw error; }
    return mapAccountFromDb(data);
  },

  async deleteAccount(accountId: string): Promise<void> {
    const { error } = await supabase.from("accounts").delete().eq("id", accountId);
    if (error) { console.error("Erro ao excluir conta:", error); throw error; }
  },

  // ── Comissões ────────────────────────────────────────────────────────────────
  async getCommissions(): Promise<MedicalCommission[]> {
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .order("month", { ascending: false });
    if (error) {
      console.error("Erro ao buscar comissões:", error);
      return [];
    }
    return (data || []).map(mapCommissionFromDb);
  },

  async saveCommission(commission: MedicalCommission): Promise<MedicalCommission> {
    if (commission.id) {
      const { data, error } = await supabase
        .from("commissions")
        .update(mapCommissionToDb(commission))
        .eq("id", commission.id)
        .select()
        .single();
      if (error) { console.error("Erro ao atualizar comissão:", error); throw error; }
      return mapCommissionFromDb(data);
    }
    const { data, error } = await supabase
      .from("commissions")
      .insert(mapCommissionToDb(commission))
      .select()
      .single();
    if (error) { console.error("Erro ao criar comissão:", error); throw error; }
    return mapCommissionFromDb(data);
  },

  async deleteCommission(id: string): Promise<void> {
    const { error } = await supabase.from("commissions").delete().eq("id", id);
    if (error) { console.error("Erro ao excluir comissão:", error); throw error; }
  },

  // ── Export (mantido por compatibilidade, agora assíncrono) ───────────────────
  async exportData() {
    return {
      accounts: await this.getAccounts(),
      commissions: await this.getCommissions(),
      exportedAt: new Date().toISOString(),
    };
  },
};
