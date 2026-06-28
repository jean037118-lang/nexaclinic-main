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
    scheduleStart: row.schedule_start ?? "08:00",
    scheduleEnd: row.schedule_end ?? "18:00",
    // Campos extras salvos no banco
    repasseRegras: row.repasse_regras ?? [],
    repasseSomenteComPagamento: row.repasse_somente_com_pagamento ?? true,
    avatar: row.avatar ?? "",
    tipo: row.tipo ?? "profissional",
    agendaTipo: row.agenda_tipo ?? "permanente",
    diasSemana: row.dias_semana ?? [1, 2, 3, 4, 5],
    datasEspecificas: row.datas_especificas ?? [],
    prazoRetornoDias: row.prazo_retorno_dias ?? 30,
    observacao: row.observacao ?? "",
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
    // Campos que estavam faltando — agora enviados ao Supabase
    schedule_start: p.scheduleStart ?? "08:00",
    schedule_end: p.scheduleEnd ?? "18:00",
    repasse_regras: p.repasseRegras ?? [],
    repasse_somente_com_pagamento: p.repasseSomenteComPagamento ?? true,
    avatar: p.avatar ?? "",
    tipo: p.tipo ?? "profissional",
    agenda_tipo: p.agendaTipo ?? "permanente",
    dias_semana: p.diasSemana ?? [1, 2, 3, 4, 5],
    datas_especificas: p.datasEspecificas ?? [],
    prazo_retorno_dias: p.prazoRetornoDias ?? 30,
    observacao: p.observacao ?? "",
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
   CONVÊNIOS
========================================= */

function mapConvFromDb(row: any) {
  return {
    id: row.id,
    name: row.name,
    ansCode: row.ans_code ?? "",
    type: row.tipo ?? "Médico",
    repasse: row.repasse ?? "",
    carencia: row.carencia ?? "",
    contact: row.contact ?? "",
    status: row.status ?? "ativo",
    faturar: row.faturar ?? false,
    repasseAoFaturar: row.repasse_ao_faturar ?? false,
    planos: row.planos ?? [],
    tabelas: row.tabelas ?? [],
  };
}

function mapConvToDb(c: any) {
  return {
    name: c.name,
    tipo: c.type,
    ans_code: c.ansCode,
    contact: c.contact,
    status: c.status,
    repasse: c.repasse,
    carencia: c.carencia,
    faturar: c.faturar ?? false,
    repasse_ao_faturar: c.repasseAoFaturar ?? false,
    planos: c.planos ?? [],
    tabelas: c.tabelas ?? [],
  };
}

export async function listarConvenios() {
  const { data, error } = await supabase
    .from("convenios")
    .select("*")
    .order("name");

  if (error) {
    console.error("Erro ao listar convênios:", error);
    return [];
  }
  return (data || []).map(mapConvFromDb);
}

export async function criarConvenio(conv: any) {
  const { data, error } = await supabase
    .from("convenios")
    .insert(mapConvToDb(conv))
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar convênio:", error);
    throw error;
  }
  return mapConvFromDb(data);
}

export async function atualizarConvenio(id: string, conv: any) {
  const { error } = await supabase
    .from("convenios")
    .update(mapConvToDb(conv))
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar convênio:", error);
    throw error;
  }
}

export async function excluirConvenio(id: string) {
  const { error } = await supabase.from("convenios").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir convênio:", error);
    throw error;
  }
}

/* =========================================
   PROCEDIMENTOS
========================================= */

function mapProcFromDb(row: any) {
  return {
    id: row.id,
    name: row.name,
    tussCode: row.tuss_code ?? "",
    category: row.category ?? "",
    durationMin: row.duration_min ?? 30,
    valorParticular: row.valor_particular != null ? String(row.valor_particular) : "",
    convenioValores: row.convenio_valores ?? [],
    valorPorProfissional: row.valor_por_profissional ?? [],
    status: row.status ?? "ativo",
    tipoConsulta: row.tipo_consulta ?? false,
    tipoRetorno: row.tipo_retorno ?? false,
    prazoRetornoDias: row.prazo_retorno_dias ?? 30,
  };
}

