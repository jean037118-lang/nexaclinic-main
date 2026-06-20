import { supabase } from "./supabase";

/* =========================================
   PROFISSIONAIS
========================================= */

function mapProfFromDb(row: any) {
  // Campos extras salvos como JSON em metadata (coluna jsonb no Supabase)
  // ou individualmente se já existirem como colunas.
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty ?? "",
    crm: row.crm ?? "",
    color: row.color ?? "#888888",
    active: row.active ?? true,
    appointmentDuration: row.appointment_duration ?? 30,
    workDays: row.work_days ?? "",
    repasseType: row.repasse_type ?? "percentual",
    repasseValue: row.repasse_value ?? 50,
    scheduleStart: row.schedule_start ?? meta.scheduleStart ?? "08:00",
    scheduleEnd: row.schedule_end ?? meta.scheduleEnd ?? "18:00",
    // Campos extras — lidos de colunas dedicadas (se existirem) ou do metadata
    tipo: row.tipo ?? meta.tipo ?? "profissional",
    agendaTipo: row.agenda_tipo ?? meta.agendaTipo ?? "permanente",
    diasSemana: row.dias_semana ?? meta.diasSemana ?? [1, 2, 3, 4, 5],
    datasEspecificas: row.datas_especificas ?? meta.datasEspecificas ?? [],
    repasseRegras: row.repasse_regras ?? meta.repasseRegras ?? [],
    repasseSomenteComPagamento:
      row.repasse_somente_com_pagamento ??
      meta.repasseSomenteComPagamento ??
      true,
    avatar: row.avatar ?? meta.avatar ?? "",
    prazoRetornoDias: row.prazo_retorno_dias ?? meta.prazoRetornoDias ?? 30,
    observacao: row.observacao ?? meta.observacao ?? "",
  };
}

function mapProfToDb(p: any) {
  return {
    name: p.name,
    specialty: p.specialty,
    crm: p.crm,
    color: p.color,
    active: p.active,
    appointment_duration: p.appointmentDuration,
    work_days: p.workDays,
    repasse_type: p.repasseType,
    repasse_value: p.repasseValue,
    schedule_start: p.scheduleStart,
    schedule_end: p.scheduleEnd,
    // Campos extras — salvos em colunas dedicadas quando existirem no Supabase,
    // e também em metadata como fallback para colunas ainda não criadas.
    tipo: p.tipo ?? "profissional",
    agenda_tipo: p.agendaTipo ?? "permanente",
    dias_semana: p.diasSemana ?? [1, 2, 3, 4, 5],
    datas_especificas: p.datasEspecificas ?? [],
    repasse_regras: p.repasseRegras ?? [],
    repasse_somente_com_pagamento: p.repasseSomenteComPagamento ?? true,
    avatar: p.avatar ?? "",
    prazo_retorno_dias: p.prazoRetornoDias ?? 30,
    observacao: p.observacao ?? "",
    // metadata como coluna jsonb de fallback (não falha se coluna não existir)
    metadata: {
      scheduleStart: p.scheduleStart,
      scheduleEnd: p.scheduleEnd,
      tipo: p.tipo,
      agendaTipo: p.agendaTipo,
      diasSemana: p.diasSemana,
      datasEspecificas: p.datasEspecificas,
      repasseRegras: p.repasseRegras,
      repasseSomenteComPagamento: p.repasseSomenteComPagamento,
      avatar: p.avatar,
      prazoRetornoDias: p.prazoRetornoDias,
      observacao: p.observacao,
    },
  };
}

export async function listarProfissionais() {
  const { data, error } = await supabase
    .from("profissionais")
    .select("*")
    .order("name");

  if (error) {
    console.error("Erro ao listar profissionais:", error);
    return [];
  }
  return (data || []).map(mapProfFromDb);
}

export async function criarProfissional(prof: any) {
  const { data, error } = await supabase
    .from("profissionais")
    .insert(mapProfToDb(prof))
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar profissional:", error);
    throw error;
  }
  return mapProfFromDb(data);
}

export async function atualizarProfissional(id: string, prof: any) {
  const { error } = await supabase
    .from("profissionais")
    .update(mapProfToDb(prof))
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar profissional:", error);
    throw error;
  }
}

export async function excluirProfissional(id: string) {
  const { error } = await supabase.from("profissionais").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir profissional:", error);
    throw error;
  }
}

/* =========================================
   AGENDAMENTOS
========================================= */

