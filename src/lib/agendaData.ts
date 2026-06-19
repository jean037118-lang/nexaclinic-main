import { supabase } from "./supabase";

/* =========================================
   PROFISSIONAIS
========================================= */

function mapProfFromDb(row: any) {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty ?? "",
    crm: row.crm ?? "",
    color: row.color ?? "#888888",
    active: row.active ?? true,
    appointmentDuration: row.appointment_duration ?? 30,
    workDays: row.work_days ?? "",
    repasseType: row.repasse_type ?? "",
    repasseValue: row.repasse_value ?? 0,
    // Campos abaixo não existem na tabela ainda — mantidos por compatibilidade
    // com telas que esperam horário de atendimento. Ajuste se/quando forem
    // adicionados como colunas no Supabase.
    scheduleStart: row.schedule_start ?? "08:00",
    scheduleEnd: row.schedule_end ?? "18:00",
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
