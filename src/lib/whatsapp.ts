// ─────────────────────────────────────────────────────────────────────────
// WhatsApp — templates de mensagem e helper de envio
// ─────────────────────────────────────────────────────────────────────────

export const WA_TEMPLATES_KEY = "nexaclinic_whatsapp_templates";
export const WA_SENT_LOG_KEY = "nexaclinic_whatsapp_log";
export const WA_REMINDER_LAST_RUN_KEY = "nexaclinic_whatsapp_reminder_last_run";
export const WA_ENABLED_KEY = "nexaclinic_whatsapp_enabled";

export interface WhatsAppTemplates {
  /** Enviada imediatamente quando um agendamento é criado */
  confirmacao: string;
  /** Enviada 1 dia antes da consulta/exame */
  lembrete: string;
}

export const DEFAULT_TEMPLATES: WhatsAppTemplates = {
  confirmacao:
    "Olá {nome}! ✅ Sua consulta de *{procedimento}* com {profissional} foi agendada para *{data}* às *{hora}*. " +
    "Qualquer dúvida, estamos à disposição!",
  lembrete:
    "Olá {nome}! ⏰ Passando para lembrar que você tem *{procedimento}* agendado para *amanhã*, " +
    "dia {data} às {hora}, com {profissional}. Até breve!",
};

export interface WALogEntry {
  id: string;
  appointmentId: string;
  type: "confirmacao" | "lembrete";
  patientName: string;
  phone: string;
  message: string;
  success: boolean;
  error?: string;
  at: string; // ISO datetime
}

