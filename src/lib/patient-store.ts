<<<<<<< HEAD
/**
 * patient-store.ts — versão Supabase
 * API pública: getAll, add, update, remove, upsertByName, subscribe
 *
 * Mantém a mesma assinatura de funções da versão antiga (localStorage),
 * então nenhum componente que já usa "patientStore" precisa ser alterado.
 *
 * Diferença principal: os dados agora ficam no Supabase (nuvem),
 * então funcionam de forma sincronizada entre desktop e web,
 * e entre múltiplos computadores/usuários.
 */

=======
>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
import { supabase } from "./supabase";
import type { Patient } from "./mock-data";

type Listener = () => void;

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────
// Conversão entre o formato do banco (snake_case) e o formato usado
// no front-end (camelCase, igual à interface Patient em mock-data.ts)
// ─────────────────────────────────────────────────────────────────────────

function fromRow(row: any): Patient {
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf ?? "",
    birth: row.birth ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    insurance: row.insurance ?? "Particular",
    lastVisit: row.last_visit ?? "",
    status: row.status ?? "ativo",

    rg: row.rg ?? undefined,
    sexo: row.sexo ?? undefined,
    estadoCivil: row.estado_civil ?? undefined,
    profissao: row.profissao ?? undefined,
    nacionalidade: row.nacionalidade ?? undefined,
    naturalidade: row.naturalidade ?? undefined,
    nomeMae: row.nome_mae ?? undefined,
    nomePai: row.nome_pai ?? undefined,
    responsavel: row.responsavel ?? undefined,
    telefone2: row.telefone2 ?? undefined,

    cep: row.cep ?? undefined,
    endereco: row.endereco ?? undefined,
    numero: row.numero ?? undefined,
    complemento: row.complemento ?? undefined,
    bairro: row.bairro ?? undefined,
    cidade: row.cidade ?? undefined,
    estado: row.estado ?? undefined,

    convenioNumero: row.convenio_numero ?? undefined,
    convenioValidade: row.convenio_validade ?? undefined,

    alergias: row.alergias ?? undefined,
    medicamentos: row.medicamentos ?? undefined,
    doencas: row.doencas ?? undefined,
    cirurgias: row.cirurgias ?? undefined,
    historiaFamiliar: row.historia_familiar ?? undefined,
    tipoSanguineo: row.tipo_sanguineo ?? undefined,
    observacoes: row.observacoes ?? undefined,

    contatoEmergenciaNome: row.contato_emergencia_nome ?? undefined,
    contatoEmergenciaTelefone: row.contato_emergencia_telefone ?? undefined,
    contatoEmergenciaParentesco: row.contato_emergencia_parentesco ?? undefined,

    cadastroCompleto: row.cadastro_completo ?? undefined,
    criadoEm: row.created_at ?? undefined,
  };
}

function toRow(data: Partial<Omit<Patient, "id">>): Record<string, any> {
  const row: Record<string, any> = {};

  if (data.name !== undefined) row.name = data.name;
  if (data.cpf !== undefined) row.cpf = data.cpf;
  if (data.birth !== undefined) row.birth = data.birth;
  if (data.phone !== undefined) row.phone = data.phone;
  if (data.email !== undefined) row.email = data.email;
  if (data.insurance !== undefined) row.insurance = data.insurance;
  if (data.lastVisit !== undefined) row.last_visit = data.lastVisit;
  if (data.status !== undefined) row.status = data.status;

  if (data.rg !== undefined) row.rg = data.rg;
  if (data.sexo !== undefined) row.sexo = data.sexo;
  if (data.estadoCivil !== undefined) row.estado_civil = data.estadoCivil;
  if (data.profissao !== undefined) row.profissao = data.profissao;
  if (data.nacionalidade !== undefined) row.nacionalidade = data.nacionalidade;
  if (data.naturalidade !== undefined) row.naturalidade = data.naturalidade;
  if (data.nomeMae !== undefined) row.nome_mae = data.nomeMae;
  if (data.nomePai !== undefined) row.nome_pai = data.nomePai;
  if (data.responsavel !== undefined) row.responsavel = data.responsavel;
  if (data.telefone2 !== undefined) row.telefone2 = data.telefone2;

  if (data.cep !== undefined) row.cep = data.cep;
  if (data.endereco !== undefined) row.endereco = data.endereco;
  if (data.numero !== undefined) row.numero = data.numero;
  if (data.complemento !== undefined) row.complemento = data.complemento;
  if (data.bairro !== undefined) row.bairro = data.bairro;
  if (data.cidade !== undefined) row.cidade = data.cidade;
  if (data.estado !== undefined) row.estado = data.estado;

  if (data.convenioNumero !== undefined) row.convenio_numero = data.convenioNumero;
  if (data.convenioValidade !== undefined) row.convenio_validade = data.convenioValidade;

  if (data.alergias !== undefined) row.alergias = data.alergias;
  if (data.medicamentos !== undefined) row.medicamentos = data.medicamentos;
  if (data.doencas !== undefined) row.doencas = data.doencas;
  if (data.cirurgias !== undefined) row.cirurgias = data.cirurgias;
  if (data.historiaFamiliar !== undefined) row.historia_familiar = data.historiaFamiliar;
  if (data.tipoSanguineo !== undefined) row.tipo_sanguineo = data.tipoSanguineo;
  if (data.observacoes !== undefined) row.observacoes = data.observacoes;

  if (data.contatoEmergenciaNome !== undefined)
    row.contato_emergencia_nome = data.contatoEmergenciaNome;
  if (data.contatoEmergenciaTelefone !== undefined)
    row.contato_emergencia_telefone = data.contatoEmergenciaTelefone;
  if (data.contatoEmergenciaParentesco !== undefined)
    row.contato_emergencia_parentesco = data.contatoEmergenciaParentesco;

  if (data.cadastroCompleto !== undefined) row.cadastro_completo = data.cadastroCompleto;

  return row;
}