function mapProcToDb(p: any) {
  return {
    name: p.name,
    tuss_code: p.tussCode,
    category: p.category,
    duration_min: p.durationMin,
    valor_particular: p.valorParticular === "" ? null : Number(p.valorParticular),
    convenio_valores: p.convenioValores ?? [],
    valor_por_profissional: p.valorPorProfissional ?? [],
    status: p.status,
    tipo_consulta: p.tipoConsulta ?? false,
    tipo_retorno: p.tipoRetorno ?? false,
    prazo_retorno_dias: p.prazoRetornoDias ?? 30,
  };
}

export async function listarProcedimentos() {
  const { data, error } = await supabase
    .from("procedimentos")
    .select("*")
    .order("name");

  if (error) {
    console.error("Erro ao listar procedimentos:", error);
    return [];
  }
  return (data || []).map(mapProcFromDb);
}

export async function criarProcedimento(proc: any) {
  const { data, error } = await supabase
    .from("procedimentos")
    .insert(mapProcToDb(proc))
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar procedimento:", error);
    throw error;
  }
  return mapProcFromDb(data);
}

export async function atualizarProcedimento(id: string, proc: any) {
  const { error } = await supabase
    .from("procedimentos")
    .update(mapProcToDb(proc))
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar procedimento:", error);
    throw error;
  }
}

export async function excluirProcedimento(id: string) {
  const { error } = await supabase.from("procedimentos").delete().eq("id", id);
  if (error) {
    console.error("Erro ao excluir procedimento:", error);
    throw error;
  }
}

/* =========================================
   AGENDA — BLOQUEIOS
========================================= */

export async function listarBloqueios(professionalId?: string) {
  let query = supabase.from("agenda_bloqueios").select("*").order("date").order("start_time");
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error) { console.error("Erro ao listar bloqueios:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    professionalId: r.professional_id,
    date: r.date,
    start: r.start_time,
    end: r.end_time,
    reason: r.reason ?? "",
    createdAt: r.created_at,
  }));
}

export async function criarBloqueio(b: any) {
  const { data, error } = await supabase.from("agenda_bloqueios").insert({
    professional_id: b.professionalId,
    date: b.date,
    start_time: b.start,
    end_time: b.end,
    reason: b.reason ?? "",
  }).select().single();
  if (error) { console.error("Erro ao criar bloqueio:", error); throw error; }
  return { id: data.id, professionalId: data.professional_id, date: data.date, start: data.start_time, end: data.end_time, reason: data.reason ?? "", createdAt: data.created_at };
}

export async function excluirBloqueio(id: string) {
  const { error } = await supabase.from("agenda_bloqueios").delete().eq("id", id);
  if (error) { console.error("Erro ao excluir bloqueio:", error); throw error; }
}

/* =========================================
   AGENDA — LISTA DE ESPERA
========================================= */

export async function listarListaEspera() {
  const { data, error } = await supabase.from("lista_espera").select("*").order("created_at");
  if (error) { console.error("Erro ao listar lista de espera:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    patientName: r.patient_name,
    phone: r.phone ?? "",
    professionalId: r.professional_id ?? "",
    procedure: r.procedure ?? "",
    insurance: r.insurance ?? "",
    preferredDate: r.preferred_date ?? undefined,
    preferredStart: r.preferred_start ?? undefined,
    notes: r.notes ?? "",
    createdAt: r.created_at,
    notified: r.notified ?? false,
  }));
}

export async function criarListaEspera(e: any) {
  const { data, error } = await supabase.from("lista_espera").insert({
    patient_name: e.patientName,
    phone: e.phone ?? "",
    professional_id: e.professionalId || null,
    procedure: e.procedure ?? "",
    insurance: e.insurance ?? "",
    preferred_date: e.preferredDate ?? null,
    preferred_start: e.preferredStart ?? null,
    notes: e.notes ?? "",
    notified: false,
  }).select().single();
  if (error) { console.error("Erro ao criar lista de espera:", error); throw error; }
  return { ...e, id: data.id, createdAt: data.created_at };
}

export async function atualizarListaEspera(id: string, e: any) {
  const { error } = await supabase.from("lista_espera").update({
    notified: e.notified ?? false,
    notes: e.notes ?? "",
  }).eq("id", id);
  if (error) { console.error("Erro ao atualizar lista de espera:", error); throw error; }
}

export async function excluirListaEspera(id: string) {
  const { error } = await supabase.from("lista_espera").delete().eq("id", id);
  if (error) { console.error("Erro ao excluir lista de espera:", error); throw error; }
}

/* =========================================
   AGENDA — LOGS
========================================= */

