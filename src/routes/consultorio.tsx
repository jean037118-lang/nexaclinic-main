import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Stethoscope, Calendar, Clock, User, CheckCircle2,
  ChevronLeft, ChevronRight, FileText, Pill, ClipboardList,
  Save, Plus, ChevronDown, ChevronUp, Printer, X,
  AlertCircle, Activity, Search,
  FilePlus, FileCheck, SendHorizonal,
} from "lucide-react";
import { patientStore } from "@/lib/patient-store";
import { type Patient, type Professional } from "@/lib/mock-data";
import { getUsuarioAtual } from "@/lib/auth";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/consultorio")({
  component: ConsultorioPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AppointmentExt {
  id: string;
  patientName: string;
  patientId?: string;
  professionalId: string;
  date: string;
  start: string;
  durationMin: number;
  procedure: string;
  insurance: string;
  status: string;
  pago?: boolean;
  valorPago?: number;
  metodoPagamento?: string;
  procedureValue?: number;
}

interface Evolucao {
  id: string;
  data: string;
  profissional: string;
  cid10: string;
  queixa: string;
  exame: string;
  conduta: string;
  retorno: string;
}
interface Prescricao {
  id: string;
  data: string;
  profissional: string;
  medicamentos: string;
  observacoes: string;
}
interface Anamnese {
  queixaPrincipal: string; hda: string; hpp: string; hf: string;
  alergias: string; medicamentos: string; habitos: string;
  peso: string; altura: string; pressao: string; temperatura: string;
}
interface AnamneseRecord extends Anamnese {
  id: string;
  data: string;
  profissional: string;
}
interface ProntuarioRecord {
  patientId: string;
  anamnese: Anamnese; // legado
  anamneses: AnamneseRecord[];
  evolucoes: Evolucao[];
  prescricoes: Prescricao[];
  atualizadoEm: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRONT_KEY = "nexaclinic_prontuarios_v2";
const APPT_KEY  = "nexaclinic_appointments_v3";

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadAppts(): AppointmentExt[] {
  try { return JSON.parse(localStorage.getItem(APPT_KEY) ?? "[]"); } catch { return []; }
}

function loadProntuarios(): Record<string, ProntuarioRecord> {
  try { return JSON.parse(localStorage.getItem(PRONT_KEY) ?? "{}"); } catch { return {}; }
}
function saveProntuarios(data: Record<string, ProntuarioRecord>) {
  localStorage.setItem(PRONT_KEY, JSON.stringify(data));
}
function getProntuario(patientId: string): ProntuarioRecord {
  const all = loadProntuarios();
  const existing = all[patientId];
  const base = {
    patientId,
    anamnese: { queixaPrincipal: "", hda: "", hpp: "", hf: "", alergias: "", medicamentos: "", habitos: "", peso: "", altura: "", pressao: "", temperatura: "" },
    anamneses: [] as AnamneseRecord[],
    evolucoes: [],
    prescricoes: [],
    atualizadoEm: "",
  };
  if (!existing) return base;
  // Migração: se tinha anamnese legado com conteúdo e anamneses vazio, preserva como array
  if (existing && !existing.anamneses) {
    (existing as any).anamneses = [];
  }
  return { ...base, ...existing };
}
function saveProntuario(record: ProntuarioRecord) {
  const all = loadProntuarios();
  all[record.patientId] = { ...record, atualizadoEm: new Date().toISOString() };
  saveProntuarios(all);
}
function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ─── Tipos de documento ────────────────────────────────────────────────────────
interface DadosEmpresa {
  nomeFantasia?: string;
  razaoSocial?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  cnpj?: string;
  cnes?: string;
  logo?: string;
}

function getEmpresaData(): DadosEmpresa {
  try { return JSON.parse(localStorage.getItem("nexaclinic_empresa") ?? "{}"); } catch { return {}; }
}

// ─── Gerador de PDF via janela de impressão ────────────────────────────────────
function gerarPDF(opts: {
  titulo: string;
  subtitulo?: string;
  paciente: Patient;
  profissional: string;
  crm?: string;
  corpo: string; // HTML interno do documento
  rodapeExtra?: string;
}) {
  const empresa = getEmpresaData();
  const nomClinica = empresa.nomeFantasia || empresa.razaoSocial || "NexaClinic";
  const endClinica = [empresa.endereco, empresa.cidade, empresa.estado].filter(Boolean).join(", ");
  const dataHoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const cidadePaciente = empresa.cidade || "";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${opts.titulo} — ${opts.paciente.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 13px;
      color: #1a1a1a;
      background: #fff;
      padding: 40px 48px;
      max-width: 720px;
      margin: 0 auto;
    }

    /* Cabeçalho */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      border-bottom: 2px solid #1a1a1a;
      padding-bottom: 14px;
      margin-bottom: 20px;
      gap: 16px;
    }
    .header-logo { max-height: 52px; max-width: 140px; object-fit: contain; }
    .header-info { flex: 1; }
    .header-info .clinica-nome { font-size: 16px; font-weight: 700; letter-spacing: -0.3px; }
    .header-info .clinica-sub { font-size: 11px; color: #555; margin-top: 3px; line-height: 1.5; }
    .doc-title {
      text-align: center;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      border: 2px solid #1a1a1a;
      padding: 8px 16px;
      margin: 0 0 20px 0;
    }
    .doc-subtitle {
      text-align: center;
      font-size: 12px;
      color: #444;
      margin-top: -14px;
      margin-bottom: 20px;
      font-style: italic;
    }

    /* Bloco de dados do paciente */
    .paciente-box {
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 24px;
      font-size: 12px;
    }
    .paciente-box .field { display: flex; gap: 6px; }
    .paciente-box .label { color: #555; font-weight: 600; white-space: nowrap; }
    .paciente-box .value { font-weight: 400; }
    .paciente-box .full { grid-column: 1 / -1; }

    /* Corpo do documento */
    .corpo { margin-bottom: 32px; line-height: 1.75; }
    .corpo h4 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #444;
      border-bottom: 1px dotted #ccc;
      padding-bottom: 4px;
      margin: 18px 0 8px;
    }
    .corpo p { margin-bottom: 8px; }
    .corpo pre {
      font-family: inherit;
      white-space: pre-wrap;
      background: #f9f9f9;
      border-left: 3px solid #aaa;
      padding: 8px 12px;
      font-size: 13px;
      margin: 6px 0;
    }
    .corpo .destaque {
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      border: 2px solid #1a1a1a;
      padding: 12px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .corpo .dias { font-size: 40px; font-weight: 900; text-align: center; line-height: 1; }
    .corpo .dias-label { text-align: center; font-size: 12px; color: #444; margin-bottom: 12px; }

    /* Assinatura */
    .assinatura {
      margin-top: 50px;
      border-top: 1px solid #1a1a1a;
      padding-top: 10px;
      font-size: 12px;
      text-align: center;
    }
    .assinatura .nome { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
    .assinatura .crm { color: #555; }

    /* Data / local */
    .data-local {
      text-align: right;
      font-size: 12px;
      color: #555;
      margin-bottom: 28px;
    }

    /* Rodapé */
    .rodape {
      margin-top: 40px;
      border-top: 1px solid #ddd;
      padding-top: 8px;
      font-size: 10px;
      color: #888;
      text-align: center;
      line-height: 1.5;
    }

    /* Selo de autenticidade */
    .selo {
      display: inline-block;
      border: 1px dashed #999;
      padding: 4px 10px;
      font-size: 10px;
      color: #777;
      border-radius: 3px;
      margin-top: 6px;
    }

    @media print {
      body { padding: 20px 28px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Cabeçalho -->
  <div class="header">
    <div class="header-info">
      <div class="clinica-nome">${nomClinica}</div>
      <div class="clinica-sub">
        ${endClinica ? endClinica + "<br/>" : ""}
        ${empresa.telefone ? "Tel: " + empresa.telefone + "  " : ""}
        ${empresa.cnpj ? "CNPJ: " + empresa.cnpj + "  " : ""}
        ${empresa.cnes ? "CNES: " + empresa.cnes : ""}
      </div>
    </div>
    ${empresa.logo ? `<img src="${empresa.logo}" class="header-logo" alt="Logo" onerror="this.style.display='none'"/>` : ""}
  </div>

  <!-- Título do documento -->
  <div class="doc-title">${opts.titulo}</div>
  ${opts.subtitulo ? `<div class="doc-subtitle">${opts.subtitulo}</div>` : ""}

  <!-- Dados do paciente -->
  <div class="paciente-box">
    <div class="field full">
      <span class="label">Paciente:</span>
      <span class="value">${opts.paciente.name}</span>
    </div>
    ${opts.paciente.birth ? `<div class="field"><span class="label">Nascimento:</span><span class="value">${new Date(opts.paciente.birth).toLocaleDateString("pt-BR")} (${Math.floor((Date.now() - new Date(opts.paciente.birth).getTime()) / (1000*60*60*24*365.25))} anos)</span></div>` : ""}
    ${opts.paciente.cpf ? `<div class="field"><span class="label">CPF:</span><span class="value">${opts.paciente.cpf}</span></div>` : ""}
    ${(opts.paciente as any).insurance ? `<div class="field"><span class="label">Convênio:</span><span class="value">${(opts.paciente as any).insurance}</span></div>` : ""}
  </div>

  <!-- Data e local -->
  <div class="data-local">
    ${cidadePaciente ? cidadePaciente + ", " : ""}${dataHoje}
  </div>

  <!-- Corpo do documento -->
  <div class="corpo">${opts.corpo}</div>

  <!-- Assinatura -->
  <div class="assinatura">
    <div class="nome">${opts.profissional}</div>
    ${opts.crm ? `<div class="crm">CRM: ${opts.crm}</div>` : ""}
    ${opts.rodapeExtra ? `<div style="margin-top:6px;font-size:11px;color:#555">${opts.rodapeExtra}</div>` : ""}
    <div class="selo">Documento emitido via NexaClinic · ${new Date().toLocaleString("pt-BR")}</div>
  </div>

  <!-- Rodapé -->
  <div class="rodape">
    ${nomClinica} · ${endClinica} · Documento gerado eletronicamente
  </div>

  <!-- Botão imprimir (oculto na impressão) -->
  <div class="no-print" style="margin-top:32px; text-align:center; display:flex; gap:12px; justify-content:center">
    <button onclick="window.print()" style="background:#0f766e;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;cursor:pointer;font-family:sans-serif">
      🖨️ Imprimir / Salvar PDF
    </button>
    <button onclick="window.close()" style="background:#e2e8f0;color:#1a1a1a;border:none;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-family:sans-serif">
      Fechar
    </button>
  </div>

</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) { alert("Permita pop-ups para gerar documentos."); return; }
  win.document.write(html);
  win.document.close();
}

function getProfissionais(): Professional[] {
  try { const s = localStorage.getItem("nexaclinic_professionals"); if (s) return JSON.parse(s); } catch {}
  return [];
}

function idade(birth: string) {
  if (!birth) return "";
  return `${Math.floor((Date.now() - new Date(birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))} anos`;
}

// ─── Seção expansível (igual ao prontuário original) ──────────────────────────
function Secao({ titulo, icone, children, defaultOpen = true }: {
  titulo: string; icone: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button onClick={() => setAberto(!aberto)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3 font-semibold text-slate-800">{icone}{titulo}</div>
        {aberto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberto && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function ConsultorioPage() {
  const usuario = getUsuarioAtual();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<AppointmentExt[]>([]);
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [profissionais, setProfissionais] = useState<Professional[]>([]);

  // Painel do prontuário
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Patient | null>(null);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<AppointmentExt | null>(null);
  const [prontuario, setProntuario] = useState<ProntuarioRecord | null>(null);
  const [aba, setAba] = useState<"evolucoes" | "anamnese" | "prescricoes" | "documentos">("evolucoes");
  // IDs de agendamentos finalizados no consultório (sessão local)
  const [finalizadosConsultorio, setFinalizadosConsultorio] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("nexaclinic_finalizados_consultorio") ?? "[]")); } catch { return new Set(); }
  });

  // Carrega dados
  useEffect(() => {
    setAgendamentos(loadAppts());
    setProfissionais(getProfissionais());
    setPacientes(patientStore.getAll());
    return patientStore.subscribe(() => setPacientes(patientStore.getAll()));
  }, []);

  // ── Profissional vinculado ao usuário logado (pelo campo professionalId) ──
  const profVinculado = usuario?.professionalId
    ? profissionais.find((p) => p.id === usuario.professionalId)
    : profissionais.find(
        (p) => p.name?.toLowerCase().trim() === usuario?.nome?.toLowerCase().trim()
      );

  const isAdmin = usuario?.role === "admin";

  // ── Agendamentos do dia filtrados por profissional vinculado ──────────────
  const dateKey = toDateKey(currentDate);
  const agendamentosDoDia = agendamentos
    .filter((a) => {
      const isPago = a.pago === true || a.status === "aguardando" || a.status === "confirmado" || a.status === "finalizado";
      const isHoje = a.date === dateKey;
      const isProfissional = profVinculado
        ? a.professionalId === profVinculado.id
        : isAdmin; // admin sem vínculo vê todos
      return isPago && isHoje && isProfissional;
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  function abrirProntuario(ag: AppointmentExt) {
    // Tenta localizar o paciente pelo id ou nome
    const pac =
      pacientes.find((p) => p.id === ag.patientId) ??
      pacientes.find((p) => p.name.toLowerCase() === ag.patientName.toLowerCase());

    if (!pac) {
      toast.error("Paciente não encontrado no cadastro.");
      return;
    }
    setAgendamentoSelecionado(ag);
    setPacienteSelecionado(pac);
    setProntuario(getProntuario(pac.id));
    setAba("evolucoes");
  }

  function fecharProntuario() {
    setPacienteSelecionado(null);
    setAgendamentoSelecionado(null);
    setProntuario(null);
  }

  function finalizarAtendimento(agId: string) {
    const novos = new Set(finalizadosConsultorio);
    novos.add(agId);
    setFinalizadosConsultorio(novos);
    localStorage.setItem("nexaclinic_finalizados_consultorio", JSON.stringify([...novos]));
    // Atualiza o status do agendamento para "finalizado" no storage
    const todos = loadAppts();
    const atualizados = todos.map((a) => a.id === agId ? { ...a, status: "finalizado" } : a);
    localStorage.setItem(APPT_KEY, JSON.stringify(atualizados));
    setAgendamentos(atualizados);
    toast.success("Atendimento finalizado!");
    fecharProntuario();
  }

  function navegar(dir: -1 | 1) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(d);
    fecharProntuario();
  }

  const isHoje = dateKey === toDateKey(new Date());

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">

      {/* ── Coluna esquerda: agenda do consultório ─────────────────────────── */}
      <div
        className={`flex flex-col transition-all duration-300 ${pacienteSelecionado ? "w-80 min-w-[300px]" : "w-full"} border-r border-slate-200 bg-slate-50`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-600 px-4 py-4 text-white shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <Stethoscope className="w-5 h-5" />
            <h1 className="text-lg font-bold">Consultório</h1>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => navegar(-1)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">
                {currentDate.toLocaleDateString("pt-BR", { weekday: "long" })}
              </p>
              <p className="text-white/80 text-xs">
                {currentDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              </p>
            </div>
            <button onClick={() => navegar(1)} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {!isHoje && (
            <button
              onClick={() => { setCurrentDate(new Date()); fecharProntuario(); }}
              className="mt-2 w-full text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg py-1 transition"
            >
              Ir para hoje
            </button>
          )}
        </div>

        {/* Info do profissional */}
        {profVinculado && (
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
            <Avatar className="h-9 w-9 shrink-0">
              {profVinculado.avatar && <AvatarImage src={profVinculado.avatar} />}
              <AvatarFallback
                className="text-xs font-bold text-white"
                style={{ background: profVinculado.color ?? "#0891b2" }}
              >
                {profVinculado.name.split(" ").slice(1, 3).map((n) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{profVinculado.name}</p>
              <p className="text-xs text-slate-500 truncate">{profVinculado.specialty}</p>
            </div>
          </div>
        )}
        {isAdmin && !profVinculado && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 border-b border-purple-100 shrink-0">
            <span className="text-xs font-medium text-purple-700">👑 Administrador — exibindo todos os profissionais</span>
          </div>
        )}

        {/* Legenda */}
        <div className="px-4 py-2 bg-teal-50 border-b border-teal-100 shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-teal-700 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pacientes com pagamento confirmado
          </div>
        </div>

        {/* Lista de agendamentos */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {agendamentosDoDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-3">
              <Calendar className="w-12 h-12 opacity-20" />
              <div>
                <p className="text-sm font-medium">Nenhum paciente pago</p>
                <p className="text-xs mt-0.5">Nenhum agendamento com pagamento confirmado para este dia.</p>
              </div>
            </div>
          ) : (
            agendamentosDoDia.map((ag) => {
              const isAtivo = agendamentoSelecionado?.id === ag.id;
              // "Atendido" APENAS quando o médico clicou em Finalizar Atendimento nesta sessão
              const isFinalizado = finalizadosConsultorio.has(ag.id);
              const profAg = profissionais.find((p) => p.id === ag.professionalId);
              return (
                <button
                  key={ag.id}
                  onClick={() => isAtivo ? fecharProntuario() : abrirProntuario(ag)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isFinalizado
                      ? "border-emerald-300 bg-emerald-50 opacity-80"
                      : isAtivo
                      ? "border-teal-500 bg-teal-50 shadow-md"
                      : "border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: isFinalizado ? "#059669" : isAtivo ? "#0d9488" : "#94a3b8" }}
                      >
                        {ag.patientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold truncate ${isFinalizado ? "text-emerald-800 line-through" : isAtivo ? "text-teal-800" : "text-slate-800"}`}>
                          {ag.patientName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{ag.procedure || "Consulta"}</p>
                        {isAdmin && profAg && (
                          <p className="text-xs text-teal-600 font-medium truncate mt-0.5">👨‍⚕️ {profAg.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span
                        className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                        style={{
                          background: isFinalizado ? "#d1fae5" : isAtivo ? "#ccfbf1" : "#f1f5f9",
                          color: isFinalizado ? "#065f46" : isAtivo ? "#0f766e" : "#475569",
                          fontFamily: "monospace",
                        }}
                      >
                        {ag.start}
                      </span>
                      {isFinalizado && (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 rounded-full px-1.5 py-0.5">
                          ✓ Atendido
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{ag.durationMin} min</span>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400 truncate">{ag.insurance}</span>
                    {!isFinalizado && (
                      <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> Pago
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Contador */}
        {agendamentosDoDia.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-200 bg-white shrink-0">
            <p className="text-xs text-slate-500 text-center">
              {agendamentosDoDia.length} paciente{agendamentosDoDia.length !== 1 ? "s" : ""} hoje
            </p>
          </div>
        )}
      </div>

      {/* ── Coluna direita: prontuário ─────────────────────────────────────── */}
      {pacienteSelecionado && prontuario ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">

          {/* Header do paciente */}
          <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-4 text-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 text-white font-bold text-lg flex items-center justify-center shrink-0">
                  {pacienteSelecionado.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{pacienteSelecionado.name}</h2>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-white/80 text-xs">
                    {pacienteSelecionado.birth && <span>{idade(pacienteSelecionado.birth)}</span>}
                    {pacienteSelecionado.cpf && <span>CPF: {pacienteSelecionado.cpf}</span>}
                    <span>{pacienteSelecionado.insurance}</span>
                    {agendamentoSelecionado && (
                      <span className="bg-white/20 px-2 py-0.5 rounded-full font-medium">
                        {agendamentoSelecionado.start} · {agendamentoSelecionado.procedure || "Consulta"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right text-xs text-white/70 hidden sm:block">
                  {prontuario.atualizadoEm && (
                    <p>Atualizado {new Date(prontuario.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                  )}
                  <p>{prontuario.evolucoes.length} evolução(ões)</p>
                  {(() => {
                    const outros = [...new Set(prontuario.evolucoes.filter(e => e.profissional !== (usuario?.nome ?? "")).map(e => e.profissional))];
                    return outros.length > 0 ? (
                      <p className="text-amber-200 font-medium mt-0.5">
                        +{outros.length} profissional(is) anterior(es)
                      </p>
                    ) : null;
                  })()}
                </div>
                {agendamentoSelecionado && !finalizadosConsultorio.has(agendamentoSelecionado.id) && (
                  <button
                    onClick={() => finalizarAtendimento(agendamentoSelecionado.id)}
                    className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow"
                    title="Finalizar atendimento deste paciente"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Finalizar Atendimento
                  </button>
                )}
                {agendamentoSelecionado && finalizadosConsultorio.has(agendamentoSelecionado.id) && (
                  <span className="flex items-center gap-1.5 bg-emerald-600/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Atendimento finalizado
                  </span>
                )}
                <button
                  onClick={fecharProntuario}
                  className="p-2 hover:bg-white/20 rounded-lg transition"
                  title="Fechar prontuário"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="px-6 pt-3 bg-white border-b border-slate-200 shrink-0">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
              {(
                [
                  ["evolucoes",   "Evoluções",   ClipboardList],
                  ["anamnese",    "Anamnese",     Stethoscope],
                  ["prescricoes", "Prescrições",  Pill],
                  ["documentos",  "Documentos",   FilePlus],
                ] as [typeof aba, string, React.ElementType][]
              ).map(([a, label, Icon]) => (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    aba === a ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Conteúdo das abas */}
          <div className="flex-1 overflow-y-auto p-6">
            {aba === "evolucoes" && (
              <EvolucaoTab
                prontuario={prontuario}
                setProntuario={setProntuario}
                profissional={usuario?.nome ?? "Profissional"}
                profissionais={profissionais}
              />
            )}
            {aba === "anamnese" && (
              <AnamneseTab prontuario={prontuario} setProntuario={setProntuario} profissional={usuario?.nome ?? "Profissional"} />
            )}
            {aba === "prescricoes" && (
              <PrescricaoTab
                prontuario={prontuario}
                setProntuario={setProntuario}
                profissional={usuario?.nome ?? "Profissional"}
                paciente={pacienteSelecionado}
              />
            )}
            {aba === "documentos" && (
              <DocumentosTab
                paciente={pacienteSelecionado}
                profissional={usuario?.nome ?? "Profissional"}
                profVinculado={profVinculado ?? null}
                agendamento={agendamentoSelecionado}
              />
            )}
          </div>
        </div>
      ) : (
        /* Estado sem paciente selecionado */
        !pacienteSelecionado && agendamentosDoDia.length > 0 && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center text-slate-400">
              <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">Selecione um paciente</p>
              <p className="text-sm mt-1">Clique em um agendamento ao lado para abrir o prontuário</p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EVOLUÇÕES (idêntico ao prontuario.tsx original)
// ══════════════════════════════════════════════════════════════════════════════
const EVOLUCAO_VAZIA = { cid10: "", queixa: "", exame: "", conduta: "", retorno: "" };

function EvolucaoTab({ prontuario, setProntuario, profissional, profissionais }: {
  prontuario: ProntuarioRecord;
  setProntuario: (p: ProntuarioRecord) => void;
  profissional: string;
  profissionais: Professional[];
}) {
  const [form, setForm] = useState(EVOLUCAO_VAZIA);
  const [profSelecionado, setProfSelecionado] = useState(profissional);
  const [expandido, setExpandido] = useState<string | null>(null);

  function salvar() {
    if (!form.queixa && !form.conduta) { toast.error("Preencha ao menos a queixa ou a conduta."); return; }
    const nova: Evolucao = { id: uid(), data: new Date().toISOString(), profissional: profSelecionado, ...form };
    const atualizado = { ...prontuario, evolucoes: [nova, ...prontuario.evolucoes] };
    saveProntuario(atualizado); setProntuario(atualizado); setForm(EVOLUCAO_VAZIA);
    toast.success("Evolução salva!");
  }
  function excluir(id: string) {
    const atualizado = { ...prontuario, evolucoes: prontuario.evolucoes.filter((e) => e.id !== id) };
    saveProntuario(atualizado); setProntuario(atualizado); toast.success("Evolução excluída.");
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Nova Evolução" icone={<Plus className="w-4 h-4 text-cyan-600" />}>
        <div className="space-y-3 mt-4">
          {profissionais.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Profissional</label>
              <select value={profSelecionado} onChange={(e) => setProfSelecionado(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white">
                <option value={profissional}>{profissional} (atual)</option>
                {profissionais.map((p) => <option key={p.id} value={p.name}>{p.name} — {p.specialty}</option>)}
              </select>
            </div>
          )}
          {[
            { label: "CID-10", key: "cid10" as const, type: "input", placeholder: "Ex: G43 — Enxaqueca" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
              <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
            </div>
          ))}
          {[
            { label: "Queixa / Subjetivo", key: "queixa" as const, rows: 2, placeholder: "Relato do paciente, sintomas..." },
            { label: "Exame Físico / Objetivo", key: "exame" as const, rows: 2, placeholder: "Achados ao exame, sinais vitais..." },
            { label: "Conduta / Plano", key: "conduta" as const, rows: 3, placeholder: "Diagnóstico, tratamento, orientações..." },
          ].map(({ label, key, rows, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
              <textarea rows={rows} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                placeholder={placeholder}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Retorno</label>
            <input type="date" value={form.retorno} onChange={(e) => setForm({ ...form, retorno: e.target.value })}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <button onClick={salvar} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition">
            <Save className="w-4 h-4" /> Salvar Evolução
          </button>
        </div>
      </Secao>

      <Secao titulo={`Histórico de Evoluções (${prontuario.evolucoes.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />}>
        {prontuario.evolucoes.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma evolução registrada.</p>
        ) : (() => {
          // Detecta outros profissionais no histórico
          const outrosProfissionais = [...new Set(prontuario.evolucoes.map(e => e.profissional).filter(p => p !== profissional))];
          // Gera cor determinística por profissional
          const coresPaleta = ["#0891b2","#7c3aed","#db2777","#ea580c","#16a34a","#ca8a04","#dc2626","#2563eb"];
          const corPorProf: Record<string, string> = {};
          prontuario.evolucoes.forEach(ev => {
            if (!corPorProf[ev.profissional]) {
              const idx = Object.keys(corPorProf).length % coresPaleta.length;
              corPorProf[ev.profissional] = coresPaleta[idx];
            }
          });
          return (
            <div className="space-y-3 mt-4">
              {outrosProfissionais.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Histórico de outros profissionais</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Este paciente foi atendido por: <span className="font-medium">{outrosProfissionais.join(", ")}</span>
                    </p>
                  </div>
                </div>
              )}
              {prontuario.evolucoes.map((ev) => {
                const isMeu = ev.profissional === profissional;
                const cor = corPorProf[ev.profissional] ?? "#64748b";
                return (
                  <div key={ev.id} className="border rounded-xl overflow-hidden" style={{ borderColor: `${cor}44` }}>
                    <button onClick={() => setExpandido(expandido === ev.id ? null : ev.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition text-left">
                      <div className="flex items-center gap-2 flex-wrap text-sm min-w-0">
                        <span className="font-semibold text-slate-700 shrink-0">{new Date(ev.data).toLocaleDateString("pt-BR")}</span>
                        {ev.cid10 && <span className="bg-cyan-100 text-cyan-700 text-xs font-medium px-2 py-0.5 rounded-full shrink-0">{ev.cid10}</span>}
                        {/* Badge do profissional */}
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${cor}18`, color: cor, border: `1px solid ${cor}44` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cor }} />
                          {ev.profissional}
                          {isMeu && <span className="opacity-60 font-normal">(você)</span>}
                        </span>
                        {ev.queixa && <span className="text-slate-400 text-xs truncate max-w-[180px] hidden sm:block">{ev.queixa}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isMeu && (
                          <button onClick={(e) => { e.stopPropagation(); excluir(ev.id); }} className="p-1 text-slate-300 hover:text-red-500 transition rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {expandido === ev.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {expandido === ev.id && (
                      <div className="border-t px-4 py-4 space-y-3 text-sm" style={{ borderColor: `${cor}22`, background: `${cor}06` }}>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                          <span className="text-xs font-semibold" style={{ color: cor }}>Registrado por {ev.profissional}</span>
                          <span className="text-xs text-slate-400">em {new Date(ev.data).toLocaleString("pt-BR")}</span>
                        </div>
                        {ev.queixa && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Queixa / Subjetivo</p><p className="text-slate-700 whitespace-pre-wrap">{ev.queixa}</p></div>}
                        {ev.exame && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Exame Físico</p><p className="text-slate-700 whitespace-pre-wrap">{ev.exame}</p></div>}
                        {ev.conduta && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Conduta / Plano</p><p className="text-slate-700 whitespace-pre-wrap">{ev.conduta}</p></div>}
                        {ev.retorno && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Retorno</p><p className="text-slate-700">{new Date(ev.retorno).toLocaleDateString("pt-BR")}</p></div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Secao>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANAMNESE
// ══════════════════════════════════════════════════════════════════════════════
const ANAMNESE_VAZIA: Anamnese = { queixaPrincipal: "", hda: "", hpp: "", hf: "", alergias: "", medicamentos: "", habitos: "", peso: "", altura: "", pressao: "", temperatura: "" };

function AnamneseTab({ prontuario, setProntuario, profissional }: {
  prontuario: ProntuarioRecord; setProntuario: (p: ProntuarioRecord) => void; profissional: string;
}) {
  const [form, setForm] = useState<Anamnese>(ANAMNESE_VAZIA);
  const [expandido, setExpandido] = useState<string | null>(null);

  // Pré-preenche o formulário com o último registro se existir
  useEffect(() => {
    if (prontuario.anamneses.length > 0) {
      const ultimo = prontuario.anamneses[0];
      const { id, data, profissional: _p, ...campos } = ultimo;
      setForm(campos);
    }
  }, [prontuario.patientId]);

  function f(key: keyof Anamnese) {
    return { value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }) };
  }

  function salvar() {
    const temConteudo = Object.values(form).some(v => v.trim() !== "");
    if (!temConteudo) { toast.error("Preencha ao menos um campo antes de salvar."); return; }
    const novo: AnamneseRecord = { id: uid(), data: new Date().toISOString(), profissional, ...form };
    const atualizado = { ...prontuario, anamneses: [novo, ...prontuario.anamneses] };
    saveProntuario(atualizado); setProntuario(atualizado);
    toast.success("Anamnese salva!");
  }

  function excluir(id: string) {
    const atualizado = { ...prontuario, anamneses: prontuario.anamneses.filter(a => a.id !== id) };
    saveProntuario(atualizado); setProntuario(atualizado); toast.success("Anamnese excluída.");
  }

  const coresPaleta = ["#0891b2","#7c3aed","#db2777","#ea580c","#16a34a","#ca8a04","#dc2626","#2563eb"];
  const corPorProf: Record<string, string> = {};
  prontuario.anamneses.forEach(a => {
    if (!corPorProf[a.profissional]) corPorProf[a.profissional] = coresPaleta[Object.keys(corPorProf).length % coresPaleta.length];
  });

  return (
    <div className="space-y-4">
      {/* ── Formulário nova anamnese ── */}
      <Secao titulo="Nova Anamnese" icone={<Plus className="w-4 h-4 text-cyan-600" />}>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Peso (kg)", key: "peso" as const, placeholder: "Ex: 70" },
              { label: "Altura (cm)", key: "altura" as const, placeholder: "Ex: 170" },
              { label: "Pressão (mmHg)", key: "pressao" as const, placeholder: "Ex: 120/80" },
              { label: "Temperatura (°C)", key: "temperatura" as const, placeholder: "Ex: 36.5" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
                <input {...f(key)} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            ))}
          </div>
          {[
            { label: "Queixa Principal", key: "queixaPrincipal" as const, rows: 2, placeholder: "Motivo da consulta..." },
            { label: "História da Doença Atual (HDA)", key: "hda" as const, rows: 3, placeholder: "Início, evolução, fatores de piora/melhora..." },
            { label: "História Patológica Pregressa (HPP)", key: "hpp" as const, rows: 3, placeholder: "Doenças anteriores, cirurgias, internações..." },
            { label: "História Familiar (HF)", key: "hf" as const, rows: 3, placeholder: "Doenças na família, histórico genético..." },
            { label: "Alergias", key: "alergias" as const, rows: 2, placeholder: "Medicamentos, alimentos, outros..." },
            { label: "Medicamentos em uso", key: "medicamentos" as const, rows: 2, placeholder: "Nome, dose, frequência..." },
            { label: "Hábitos de vida", key: "habitos" as const, rows: 2, placeholder: "Tabagismo, etilismo, atividade física..." },
          ].map(({ label, key, rows, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
              <textarea {...f(key)} rows={rows} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
            </div>
          ))}
          <button onClick={salvar} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition">
            <Save className="w-4 h-4" /> Salvar Anamnese
          </button>
        </div>
      </Secao>

      {/* ── Histórico de anamneses ── */}
      <Secao titulo={`Histórico de Anamneses (${prontuario.anamneses.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />}>
        {prontuario.anamneses.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma anamnese registrada.</p>
        ) : (() => {
          const outrosProfissionais = [...new Set(prontuario.anamneses.map(a => a.profissional).filter(p => p !== profissional))];
          return (
            <div className="space-y-3 mt-4">
              {outrosProfissionais.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Anamneses de outros profissionais</p>
                    <p className="text-xs text-amber-700 mt-0.5">Registrado por: <span className="font-medium">{outrosProfissionais.join(", ")}</span></p>
                  </div>
                </div>
              )}
              {prontuario.anamneses.map((an) => {
                const isMeu = an.profissional === profissional;
                const cor = corPorProf[an.profissional] ?? "#64748b";
                const resumo = an.queixaPrincipal || an.hda || "";
                return (
                  <div key={an.id} className="border rounded-xl overflow-hidden" style={{ borderColor: `${cor}44` }}>
                    <button onClick={() => setExpandido(expandido === an.id ? null : an.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition text-left">
                      <div className="flex items-center gap-2 flex-wrap text-sm min-w-0">
                        <span className="font-semibold text-slate-700 shrink-0">{new Date(an.data).toLocaleDateString("pt-BR")}</span>
                        {(an.peso || an.pressao) && (
                          <span className="bg-rose-100 text-rose-700 text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                            {an.peso && `${an.peso}kg`}{an.peso && an.pressao && " · "}{an.pressao && `${an.pressao}mmHg`}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${cor}18`, color: cor, border: `1px solid ${cor}44` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                          {an.profissional}
                          {isMeu && <span className="opacity-60 font-normal">(você)</span>}
                        </span>
                        {resumo && <span className="text-slate-400 text-xs truncate max-w-[180px] hidden sm:block">{resumo}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isMeu && (
                          <button onClick={(e) => { e.stopPropagation(); excluir(an.id); }} className="p-1 text-slate-300 hover:text-red-500 transition rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {expandido === an.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {expandido === an.id && (
                      <div className="border-t px-4 py-4 space-y-3 text-sm" style={{ borderColor: `${cor}22`, background: `${cor}06` }}>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                          <span className="text-xs font-semibold" style={{ color: cor }}>Registrado por {an.profissional}</span>
                          <span className="text-xs text-slate-400">em {new Date(an.data).toLocaleString("pt-BR")}</span>
                        </div>
                        {(an.peso || an.altura || an.pressao || an.temperatura) && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Sinais Vitais</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[["Peso", an.peso, "kg"], ["Altura", an.altura, "cm"], ["Pressão", an.pressao, "mmHg"], ["Temperatura", an.temperatura, "°C"]].map(([l, v, u]) => v ? (
                                <div key={l} className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                                  <p className="text-[10px] text-slate-400 uppercase font-medium">{l}</p>
                                  <p className="text-sm font-bold text-slate-700">{v}<span className="text-xs font-normal text-slate-400 ml-0.5">{u}</span></p>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}
                        {[
                          ["Queixa Principal", an.queixaPrincipal],
                          ["História da Doença Atual", an.hda],
                          ["História Patológica Pregressa", an.hpp],
                          ["História Familiar", an.hf],
                          ["Alergias", an.alergias],
                          ["Medicamentos em uso", an.medicamentos],
                          ["Hábitos de vida", an.habitos],
                        ].map(([label, valor]) => valor ? (
                          <div key={label}>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">{label}</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{valor}</p>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Secao>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRESCRIÇÕES
// ══════════════════════════════════════════════════════════════════════════════
function PrescricaoTab({ prontuario, setProntuario, profissional, paciente }: {
  prontuario: ProntuarioRecord; setProntuario: (p: ProntuarioRecord) => void;
  profissional: string; paciente: Patient;
}) {
  const [medicamentos, setMedicamentos] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function salvar() {
    if (!medicamentos.trim()) { toast.error("Informe os medicamentos da prescrição."); return; }
    const nova: Prescricao = { id: uid(), data: new Date().toISOString(), profissional, medicamentos, observacoes };
    const atualizado = { ...prontuario, prescricoes: [nova, ...prontuario.prescricoes] };
    saveProntuario(atualizado); setProntuario(atualizado);
    setMedicamentos(""); setObservacoes(""); toast.success("Prescrição salva!");
  }
  function excluir(id: string) {
    const atualizado = { ...prontuario, prescricoes: prontuario.prescricoes.filter((p) => p.id !== id) };
    saveProntuario(atualizado); setProntuario(atualizado);
  }
  function imprimir(p: Prescricao) {
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<html><head><title>Prescrição — ${paciente.name}</title>
      <style>body{font-family:Arial,sans-serif;max-width:600px;margin:40px auto;font-size:14px}h2{border-bottom:2px solid #333;padding-bottom:8px}.info{color:#666;margin-bottom:20px}.meds{white-space:pre-wrap;line-height:1.8}.footer{margin-top:60px;border-top:1px solid #333;padding-top:12px;text-align:center}@media print{button{display:none}}</style>
      </head><body>
      <h2>Prescrição Médica</h2>
      <div class="info"><strong>Paciente:</strong> ${paciente.name}<br/><strong>Data:</strong> ${new Date(p.data).toLocaleDateString("pt-BR")}<br/><strong>Profissional:</strong> ${p.profissional}</div>
      <div class="meds">${p.medicamentos}</div>
      ${p.observacoes ? `<p><strong>Observações:</strong> ${p.observacoes}</p>` : ""}
      <div class="footer">${p.profissional}</div>
      <br/><button onclick="window.print()">🖨️ Imprimir</button></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Nova Prescrição" icone={<Pill className="w-4 h-4 text-violet-600" />}>
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Medicamentos</label>
            <textarea rows={5} value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)}
              placeholder={"1. Dipirona 500mg — 1 comprimido a cada 6h por 5 dias\n2. Ibuprofeno 400mg — 1 comprimido 8/8h com alimento\n..."}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Observações</label>
            <input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Orientações gerais, restrições..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
          </div>
          <button onClick={salvar} className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition">
            <Save className="w-4 h-4" /> Salvar Prescrição
          </button>
        </div>
      </Secao>
      <Secao titulo={`Histórico de Prescrições (${prontuario.prescricoes.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />}>
        {prontuario.prescricoes.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma prescrição registrada.</p>
        ) : (
          <div className="space-y-3 mt-4">
            {prontuario.prescricoes.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-slate-700 text-sm">{new Date(p.data).toLocaleDateString("pt-BR")}</span>
                    <span className="text-slate-400 text-xs ml-2">{p.profissional}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => imprimir(p)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition" title="Imprimir"><Printer className="w-4 h-4" /></button>
                    <button onClick={() => excluir(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Excluir"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 text-xs leading-relaxed">{p.medicamentos}</pre>
                {p.observacoes && <p className="text-xs text-slate-500 mt-2">{p.observacoes}</p>}
              </div>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA DOCUMENTOS — Atestado, Receituário, Encaminhamento
// ══════════════════════════════════════════════════════════════════════════════

type TipoDoc = "atestado" | "receituario" | "encaminhamento";

interface FormAtestado {
  dias: string;
  motivo: string;
  cid10: string;
  observacoes: string;
}
interface FormReceituario {
  medicamentos: string;
  observacoes: string;
  uso: "simples" | "controle_especial";
}
interface FormEncaminhamento {
  especialidade: string;
  medico: string;
  motivo: string;
  hipotese: string;
  cid10: string;
  urgente: boolean;
}

const ATESTADO_VAZIO: FormAtestado = { dias: "1", motivo: "tratamento médico", cid10: "", observacoes: "" };
const RECEITUARIO_VAZIO: FormReceituario = { medicamentos: "", observacoes: "", uso: "simples" };
const ENCAMINHAMENTO_VAZIO: FormEncaminhamento = { especialidade: "", medico: "", motivo: "", hipotese: "", cid10: "", urgente: false };

function DocumentosTab({ paciente, profissional, profVinculado, agendamento }: {
  paciente: Patient;
  profissional: string;
  profVinculado: any | null;
  agendamento: any | null;
}) {
  const [docAtivo, setDocAtivo] = useState<TipoDoc>("atestado");
  const [atestado, setAtestado] = useState<FormAtestado>(ATESTADO_VAZIO);
  const [receituario, setReceituario] = useState<FormReceituario>(RECEITUARIO_VAZIO);
  const [encaminhamento, setEncaminhamento] = useState<FormEncaminhamento>(ENCAMINHAMENTO_VAZIO);

  const crm = profVinculado?.crm ?? "";

  // ── Gerar Atestado ─────────────────────────────────────────────────────────
  function emitirAtestado() {
    if (!atestado.dias || !atestado.motivo) { toast.error("Preencha o número de dias e o motivo."); return; }

    const corpo = `
      <div class="destaque">
        <div class="dias">${atestado.dias}</div>
        <div class="dias-label">dia${Number(atestado.dias) !== 1 ? "s" : ""} de afastamento das atividades</div>
      </div>
      <p>
        Atesto para os devidos fins que o(a) paciente <strong>${paciente.name}</strong>
        necessita de afastamento de suas atividades pelo período de
        <strong>${atestado.dias} (${numeroPorExtenso(Number(atestado.dias))}) dia${Number(atestado.dias) !== 1 ? "s" : ""}</strong>,
        a partir da presente data, por motivo de <strong>${atestado.motivo}</strong>.
      </p>
      ${atestado.cid10 ? `
        <h4>Código da Doença (CID-10)</h4>
        <p>${atestado.cid10}</p>
      ` : ""}
      ${atestado.observacoes ? `
        <h4>Observações</h4>
        <p>${atestado.observacoes}</p>
      ` : ""}
    `;

    gerarPDF({
      titulo: "Atestado Médico",
      paciente,
      profissional,
      crm,
      corpo,
    });
  }

  // ── Gerar Receituário ──────────────────────────────────────────────────────
  function emitirReceituario() {
    if (!receituario.medicamentos.trim()) { toast.error("Informe os medicamentos."); return; }

    const linhas = receituario.medicamentos
      .split("\n")
      .filter((l) => l.trim())
      .map((l, i) => `<p>${i + 1}. ${l.trim()}</p>`)
      .join("");

    const corpo = `
      <h4>Prescrição</h4>
      ${linhas}
      ${receituario.observacoes ? `
        <h4>Orientações</h4>
        <p>${receituario.observacoes}</p>
      ` : ""}
      ${receituario.uso === "controle_especial" ? `
        <div style="margin-top:20px;border:2px dashed #999;padding:8px 12px;font-size:11px;color:#555;text-align:center">
          ⚠ MEDICAMENTO SOB CONTROLE ESPECIAL — Via dupla — Reter 1ª via na farmácia
        </div>
      ` : ""}
    `;

    gerarPDF({
      titulo: receituario.uso === "controle_especial"
        ? "Receituário Especial (Controle Especial)"
        : "Receituário Simples",
      paciente,
      profissional,
      crm,
      corpo,
    });
  }

  // ── Gerar Encaminhamento ───────────────────────────────────────────────────
  function emitirEncaminhamento() {
    if (!encaminhamento.especialidade || !encaminhamento.motivo) {
      toast.error("Preencha a especialidade e o motivo do encaminhamento.");
      return;
    }

    const corpo = `
      ${encaminhamento.urgente ? `
        <div style="background:#fee2e2;border:2px solid #dc2626;color:#991b1b;padding:8px 14px;border-radius:4px;font-weight:700;text-align:center;margin-bottom:16px">
          ⚠ ENCAMINHAMENTO URGENTE / PRIORITÁRIO
        </div>
      ` : ""}
      <h4>Encaminhamento para</h4>
      <p>
        <strong>Especialidade:</strong> ${encaminhamento.especialidade}<br/>
        ${encaminhamento.medico ? `<strong>Médico/Serviço:</strong> ${encaminhamento.medico}<br/>` : ""}
      </p>
      <h4>Motivo do encaminhamento</h4>
      <p>${encaminhamento.motivo}</p>
      ${encaminhamento.hipotese ? `
        <h4>Hipótese diagnóstica</h4>
        <p>${encaminhamento.hipotese}</p>
      ` : ""}
      ${encaminhamento.cid10 ? `
        <h4>CID-10</h4>
        <p>${encaminhamento.cid10}</p>
      ` : ""}
    `;

    gerarPDF({
      titulo: "Encaminhamento Médico",
      subtitulo: `Para: ${encaminhamento.especialidade}${encaminhamento.medico ? " — " + encaminhamento.medico : ""}`,
      paciente,
      profissional,
      crm,
      corpo,
    });
  }

  const docs: { id: TipoDoc; label: string; icon: React.ElementType; cor: string }[] = [
    { id: "atestado",       label: "Atestado Médico",    icon: FileCheck,       cor: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { id: "receituario",    label: "Receituário",         icon: Pill,            cor: "text-violet-600 bg-violet-50 border-violet-200" },
    { id: "encaminhamento", label: "Encaminhamento",      icon: SendHorizonal,   cor: "text-sky-600 bg-sky-50 border-sky-200" },
  ];

  return (
    <div className="space-y-5">
      {/* Seletor de documento */}
      <div className="grid grid-cols-3 gap-3">
        {docs.map((d) => {
          const Icon = d.icon;
          const ativo = docAtivo === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDocAtivo(d.id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition font-medium text-sm ${
                ativo ? d.cor + " shadow-sm" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <Icon className="w-6 h-6" />
              {d.label}
            </button>
          );
        })}
      </div>

      {/* ── Atestado ────────────────────────────────────────────────────── */}
      {docAtivo === "atestado" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-slate-800">Atestado Médico</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Dias de afastamento *</label>
              <input
                type="number" min="1" max="365"
                value={atestado.dias}
                onChange={(e) => setAtestado({ ...atestado, dias: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">CID-10 (opcional)</label>
              <input
                value={atestado.cid10}
                onChange={(e) => setAtestado({ ...atestado, cid10: e.target.value })}
                placeholder="Ex: J06 — Infecção aguda"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Motivo *</label>
            <input
              value={atestado.motivo}
              onChange={(e) => setAtestado({ ...atestado, motivo: e.target.value })}
              placeholder="tratamento médico, cirurgia, recuperação pós-operatória..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Observações (opcional)</label>
            <textarea
              rows={2}
              value={atestado.observacoes}
              onChange={(e) => setAtestado({ ...atestado, observacoes: e.target.value })}
              placeholder="Restrições específicas, orientações..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>
          <button
            onClick={emitirAtestado}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" /> Emitir Atestado (PDF)
          </button>
        </div>
      )}

      {/* ── Receituário ────────────────────────────────────────────────── */}
      {docAtivo === "receituario" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Pill className="w-4 h-4 text-violet-600" />
            <h3 className="font-semibold text-slate-800">Receituário</h3>
          </div>
          {/* Tipo de receituário */}
          <div className="flex gap-3">
            {(["simples", "controle_especial"] as const).map((tipo) => (
              <button
                key={tipo}
                onClick={() => setReceituario({ ...receituario, uso: tipo })}
                className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition ${
                  receituario.uso === tipo
                    ? tipo === "simples"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-red-600 border-red-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {tipo === "simples" ? "Receituário Simples" : "⚠ Controle Especial"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">
              Medicamentos * <span className="font-normal">(uma linha por item)</span>
            </label>
            <textarea
              rows={6}
              value={receituario.medicamentos}
              onChange={(e) => setReceituario({ ...receituario, medicamentos: e.target.value })}
              placeholder={"Dipirona 500mg — 1 comprimido a cada 6h por 5 dias\nIbuprofeno 400mg — 1 comprimido 8/8h com alimento\nOmeprazol 20mg — 1 cápsula em jejum por 14 dias"}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Orientações (opcional)</label>
            <input
              value={receituario.observacoes}
              onChange={(e) => setReceituario({ ...receituario, observacoes: e.target.value })}
              placeholder="Restrições alimentares, horários, cuidados especiais..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          <button
            onClick={emitirReceituario}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" /> Emitir Receituário (PDF)
          </button>
        </div>
      )}

      {/* ── Encaminhamento ──────────────────────────────────────────────── */}
      {docAtivo === "encaminhamento" && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <SendHorizonal className="w-4 h-4 text-sky-600" />
            <h3 className="font-semibold text-slate-800">Encaminhamento Médico</h3>
          </div>
          {/* Urgente toggle */}
          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 transition ${encaminhamento.urgente ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
            <div>
              <p className="text-sm font-semibold text-slate-700">Encaminhamento urgente / prioritário</p>
              <p className="text-xs text-slate-500">Aparece em destaque vermelho no documento</p>
            </div>
            <button
              onClick={() => setEncaminhamento({ ...encaminhamento, urgente: !encaminhamento.urgente })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${encaminhamento.urgente ? "bg-red-500" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${encaminhamento.urgente ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Especialidade *</label>
              <input
                value={encaminhamento.especialidade}
                onChange={(e) => setEncaminhamento({ ...encaminhamento, especialidade: e.target.value })}
                placeholder="Cardiologia, Ortopedia..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Médico / Serviço (opcional)</label>
              <input
                value={encaminhamento.medico}
                onChange={(e) => setEncaminhamento({ ...encaminhamento, medico: e.target.value })}
                placeholder="Dr. Nome ou nome do serviço"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Motivo do encaminhamento *</label>
            <textarea
              rows={3}
              value={encaminhamento.motivo}
              onChange={(e) => setEncaminhamento({ ...encaminhamento, motivo: e.target.value })}
              placeholder="Descreva o quadro clínico e o motivo do encaminhamento..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Hipótese diagnóstica</label>
              <input
                value={encaminhamento.hipotese}
                onChange={(e) => setEncaminhamento({ ...encaminhamento, hipotese: e.target.value })}
                placeholder="Ex: Insuficiência cardíaca..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">CID-10 (opcional)</label>
              <input
                value={encaminhamento.cid10}
                onChange={(e) => setEncaminhamento({ ...encaminhamento, cid10: e.target.value })}
                placeholder="Ex: I50"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          </div>
          <button
            onClick={emitirEncaminhamento}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition"
          >
            <Printer className="w-4 h-4" /> Emitir Encaminhamento (PDF)
          </button>
        </div>
      )}

      {/* Aviso sobre dados da empresa */}
      {(() => {
        const emp = getEmpresaData();
        const temDados = !!(emp.nomeFantasia || emp.razaoSocial);
        return !temDados ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              O cabeçalho dos documentos usará apenas o nome "NexaClinic" pois os dados da empresa não foram configurados.
              Configure em <strong>Configurações → Empresa</strong>.
            </p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ─── Utilitário: número por extenso (1–60 dias) ───────────────────────────────
function numeroPorExtenso(n: number): string {
  const unidades = ["zero","um","dois","três","quatro","cinco","seis","sete","oito","nove",
    "dez","onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove"];
  const dezenas = ["","","vinte","trinta","quarenta","cinquenta"];
  if (n < 20) return unidades[n] ?? String(n);
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? dezenas[d] : `${dezenas[d]} e ${unidades[u]}`;
}