function timeToHHMM(t?: string | null): string {
  if (!t) return "";
  return t.slice(0, 5); // "09:00:00" -> "09:00"
}

function mapAptFromDb(row: any) {
  return {
    id: row.id,
    patientName: row.patient_name,
    patientId: row.patient_id ?? undefined,
    professionalId: row.professional_id,
    date: row.date,
    start: timeToHHMM(row.start_time),
    durationMin: row.duration_min ?? 30,
    status: row.status,
    procedure: row.procedure_name ?? "",
    insurance: row.insurance ?? "Particular",
    phone: row.phone ?? "",
    procedureValue: row.procedure_value ?? undefined,
    amount: row.amount ?? undefined,
    paymentMethod: row.payment_method ?? undefined,
    paid: row.paid ?? false,
    cancelReason: row.cancel_reason ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function mapAptToDb(a: any) {
  return {
    id: a.id,
    patient_name: a.patientName,
    patient_id: a.patientId ?? null,
    professional_id: a.professionalId,
    date: a.date,
    start_time: a.start,
    duration_min: a.durationMin,
    status: a.status,
    procedure_name: a.procedure ?? null,
    insurance: a.insurance ?? null,
    phone: a.phone ?? null,
    procedure_value: a.procedureValue ?? null,
    amount: a.amount ?? null,
    payment_method: a.paymentMethod ?? null,
    paid: a.paid ?? false,
    cancel_reason: a.cancelReason ?? null,
    cancelled_at: a.cancelledAt ?? null,
  };
}

export async function listarAgendamentos() {
  const { data, error } = await supabase
    .from("agendamentos")
    .select("*")
    .order("date")
    .order("start_time");

  if (error) {
    console.error("Erro ao listar agendamentos:", error);
    return [];
  }
  return (data || []).map(mapAptFromDb);
}

export async function criarAgendamento(apt: any) {
  const { data, error } = await supabase
    .from("agendamentos")
    .insert(mapAptToDb(apt))
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar agendamento:", error);
    throw error;
  }
  return mapAptFromDb(data);
}

export async function atualizarAgendamento(id: string, apt: any) {
  const { error } = await supabase
    .from("agendamentos")
    .update(mapAptToDb(apt))
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar agendamento:", error);
    throw error;
  }
}

export async function excluirAgendamento(id: string) {
  const { error } = await supabase.from("agendamentos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir agendamento:", error);
    throw error;
  }
}

/* =========================================
   CONTAS FINANCEIRAS (accounts)
========================================= */

function mapAccountFromDb(row: any) {
  return {
    id: row.id,
    type: row.type,                          // 'pagar' | 'receber'
    description: row.description,
    value: row.value ?? 0,
    dueDate: row.due_date,
    category: row.category ?? "",
    status: row.status ?? "pendente",
    paymentMethod: row.payment_method ?? undefined,
    destino: row.destino ?? undefined,
    origem: row.origem ?? undefined,
    origemId: row.origem_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAccountToDb(a: any) {
  return {
    type: a.type,
    description: a.description,
    value: a.value,
    due_date: a.dueDate,
    category: a.category ?? null,
    status: a.status ?? "pendente",
    payment_method: a.paymentMethod ?? null,
    destino: a.destino ?? null,
    origem: a.origem ?? null,
    origem_id: a.origemId ?? null,
    notes: a.notes ?? null,
  };
}

export async function listarContas() {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("due_date", { ascending: false });

  if (error) {
    console.error("Erro ao listar contas:", error);
    return [];
  }
  return (data || []).map(mapAccountFromDb);
}

export async function criarConta(account: any) {
  const { data, error } = await supabase
    .from("accounts")
    .insert(mapAccountToDb(account))
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar conta:", error);
    throw error;
  }
  return mapAccountFromDb(data);
}

export async function atualizarConta(id: string, account: any) {
  const { error } = await supabase
    .from("accounts")
    .update(mapAccountToDb(account))
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar conta:", error);
    throw error;
  }
}

export async function excluirConta(id: string) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir conta:", error);
    throw error;
  }
}

/* =========================================
   PROCEDIMENTOS
========================================= */

export async function listarProcedimentos() {
  const { data, error } = await supabase
    .from("procedimentos")
    .select("*")
    .order("name");

  if (error) {
    console.error("Erro ao listar procedimentos:", error);
    return [];
  }
  return data || [];
}
