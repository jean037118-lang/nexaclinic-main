// src/lib/mock-data.ts
// ─────────────────────────────────────────────────────────────────────────────
// Tipos e dados iniciais do sistema NexaClinic
// ─────────────────────────────────────────────────────────────────────────────

// ─── Paciente ─────────────────────────────────────────────────────────────────
export interface Patient {
  // ── Campos básicos (preenchidos no agendamento) ──────────────────────────
  id:        string;
  name:      string;
  cpf:       string;
  birth:     string;
  phone:     string;
  email:     string;
  insurance: string;
  lastVisit: string;
  status:    "ativo" | "inativo";

  // ── Identificação completa (cadastro completo) ───────────────────────────
  rg?:             string;
  sexo?:           "masculino" | "feminino" | "outro";
  estadoCivil?:    "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel";
  profissao?:      string;
  nacionalidade?:  string;
  naturalidade?:   string;
  nomeMae?:        string;
  nomePai?:        string;
  responsavel?:    string;        // para menores / incapazes
  telefone2?:      string;        // celular alternativo

  // ── Endereço ──────────────────────────────────────────────────────────────
  cep?:         string;
  endereco?:    string;
  numero?:      string;
  complemento?: string;
  bairro?:      string;
  cidade?:      string;
  estado?:      string;

  // ── Convênio / plano ──────────────────────────────────────────────────────
  convenioNumero?:   string;     // número da carteirinha
  convenioValidade?: string;     // validade do plano

  // ── Dados clínicos ────────────────────────────────────────────────────────
  alergias?:        string;
  medicamentos?:    string;       // em uso contínuo
  doencas?:         string;       // histórico de doenças
  cirurgias?:       string;
  historiaFamiliar?: string;
  tipoSanguineo?:   "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  observacoes?:     string;

  // ── Contato de emergência ─────────────────────────────────────────────────
  contatoEmergenciaNome?:      string;
  contatoEmergenciaTelefone?:  string;
  contatoEmergenciaParentesco?: string;

  // ── Controle interno ──────────────────────────────────────────────────────
  cadastroCompleto?: boolean;    // true quando o form completo foi preenchido
  criadoEm?:         string;
}

// Lista inicial vazia — pacientes são criados pelo agendamento ou cadastro manual
export const patients: Patient[] = [];

// ─── Appointment ──────────────────────────────────────────────────────────────
export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "aguardando"
  | "em_atendimento"
  | "finalizado"
  | "cancelado"
  | "faltou";

export interface Appointment {
  id:             string;
  patientName:    string;
  professionalId: string;
  start:          string;     // "HH:MM"
  durationMin:    number;
  procedure:      string;
  insurance:      string;
  status:         AppointmentStatus;
}

// ─── Professional ─────────────────────────────────────────────────────────────
export interface RepasseRegra {
  convenio: string;          // nome do convênio, ou "*" para qualquer convênio
  procedimento?: string;     // nome do procedimento, ou "*" / ausente para qualquer procedimento
  tipo: "percentual" | "fixo";
  valor: number;
}

export interface Professional {
  id:           string;
  name:         string;
  specialty:    string;
  crm:          string;
  color?:       string;
  active?:      boolean;
  avatar?:      string;
  scheduleStart?: string;
  scheduleEnd?:   string;
  slotDuration?:  number;
  tipo?:        "profissional" | "exame";
  repasseType?:  "percentual" | "fixo";   // regra global
  repasseValue?: number;                  // valor global
  repasseRegras?: RepasseRegra[];         // regras específicas por convênio
}

export const professionals: Professional[] = [
  { id: "p1", name: "Dra. Renata Mendes", specialty: "Cardiologia",  crm: "CRM/SP 123.456", color: "#0891b2", active: true },
  { id: "p2", name: "Dr. Carlos Lima",    specialty: "Clínico Geral", crm: "CRM/SP 654.321", color: "#7c3aed", active: true },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
export const statusLabels: Record<AppointmentStatus, string> = {
  agendado:       "Agendado",
  confirmado:     "Confirmado",
  aguardando:     "Aguardando",
  em_atendimento: "Em atendimento",
  finalizado:     "Finalizado",
  cancelado:      "Cancelado",
  faltou:         "Faltou",
};

export const statusColors: Record<AppointmentStatus, string> = {
  agendado:       "bg-blue-100 text-blue-700",
  confirmado:     "bg-cyan-100 text-cyan-700",
  aguardando:     "bg-amber-100 text-amber-700",
  em_atendimento: "bg-purple-100 text-purple-700",
  finalizado:     "bg-green-100 text-green-700",
  cancelado:      "bg-red-100 text-red-700",
  faltou:         "bg-slate-100 text-slate-600",
};