// ── Configurações (ativar/desativar automação) ─────────────────────────────
export function isWhatsAppEnabled(): boolean {
  try {
    const v = localStorage.getItem(WA_ENABLED_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export function setWhatsAppEnabled(enabled: boolean) {
  try { localStorage.setItem(WA_ENABLED_KEY, String(enabled)); } catch { /* noop */ }
}

// ── Templates ────────────────────────────────────────────────────────────
export function getTemplates(): WhatsAppTemplates {
  try {
    const raw = localStorage.getItem(WA_TEMPLATES_KEY);
    if (!raw) return { ...DEFAULT_TEMPLATES };
    const parsed = JSON.parse(raw);
    return {
      confirmacao: parsed.confirmacao || DEFAULT_TEMPLATES.confirmacao,
      lembrete: parsed.lembrete || DEFAULT_TEMPLATES.lembrete,
    };
  } catch {
    return { ...DEFAULT_TEMPLATES };
  }
}

export function saveTemplates(templates: WhatsAppTemplates) {
  try { localStorage.setItem(WA_TEMPLATES_KEY, JSON.stringify(templates)); } catch { /* noop */ }
}

// ── Substituição de variáveis ───────────────────────────────────────────────
export interface WAVars {
  nome: string;
  procedimento: string;
  profissional: string;
  data: string;   // dd/mm/aaaa
  hora: string;   // HH:mm
  convenio?: string;
}

export function fillTemplate(template: string, vars: WAVars): string {
  return template
    .replaceAll("{nome}", vars.nome || "")
    .replaceAll("{procedimento}", vars.procedimento || "Consulta")
    .replaceAll("{profissional}", vars.profissional || "")
    .replaceAll("{data}", vars.data || "")
    .replaceAll("{hora}", vars.hora || "")
    .replaceAll("{convenio}", vars.convenio || "Particular");
}

export function dateToBR(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

// ── Log de envios ───────────────────────────────────────────────────────────
export function getLog(): WALogEntry[] {
  try { return JSON.parse(localStorage.getItem(WA_SENT_LOG_KEY) ?? "[]"); }
  catch { return []; }
}

export function appendLog(entry: WALogEntry) {
  try {
    const log = getLog();
    log.unshift(entry);
    localStorage.setItem(WA_SENT_LOG_KEY, JSON.stringify(log.slice(0, 200)));
  } catch { /* noop */ }
}

// ── Envio ────────────────────────────────────────────────────────────────
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!isWhatsAppEnabled()) {
    return { success: false, error: "Automação do WhatsApp desativada nas configurações." };
  }
  const api = (window as any)?.electronAPI?.whatsapp;
  if (!api) {
    return { success: false, error: "WhatsApp disponível apenas na versão desktop (Electron)." };
  }
  if (!phone || !phone.replace(/\D/g, "")) {
    return { success: false, error: "Paciente sem telefone cadastrado." };
  }
  try {
    return await api.sendMessage(phone, message);
  } catch (err: any) {
    return { success: false, error: err?.message ?? "Erro ao enviar mensagem." };
  }
}

export async function sendConfirmacaoAgendamento(params: {
  appointmentId: string;
  patientName: string;
  phone: string;
  procedimento: string;
  profissional: string;
  dateKey: string;
  hora: string;
  convenio?: string;
}) {
  const templates = getTemplates();
  const message = fillTemplate(templates.confirmacao, {
    nome: params.patientName,
    procedimento: params.procedimento,
    profissional: params.profissional,
    data: dateToBR(params.dateKey),
    hora: params.hora,
    convenio: params.convenio,
  });

  const result = await sendWhatsAppMessage(params.phone, message);

  appendLog({
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    appointmentId: params.appointmentId,
    type: "confirmacao",
    patientName: params.patientName,
    phone: params.phone,
    message,
    success: result.success,
    error: result.error,
    at: new Date().toISOString(),
  });

  return result;
}

export async function sendLembreteConsulta(params: {
  appointmentId: string;
  patientName: string;
  phone: string;
  procedimento: string;
  profissional: string;
  dateKey: string;
  hora: string;
  convenio?: string;
}) {
  const templates = getTemplates();
  const message = fillTemplate(templates.lembrete, {
    nome: params.patientName,
    procedimento: params.procedimento,
    profissional: params.profissional,
    data: dateToBR(params.dateKey),
    hora: params.hora,
    convenio: params.convenio,
  });

  const result = await sendWhatsAppMessage(params.phone, message);

  appendLog({
    id: `wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    appointmentId: params.appointmentId,
    type: "lembrete",
    patientName: params.patientName,
    phone: params.phone,
    message,
    success: result.success,
    error: result.error,
    at: new Date().toISOString(),
  });

  return result;
}

// ── Lembretes automáticos (1x por dia) ──────────────────────────────────────
// ── Lembretes — envio MANUAL (lista de "amanhã") ────────────────────────────

export interface LembreteAlvo {
  appointmentId: string;
  patientName: string;
  phone: string;
  procedimento: string;
  profissional: string;
  dateKey: string;
  hora: string;
  convenio?: string;
  jaEnviado: boolean;
}

/**
 * Retorna a lista de agendamentos de "amanhã" elegíveis para lembrete,
 * indicando quais já foram enviados (jaEnviado) com base no histórico.
 */
export function getLembretesAmanha(appointments: any[], professionals: any[]): LembreteAlvo[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const enviados = new Set(
    getLog().filter((l) => l.type === "lembrete" && l.success).map((l) => l.appointmentId)
  );

  return appointments
    .filter(
      (a) =>
        a.date === tomorrowKey &&
        a.status !== "cancelado" &&
        a.status !== "faltou"
    )
    .map((a) => {
      const prof = professionals.find((p: any) => p.id === a.professionalId);
      return {
        appointmentId: a.id,
        patientName: a.patientName,
        phone: a.phone ?? "",
        procedimento: a.procedure ?? "Consulta",
        profissional: prof?.name ?? "",
        dateKey: a.date,
        hora: a.start,
        convenio: a.insurance,
        jaEnviado: enviados.has(a.id),
      };
    })
    .sort((a, b) => a.hora.localeCompare(b.hora));
}

/**
 * Envia o lembrete manualmente para uma lista de alvos (selecionados pelo usuário).
 * Aplica um pequeno delay entre cada envio.
 */
export async function sendLembretesManual(
  alvos: LembreteAlvo[],
  onProgress?: (done: number, total: number, alvo: LembreteAlvo, success: boolean) => void
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  for (let i = 0; i < alvos.length; i++) {
    const a = alvos[i];
    if (!a.phone || !a.phone.replace(/\D/g, "")) {
      skipped++;
      onProgress?.(i + 1, alvos.length, a, false);
      continue;
    }
    const result = await sendLembreteConsulta({
      appointmentId: a.appointmentId,
      patientName: a.patientName,
      phone: a.phone,
      procedimento: a.procedimento,
      profissional: a.profissional,
      dateKey: a.dateKey,
      hora: a.hora,
      convenio: a.convenio,
    });
    if (result.success) sent++; else skipped++;
    onProgress?.(i + 1, alvos.length, a, result.success);
    if (i < alvos.length - 1) await new Promise((r) => setTimeout(r, 1500));
  }

  return { sent, skipped };
}