// ─────────────────────────────────────────────────────────────────────────
// Cache em memória simples, para que getAll() síncrono continue funcionando
// sem precisar reescrever todos os componentes para usar await.
// O cache é atualizado sempre que add/update/remove são chamados,
// e também recarregado em segundo plano ao iniciar.
// ─────────────────────────────────────────────────────────────────────────

let _cache: Patient[] = [];
let _loaded = false;

async function fetchAll(): Promise<Patient[]> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[patient-store] Erro ao buscar pacientes:", error);
    return [];
  }

  return (data ?? []).map(fromRow);
}

// Carrega o cache inicial assim que o módulo é importado
fetchAll().then((patients) => {
  _cache = patients;
  _loaded = true;
  notify();
});

export const patientStore = {
  /**
   * Retorna a lista de pacientes em cache (síncrono).
   * Use `refresh()` para garantir dados mais recentes vindos do Supabase.
   */
  getAll(): Patient[] {
    return _cache;
  },

  /** Força recarregar a lista direto do Supabase. */
  async refresh(): Promise<Patient[]> {
    _cache = await fetchAll();
    _loaded = true;
    notify();
    return _cache;
  },

  isLoaded(): boolean {
    return _loaded;
  },

  async add(data: Omit<Patient, "id">): Promise<Patient> {
    const row = toRow(data);
    const { data: inserted, error } = await supabase
      .from("pacientes")
      .insert(row)
=======
function mapFromDb(row: any): Patient {
  return {
    ...row,
    lastVisit: row.last_visit,
    estadoCivil: row.estado_civil,
    nomeMae: row.nome_mae,
    nomePai: row.nome_pai,
    convenioNumero: row.convenio_numero,
    convenioValidade: row.convenio_validade,
    historiaFamiliar: row.historia_familiar,
    tipoSanguineo: row.tipo_sanguineo,
    contatoEmergenciaNome: row.contato_emergencia_nome,
    contatoEmergenciaTelefone: row.contato_emergencia_telefone,
    contatoEmergenciaParentesco: row.contato_emergencia_parentesco,
    cadastroCompleto: row.cadastro_completo,
  } as Patient;
}

function mapToDb(data: any) {
  return {
    name: data.name,
    cpf: data.cpf,
    birth: data.birth,
    phone: data.phone,
    email: data.email,
    insurance: data.insurance,
    last_visit: data.lastVisit,
    status: data.status,

    rg: data.rg,
    sexo: data.sexo,
    estado_civil: data.estadoCivil,
    profissao: data.profissao,
    nacionalidade: data.nacionalidade,
    naturalidade: data.naturalidade,
    nome_mae: data.nomeMae,
    nome_pai: data.nomePai,
    responsavel: data.responsavel,
    telefone2: data.telefone2,

    cep: data.cep,
    endereco: data.endereco,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.cidade,
    estado: data.estado,

    convenio_numero: data.convenioNumero,
    convenio_validade: data.convenioValidade,

    alergias: data.alergias,
    medicamentos: data.medicamentos,
    doencas: data.doencas,
    cirurgias: data.cirurgias,
    historia_familiar: data.historiaFamiliar,
    tipo_sanguineo: data.tipoSanguineo,
    observacoes: data.observacoes,

    contato_emergencia_nome: data.contatoEmergenciaNome,
    contato_emergencia_telefone:
      data.contatoEmergenciaTelefone,
    contato_emergencia_parentesco:
      data.contatoEmergenciaParentesco,

    cadastro_completo:
      data.cadastroCompleto ?? false,
  };
}

export const patientStore = {
  async getAll(): Promise<Patient[]> {
    const { data, error } = await supabase
      .from("pacientes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }

    return (data || []).map(mapFromDb);
  },

  async add(
    patient: Omit<Patient, "id">
  ): Promise<Patient> {
    const payload = mapToDb(patient);

    const { data, error } = await supabase
      .from("pacientes")
      .insert(payload)
>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
      .select()
      .single();

    if (error) {
<<<<<<< HEAD
      console.error("[patient-store] Erro ao criar paciente:", error);
      throw new Error(error.message);
    }

    const newPatient = fromRow(inserted);
    _cache = [newPatient, ..._cache];
=======
      console.error(error);
      throw error;
    }

>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
    notify();

    return mapFromDb(data);
  },

<<<<<<< HEAD
  async update(id: string, data: Partial<Omit<Patient, "id">>): Promise<void> {
    const row = toRow(data);
    const { error } = await supabase.from("pacientes").update(row).eq("id", id);

    if (error) {
      console.error("[patient-store] Erro ao atualizar paciente:", error);
      throw new Error(error.message);
    }

    _cache = _cache.map((p) => (p.id === id ? { ...p, ...data } : p));
=======
  async update(
    id: string,
    updates: Partial<Omit<Patient, "id">>
  ): Promise<void> {
    const payload = mapToDb(updates);

    const { error } = await supabase
      .from("pacientes")
      .update(payload)
      .eq("id", id);

    if (error) {
      console.error(error);
      throw error;
    }

>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
    notify();
  },

  async remove(id: string): Promise<void> {
<<<<<<< HEAD
    const { error } = await supabase.from("pacientes").delete().eq("id", id);

    if (error) {
      console.error("[patient-store] Erro ao remover paciente:", error);
      throw new Error(error.message);
    }

    _cache = _cache.filter((p) => p.id !== id);
=======
    const { error } = await supabase
      .from("pacientes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      throw error;
    }

>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
    notify();
  },

  async upsertByName(
    name: string,
    extra?: Partial<Omit<Patient, "id" | "name">>
  ): Promise<Patient> {
<<<<<<< HEAD
    const existing = _cache.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      const updates: Partial<Omit<Patient, "id">> = {};
      if (extra?.cpf && extra.cpf.trim()) updates.cpf = extra.cpf.trim();
      if (extra?.phone && !existing.phone) updates.phone = extra.phone;
      if (extra?.insurance && extra.insurance !== "Particular" && !existing.insurance)
        updates.insurance = extra.insurance;

      if (Object.keys(updates).length > 0) {
        await patientStore.update(existing.id, updates);
        return { ...existing, ...updates };
      }
      return existing;
    }

    return patientStore.add({
=======
    const { data: existing, error } = await supabase
      .from("pacientes")
      .select("*")
      .ilike("name", name)
      .maybeSingle();

    if (error) {
      console.error(error);
      throw error;
    }

    if (existing) {
      const updates = mapToDb(extra || {});

      const { error: updateError } = await supabase
        .from("pacientes")
        .update(updates)
        .eq("id", existing.id);

      if (updateError) {
        console.error(updateError);
        throw updateError;
      }

      return {
        ...mapFromDb(existing),
        ...(extra || {}),
      } as Patient;
    }

    return await patientStore.add({
>>>>>>> 84bcc74942b5fec725b290a521052448a7d8d26b
      name,
      cpf: extra?.cpf ?? "",
      birth: extra?.birth ?? "",
      phone: extra?.phone ?? "",
      email: extra?.email ?? "",
      insurance: extra?.insurance ?? "Particular",
      lastVisit:
        extra?.lastVisit ??
        new Date().toISOString().split("T")[0],
      status: extra?.status ?? "ativo",
    } as Omit<Patient, "id">);
  },

  subscribe(listener: Listener) {
    listeners.add(listener);

    const channel = supabase
      .channel("pacientes_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pacientes",
        },
        () => {
          listener();
        }
      )
      .subscribe();

    return () => {
      listeners.delete(listener);
      supabase.removeChannel(channel);
    };
  },
};