export async function inserirLogAgenda(log: { appointmentId: string; action: string; detail: string; userName: string }) {
  const { error } = await supabase.from("agenda_logs").insert({
    appointment_id: log.appointmentId || null,
    action: log.action,
    detail: log.detail,
    user_name: log.userName,
  });
  if (error) console.error("Erro ao inserir log de agenda:", error);
}

export async function listarLogsAgenda(appointmentId?: string) {
  let query = supabase.from("agenda_logs").select("*").order("at", { ascending: false }).limit(500);
  if (appointmentId) query = query.eq("appointment_id", appointmentId);
  const { data, error } = await query;
  if (error) { console.error("Erro ao listar logs:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    appointmentId: r.appointment_id ?? "",
    action: r.action,
    detail: r.detail ?? "",
    at: r.at,
    user: r.user_name ?? "",
  }));
}

/* =========================================
   CONFIGURAÇÕES — EMPRESA
========================================= */

export async function getEmpresaDb() {
  const { data, error } = await supabase.from("empresa").select("*").limit(1).maybeSingle();
  if (error) { console.error("Erro ao buscar empresa:", error); return null; }
  if (!data) return null;
  return {
    id: data.id,
    razaoSocial: data.razao_social ?? "",
    nomeFantasia: data.nome_fantasia ?? "",
    cnpj: data.cnpj ?? "",
    cnes: data.cnes ?? "",
    telefone: data.telefone ?? "",
    email: data.email ?? "",
    endereco: data.endereco ?? "",
    numero: data.numero ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    cidade: data.cidade ?? "",
    estado: data.estado ?? "",
    cep: data.cep ?? "",
    logo: data.logo ?? "",
  };
}

export async function salvarEmpresaDb(empresa: any) {
  const row = {
    razao_social: empresa.razaoSocial,
    nome_fantasia: empresa.nomeFantasia,
    cnpj: empresa.cnpj,
    cnes: empresa.cnes,
    telefone: empresa.telefone,
    email: empresa.email,
    endereco: empresa.endereco,
    numero: empresa.numero,
    complemento: empresa.complemento,
    bairro: empresa.bairro,
    cidade: empresa.cidade,
    estado: empresa.estado,
    cep: empresa.cep,
    logo: empresa.logo,
  };
  const existing = await getEmpresaDb();
  if (existing?.id) {
    const { error } = await supabase.from("empresa").update(row).eq("id", existing.id);
    if (error) { console.error("Erro ao atualizar empresa:", error); throw error; }
  } else {
    const { error } = await supabase.from("empresa").insert(row);
    if (error) { console.error("Erro ao inserir empresa:", error); throw error; }
  }
}

/* =========================================
   CONFIGURAÇÕES — HORÁRIOS
========================================= */

export async function getHorariosDb() {
  const { data, error } = await supabase.from("horarios_clinica").select("*").order("dia_semana");
  if (error) { console.error("Erro ao buscar horários:", error); return null; }
  if (!data || data.length === 0) return null;
  const result: Record<number, any> = {};
  data.forEach((r: any) => {
    result[r.dia_semana] = {
      aberto: r.aberto,
      inicio: r.inicio ?? "08:00",
      fim: r.fim ?? "18:00",
      intervaloInicio: r.intervalo_inicio ?? "12:00",
      intervaloFim: r.intervalo_fim ?? "13:00",
      temIntervalo: r.tem_intervalo ?? false,
    };
  });
  return result;
}

export async function salvarHorariosDb(horarios: Record<number, any>) {
  for (const [dia, h] of Object.entries(horarios)) {
    const row = {
      dia_semana: Number(dia),
      aberto: h.aberto,
      inicio: h.inicio,
      fim: h.fim,
      intervalo_inicio: h.intervaloInicio ?? "12:00",
      intervalo_fim: h.intervaloFim ?? "13:00",
      tem_intervalo: h.temIntervalo ?? false,
    };
    const { data: existing } = await supabase.from("horarios_clinica").select("id").eq("dia_semana", Number(dia)).maybeSingle();
    if (existing?.id) {
      await supabase.from("horarios_clinica").update(row).eq("id", existing.id);
    } else {
      await supabase.from("horarios_clinica").insert(row);
    }
  }
}

/* =========================================
   CONFIGURAÇÕES — PERFIS
========================================= */

export async function listarPerfisDb() {
  const { data, error } = await supabase.from("perfis").select("*").order("criado_em");
  if (error) { console.error("Erro ao listar perfis:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    nome: r.nome,
    descricao: r.descricao ?? "",
    permissoes: r.permissoes ?? {},
    criadoEm: r.criado_em,
  }));
}

export async function salvarPerfilDb(perfil: any) {
  if (perfil.id && !perfil.id.startsWith("prf_")) {
    const { error } = await supabase.from("perfis").update({ nome: perfil.nome, descricao: perfil.descricao, permissoes: perfil.permissoes }).eq("id", perfil.id);
    if (error) { console.error("Erro ao atualizar perfil:", error); throw error; }
  } else {
    const { data, error } = await supabase.from("perfis").insert({ nome: perfil.nome, descricao: perfil.descricao ?? "", permissoes: perfil.permissoes }).select().single();
    if (error) { console.error("Erro ao criar perfil:", error); throw error; }
    return data.id;
  }
}

export async function excluirPerfilDb(id: string) {
  const { error } = await supabase.from("perfis").delete().eq("id", id);
  if (error) { console.error("Erro ao excluir perfil:", error); throw error; }
}

/* =========================================
   PRONTUÁRIOS
========================================= */

export async function getProntuarioDb(patientId: string) {
  const { data, error } = await supabase.from("prontuarios").select("*").eq("patient_id", patientId).maybeSingle();
  if (error) { console.error("Erro ao buscar prontuário:", error); return null; }
  return data;
}

export async function salvarProntuarioDb(patientId: string, record: any) {
  const existing = await getProntuarioDb(patientId);
  const row = {
    patient_id: patientId,
    patient_name: record.patientName ?? "",
    anamnese: record.anamnese ?? {},
    anamneses: record.anamneses ?? [],
    evolucoes: record.evolucoes ?? [],
    prescricoes: record.prescricoes ?? [],
    atualizado_em: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error } = await supabase.from("prontuarios").update(row).eq("id", existing.id);
    if (error) { console.error("Erro ao atualizar prontuário:", error); throw error; }
  } else {
    const { error } = await supabase.from("prontuarios").insert(row);
    if (error) { console.error("Erro ao inserir prontuário:", error); throw error; }
  }
}

/* =========================================
   REPASSE — ITENS
========================================= */

export async function listarRepasseItens(professionalId?: string) {
  let query = supabase.from("repasse_itens").select("*").order("data");
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error) { console.error("Erro ao listar repasse_itens:", error); return []; }
  return (data || []).map((r: any) => ({
    id: r.id,
    appointmentId: r.appointment_id,
    profissionalId: r.professional_id,
    profissional: r.profissional_nome ?? "",
    data: r.data,
    paciente: r.paciente_nome ?? "",
    procedimento: r.procedimento ?? "",
    convenio: r.convenio ?? "",
    valorProcedimento: r.valor_procedimento ?? 0,
    percentualRepasse: r.percentual_repasse ?? 0,
    valorRepasse: r.valor_repasse ?? 0,
  }));
}

export async function inserirRepasseItem(item: any) {
  const { error } = await supabase.from("repasse_itens").insert({
    appointment_id: item.appointmentId,
    professional_id: item.profissionalId,
    profissional_nome: item.profissional,
    data: item.data,
    paciente_nome: item.paciente,
    procedimento: item.procedimento,
    convenio: item.convenio,
    valor_procedimento: item.valorProcedimento,
    percentual_repasse: item.percentualRepasse,
    valor_repasse: item.valorRepasse,
  });
  if (error) { console.error("Erro ao inserir repasse_item:", error); throw error; }
}

export async function excluirRepasseItem(id: string) {
  const { error } = await supabase.from("repasse_itens").delete().eq("id", id);
  if (error) { console.error("Erro ao excluir repasse_item:", error); throw error; }
}

/* =========================================
   CONSULTÓRIO — FINALIZADOS
========================================= */

export async function listarFinalizadosConsultorio(date?: string) {
  let query = supabase.from("finalizados_consultorio").select("appointment_id");
  if (date) query = query.eq("date", date);
  const { data, error } = await query;
  if (error) { console.error("Erro ao listar finalizados:", error); return []; }
  return (data || []).map((r: any) => r.appointment_id as string);
}

export async function inserirFinalizadoConsultorio(appointmentId: string, date: string) {
  const { error } = await supabase.from("finalizados_consultorio").upsert({ appointment_id: appointmentId, date }, { onConflict: "appointment_id" });
  if (error) console.error("Erro ao inserir finalizado:", error);
}
