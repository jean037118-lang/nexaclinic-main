import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  Phone, MessageCircle, CheckCircle2, Clock, Calendar,
  Search, PhoneCall, PhoneOff, PhoneMissed, Send,
  ChevronDown, X, Filter, History, User, Bell,
  PhoneIncoming, Smile, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { patientStore } from "@/lib/patient-store";
import { listarAgendamentos, listarProfissionais } from "@/lib/agendaData";

export const Route = createFileRoute("/telefonia")({
  head: () => ({ meta: [{ title: "Telefonia — NexaClinic" }] }),
  component: TelefoniaPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TipoContato = "ligacao" | "whatsapp" | "confirmacao" | "lembrete" | "retorno";
type ResultadoContato = "atendeu" | "nao_atendeu" | "ocupado" | "caixa_postal" | "confirmado" | "recusou" | "remarcou" | "enviado";

interface RegistroContato {
  id: string;
  pacienteNome: string;
  pacienteTelefone: string;
  agendamentoId?: string;
  agendamentoData?: string;
  agendamentoHora?: string;
  profissionalNome?: string;
  procedimento?: string;
  tipo: TipoContato;
  resultado: ResultadoContato;
  observacao?: string;
  mensagemEnviada?: string;
  criadoEm: string; // ISO
  criadoPor: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const KEY = "nexaclinic_telefonia_log";

function loadLog(): RegistroContato[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}
function saveLog(list: RegistroContato[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
function addRegistro(r: Omit<RegistroContato, "id" | "criadoEm">) {
  const novo: RegistroContato = {
    ...r,
    id: `tel_${Date.now()}`,
    criadoEm: new Date().toISOString(),
  };
  saveLog([novo, ...loadLog()]);
  return novo;
}

// ─── Templates de mensagem ────────────────────────────────────────────────────
function templateLembrete(nome: string, data: string, hora: string, proc: string, clinica: string) {
  return `Olá, ${nome}! 😊\n\nPassando para lembrar da sua *${proc}* amanhã, *${data} às ${hora}*.\n\nQualquer dúvida, estamos à disposição!\n\n_${clinica}_`;
}
function templateConfirmacao(nome: string, data: string, hora: string, proc: string, clinica: string) {
  return `Olá, ${nome}! 👋\n\nGostaríamos de confirmar sua *${proc}* no dia *${data} às ${hora}*.\n\nPor favor, responda *SIM* para confirmar ou *NÃO* para cancelar/remarcar.\n\n_${clinica}_`;
}
function templateRetorno(nome: string, clinica: string) {
  return `Olá, ${nome}! 😊\n\nNotamos que faz um tempo desde sua última consulta. Que tal agendar um retorno? Estamos com horários disponíveis!\n\nEntre em contato para agendar.\n\n_${clinica}_`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTelefone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return raw;
}
function telParaWhatsApp(tel: string) {
  const d = tel.replace(/\D/g, "");
  const com55 = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${com55}`;
}
function telParaLigacao(tel: string) {
  return `tel:${tel.replace(/\D/g, "")}`;
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(str: string) {
  if (!str) return "—";
  return new Date(str + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function nomeClinica() {
  try { return JSON.parse(localStorage.getItem("nexaclinic_empresa") ?? "{}").nome || "NexaClinic"; } catch { return "NexaClinic"; }
}

const TIPO_INFO: Record<TipoContato, { label: string; cor: string; icon: React.ElementType }> = {
  ligacao:     { label: "Ligação",       cor: "bg-blue-100 text-blue-700 border-blue-200",    icon: Phone },
  whatsapp:    { label: "WhatsApp",      cor: "bg-green-100 text-green-700 border-green-200", icon: MessageCircle },
  confirmacao: { label: "Confirmação",   cor: "bg-cyan-100 text-cyan-700 border-cyan-200",    icon: CheckCircle2 },
  lembrete:    { label: "Lembrete",      cor: "bg-amber-100 text-amber-700 border-amber-200", icon: Bell },
  retorno:     { label: "Ret. Retorno",  cor: "bg-violet-100 text-violet-700 border-violet-200", icon: PhoneIncoming },
};

const RESULTADO_INFO: Record<ResultadoContato, { label: string; cor: string; icon: React.ElementType }> = {
  atendeu:      { label: "Atendeu",       cor: "bg-emerald-100 text-emerald-700", icon: PhoneCall },
  confirmado:   { label: "Confirmado",    cor: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  enviado:      { label: "Enviado",       cor: "bg-green-100 text-green-700",     icon: Send },
  nao_atendeu:  { label: "Não atendeu",   cor: "bg-slate-100 text-slate-600",     icon: PhoneMissed },
  ocupado:      { label: "Ocupado",       cor: "bg-amber-100 text-amber-700",     icon: PhoneOff },
  caixa_postal: { label: "Caixa postal",  cor: "bg-amber-100 text-amber-700",     icon: PhoneOff },
  recusou:      { label: "Recusou",       cor: "bg-red-100 text-red-700",         icon: PhoneOff },
  remarcou:     { label: "Remarcou",      cor: "bg-violet-100 text-violet-700",   icon: Calendar },
};

// ─── Componente: Painel de Contato Rápido ─────────────────────────────────────
function PainelContato({ apt, onClose, onRegistrado }: {
  apt: any;
  onClose: () => void;
  onRegistrado: () => void;
}) {
  const clinica = nomeClinica();
  const nome  = apt.patientName ?? "";
  const tel   = apt.phone ?? "";
  const data  = fmtDate(apt.date);
  const hora  = apt.start ?? "";
  const proc  = apt.procedure ?? "Consulta";
  const prof  = apt.professionalName ?? "";

  const [resultado, setResultado] = useState<ResultadoContato | null>(null);
  const [obs, setObs]             = useState("");
  const [mensagem, setMensagem]   = useState("");
  const [msgOpen, setMsgOpen]     = useState(false);
  const [tipoMsg, setTipoMsg]     = useState<"confirmacao" | "lembrete" | "retorno">("confirmacao");

  function abrirMsg(tipo: "confirmacao" | "lembrete" | "retorno") {
    setTipoMsg(tipo);
    setMensagem(
      tipo === "confirmacao" ? templateConfirmacao(nome, data, hora, proc, clinica)
      : tipo === "lembrete"  ? templateLembrete(nome, data, hora, proc, clinica)
      :                        templateRetorno(nome, clinica)
    );
    setMsgOpen(true);
  }

  function registrar(tipo: TipoContato, res: ResultadoContato, msg?: string) {
    addRegistro({
      pacienteNome:      nome,
      pacienteTelefone:  tel,
      agendamentoId:     apt.id,
      agendamentoData:   apt.date,
      agendamentoHora:   hora,
      profissionalNome:  prof,
      procedimento:      proc,
      tipo,
      resultado: res,
      observacao: obs || undefined,
      mensagemEnviada: msg,
      criadoPor: "Usuário",
    });
    toast.success("Contato registrado");
    onRegistrado();
    onClose();
  }

  function enviarWhatsApp(msg: string) {
    window.open(`${telParaWhatsApp(tel)}?text=${encodeURIComponent(msg)}`, "_blank");
    registrar("whatsapp", "enviado", msg);
  }

  if (!tel) {
    return (
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-center space-y-2">
        <AlertTriangle className="h-8 w-8 text-orange-400 mx-auto" />
        <p className="text-sm font-semibold text-orange-800">Sem telefone cadastrado</p>
        <p className="text-xs text-orange-600">Edite o paciente para adicionar um número.</p>
        <button onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700 underline">Fechar</button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-white font-bold text-base">{nome}</p>
          <p className="text-slate-300 text-sm font-mono mt-0.5">{fmtTelefone(tel)}</p>
          {apt.date && (
            <p className="text-slate-400 text-xs mt-1">{proc} · {data} às {hora}</p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Ações rápidas */}
        <div className="grid grid-cols-2 gap-3">
          {/* Ligar */}
          <a
            href={telParaLigacao(tel)}
            onClick={() => { setTimeout(() => setResultado("atendeu"), 300); }}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 text-sm transition shadow-sm"
          >
            <Phone className="h-4 w-4" /> Ligar agora
          </a>

          {/* WhatsApp direto */}
          <a
            href={`${telParaWhatsApp(tel)}`}
            target="_blank" rel="noreferrer"
            onClick={() => registrar("whatsapp", "enviado")}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold py-3 text-sm transition shadow-sm"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </a>

          {/* Confirmar consulta via WA */}
          <button
            onClick={() => abrirMsg("confirmacao")}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-400 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold py-3 text-sm transition"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar consulta
          </button>

          {/* Lembrete via WA */}
          <button
            onClick={() => abrirMsg("lembrete")}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold py-3 text-sm transition"
          >
            <Bell className="h-4 w-4" /> Enviar lembrete
          </button>
        </div>

        {/* Resultado da ligação */}
        <div>
          <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Registrar resultado da ligação</p>
          <div className="flex flex-wrap gap-2">
            {([
              ["atendeu",      "✅ Atendeu"],
              ["confirmado",   "📅 Confirmou"],
              ["nao_atendeu",  "📵 Não atendeu"],
              ["ocupado",      "📞 Ocupado"],
              ["caixa_postal", "📬 Caixa postal"],
              ["recusou",      "❌ Recusou"],
              ["remarcou",     "🔄 Remarcou"],
            ] as [ResultadoContato, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setResultado(v)}
                className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${resultado === v ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                {l}
              </button>
            ))}
          </div>
          {resultado && (
            <div className="mt-3 space-y-2">
              <Input
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Observação (opcional)…"
                className="text-sm h-9"
              />
              <button
                onClick={() => registrar("ligacao", resultado)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2.5 transition"
              >
                <History className="h-4 w-4" /> Salvar registro
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal mensagem WhatsApp */}
      {msgOpen && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-green-600 px-5 py-3 flex items-center justify-between">
              <p className="text-white font-bold text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                {tipoMsg === "confirmacao" ? "Confirmação de consulta" : tipoMsg === "lembrete" ? "Lembrete de consulta" : "Convite de retorno"}
              </p>
              <button onClick={() => setMsgOpen(false)} className="text-green-200 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Preview estilo WhatsApp */}
              <div className="bg-[#e5ddd5] rounded-xl p-3 max-h-52 overflow-y-auto">
                <div className="bg-white rounded-lg p-3 text-sm text-slate-700 shadow-sm whitespace-pre-wrap leading-relaxed max-w-[85%]">
                  {mensagem}
                </div>
              </div>
              {/* Editar mensagem */}
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                rows={5}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Edite a mensagem…"
              />
              <div className="flex gap-2">
                <button onClick={() => setMsgOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition">
                  Cancelar
                </button>
                <button
                  onClick={() => { setMsgOpen(false); enviarWhatsApp(mensagem); }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition"
                >
                  <Send className="h-4 w-4" /> Enviar pelo WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function TelefoniaPage() {
  const [log, setLog]               = useState<RegistroContato[]>(() => loadLog());
  const [aptSelecionado, setApt]    = useState<any | null>(null);
  const [painelOpen, setPainelOpen] = useState(false);
  const [q, setQ]                   = useState("");
  const [filtroTipo, setFiltroTipo] = useState<TipoContato | "todos">("todos");
  const [aba, setAba]               = useState<"pendentes" | "historico" | "contato_rapido">("pendentes");

  // Carrega agendamentos para a fila de pendências
  // (antes lia de um espelho em localStorage que só era escrito como
  // efeito colateral de abrir a Agenda/Faturamento — por isso ficava
  // vazio/desatualizado. Agora busca direto da fonte real, o Supabase.)
  const [apts, setApts] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  useEffect(() => {
    listarAgendamentos().then(setApts);
    listarProfissionais().then(setProfs);
  }, []);

  function reloadLog() { setLog(loadLog()); }

  // Fila de pendentes: agendamentos dos próximos 3 dias ainda sem confirmação
  // (data local, não toISOString/UTC — em UTC-3 o toISOString já vira o dia
  // seguinte a partir das 21h no horário do Brasil, fazendo a fila de hoje
  // sumir mais cedo do que deveria)
  function dataLocalYMD(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dia}`;
  }
  const hoje = dataLocalYMD(new Date());
  const em3 = new Date(); em3.setDate(em3.getDate() + 3);
  const em3str = dataLocalYMD(em3);

  const pendentes = useMemo(() => {
    const jaContatados = new Set(log.map(r => r.agendamentoId).filter(Boolean));
    return apts
      .filter(a => {
        if (!a.date || !a.phone) return false;
        if (a.date < hoje || a.date > em3str) return false;
        if (!["agendado", "confirmado"].includes(a.status)) return false;
        return true;
      })
      .map(a => {
        const prof = profs.find(p => p.id === a.professionalId);
        const jaContatado = jaContatados.has(a.id);
        return { ...a, professionalName: prof?.name ?? "—", jaContatado };
      })
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  }, [apts, log, profs]);

  // Pacientes para busca na aba "Contato rápido"
  // (mesma correção: buscava de um espelho em localStorage que nunca era
  // populado desde a migração dos pacientes para o Supabase — a busca
  // sempre voltava vazia)
  const [pacientes, setPacientes] = useState<any[]>(() => patientStore.getAll());
  useEffect(() => {
    setPacientes(patientStore.getAll());
    if (!patientStore.isLoaded()) {
      patientStore.refresh().then(setPacientes);
    }
    return patientStore.subscribe(() => setPacientes(patientStore.getAll()));
  }, []);

  const pacientesFiltrados = useMemo(() => {
    if (!q.trim() || q.length < 2) return [];
    const qn = q.toLowerCase();
    return pacientes
      .filter((p: any) => p.name?.toLowerCase().includes(qn) || p.phone?.includes(q))
      .slice(0, 8);
  }, [q, pacientes]);

  // Histórico filtrado
  const logFiltrado = useMemo(() => log.filter(r => {
    if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
    if (q.trim() && !r.pacienteNome.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [log, filtroTipo, q]);

  // Stats rápidos
  const stats = useMemo(() => ({
    hoje:       log.filter(r => dataLocalYMD(new Date(r.criadoEm)) === hoje).length,
    pendentes:  pendentes.filter(a => !a.jaContatado).length,
    confirmados: log.filter(r => r.resultado === "confirmado" && dataLocalYMD(new Date(r.criadoEm)) === hoje).length,
    semTel:     apts.filter(a => a.date >= hoje && a.date <= em3str && !a.phone && ["agendado","confirmado"].includes(a.status)).length,
  }), [log, pendentes, apts, hoje]);

  function abrirPainel(apt: any) {
    setApt(apt);
    setPainelOpen(true);
  }

  const abas = [
    { id: "pendentes",      l: "Pendentes de contato", cnt: stats.pendentes },
    { id: "contato_rapido", l: "Contato rápido",        cnt: null },
    { id: "historico",      l: "Histórico",              cnt: log.length },
  ] as const;

  return (
    <div className="p-5 space-y-5 max-w-[1200px] mx-auto relative">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Phone className="h-5 w-5 text-white" />
            </div>
            Telefonia
          </h1>
          <p className="text-sm text-slate-400 mt-1">Central de contatos, confirmações e lembretes</p>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: "Contatos hoje",   v: stats.hoje,       icon: PhoneCall,    c: "from-blue-500 to-blue-600" },
          { l: "Pendentes",       v: stats.pendentes,  icon: Clock,        c: stats.pendentes > 0 ? "from-amber-500 to-orange-500" : "from-slate-400 to-slate-500" },
          { l: "Confirmados hoje",v: stats.confirmados,icon: CheckCircle2, c: "from-emerald-500 to-green-600" },
          { l: "Sem telefone",    v: stats.semTel,     icon: AlertTriangle,c: stats.semTel > 0 ? "from-red-500 to-red-600" : "from-slate-400 to-slate-500" },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.l} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{k.l}</p>
                  <p className="text-3xl font-black text-slate-800 mt-1">{k.v}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.c} flex items-center justify-center shadow-sm`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Abas ─────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${aba === a.id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {a.l}
            {a.cnt != null && a.cnt > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${aba === a.id ? (a.id === "pendentes" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600") : "bg-slate-200 text-slate-500"}`}>
                {a.cnt}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ABA: PENDENTES                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      {aba === "pendentes" && (
        <div className="space-y-3">
          {pendentes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
              <CheckCircle2 className="h-12 w-12 opacity-20 text-emerald-500" />
              <p className="font-semibold text-slate-500">Nenhum contato pendente</p>
              <p className="text-sm">Todos os agendamentos dos próximos 3 dias já foram contatados.</p>
            </div>
          ) : pendentes.map(apt => {
            const isHoje = apt.date === hoje;
            return (
              <div key={apt.id} className={`rounded-2xl border p-4 transition ${apt.jaContatado ? "border-emerald-200 bg-emerald-50/50" : isHoje ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${apt.jaContatado ? "bg-emerald-500" : "bg-gradient-to-br from-cyan-500 to-blue-600"}`}>
                    {apt.jaContatado ? <CheckCircle2 className="h-5 w-5" /> : apt.patientName?.[0] ?? "P"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800 text-sm">{apt.patientName}</p>
                      {apt.jaContatado && <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Contatado</span>}
                      {isHoje && !apt.jaContatado && <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">Hoje</span>}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${apt.status === "confirmado" ? "bg-cyan-100 text-cyan-700 border-cyan-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>{apt.status}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {apt.procedure} · {fmtDate(apt.date)} às {apt.start} · {apt.professionalName}
                    </p>
                    {apt.phone && (
                      <p className="text-xs font-mono text-slate-600 mt-0.5">{fmtTelefone(apt.phone)}</p>
                    )}
                  </div>

                  {/* Botões de ação */}
                  {apt.phone ? (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <a href={telParaLigacao(apt.phone)}
                        onClick={() => {
                          addRegistro({ pacienteNome: apt.patientName, pacienteTelefone: apt.phone, agendamentoId: apt.id, agendamentoData: apt.date, agendamentoHora: apt.start, profissionalNome: apt.professionalName, procedimento: apt.procedure, tipo: "ligacao", resultado: "atendeu", criadoPor: "Usuário" });
                          reloadLog();
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-sm">
                        <Phone className="h-3.5 w-3.5" /> Ligar
                      </a>
                      <a href={`${telParaWhatsApp(apt.phone)}?text=${encodeURIComponent(templateConfirmacao(apt.patientName, fmtDate(apt.date), apt.start, apt.procedure ?? "Consulta", nomeClinica()))}`}
                        target="_blank" rel="noreferrer"
                        onClick={() => {
                          addRegistro({ pacienteNome: apt.patientName, pacienteTelefone: apt.phone, agendamentoId: apt.id, agendamentoData: apt.date, agendamentoHora: apt.start, profissionalNome: apt.professionalName, procedimento: apt.procedure, tipo: "confirmacao", resultado: "enviado", mensagemEnviada: templateConfirmacao(apt.patientName, fmtDate(apt.date), apt.start, apt.procedure ?? "Consulta", nomeClinica()), criadoPor: "Usuário" });
                          reloadLog();
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition shadow-sm">
                        <MessageCircle className="h-3.5 w-3.5" /> Confirmar via WA
                      </a>
                      <button onClick={() => abrirPainel(apt)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-semibold transition">
                        <PhoneCall className="h-3.5 w-3.5" /> Mais opções
                      </button>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                      <AlertTriangle className="h-3.5 w-3.5" /> Sem telefone
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ABA: CONTATO RÁPIDO                                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      {aba === "contato_rapido" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Buscar paciente por nome ou telefone…"
              className="pl-9 h-11 text-sm"
              autoFocus
            />
          </div>

          {q.length >= 2 && pacientesFiltrados.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <User className="h-10 w-10 mx-auto opacity-20 mb-2" />
              <p className="text-sm">Nenhum paciente encontrado</p>
            </div>
          )}

          {pacientesFiltrados.map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {p.name?.[0] ?? "P"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{p.phone ? fmtTelefone(p.phone) : "Sem telefone"}</p>
                </div>
                {p.phone && (
                  <div className="flex gap-2 shrink-0">
                    <a href={telParaLigacao(p.phone)}
                      onClick={() => { addRegistro({ pacienteNome: p.name, pacienteTelefone: p.phone, tipo: "ligacao", resultado: "atendeu", criadoPor: "Usuário" }); reloadLog(); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition">
                      <Phone className="h-3.5 w-3.5" /> Ligar
                    </a>
                    <a href={telParaWhatsApp(p.phone)} target="_blank" rel="noreferrer"
                      onClick={() => { addRegistro({ pacienteNome: p.name, pacienteTelefone: p.phone, tipo: "whatsapp", resultado: "enviado", criadoPor: "Usuário" }); reloadLog(); }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                    <button onClick={() => abrirPainel({ ...p, patientName: p.name, phone: p.phone })}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-semibold transition">
                      <Smile className="h-3.5 w-3.5" /> Templates
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {q.length < 2 && (
            <div className="flex flex-col items-center gap-3 py-14 text-slate-400 text-center">
              <Search className="h-10 w-10 opacity-20" />
              <p className="text-sm">Digite o nome ou telefone do paciente para buscar</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ABA: HISTÓRICO                                            */}
      {/* ══════════════════════════════════════════════════════════ */}
      {aba === "historico" && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Filtrar por paciente…" className="pl-9 h-9 text-sm" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {(["todos", "ligacao", "whatsapp", "confirmacao", "lembrete"] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition capitalize ${filtroTipo === t ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"}`}>
                  {t === "todos" ? "Todos" : TIPO_INFO[t]?.label ?? t}
                </button>
              ))}
            </div>
          </div>

          {logFiltrado.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
              <History className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      {["Data/hora", "Paciente", "Telefone", "Tipo", "Resultado", "Consulta", "Observação"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logFiltrado.map(r => {
                      const tipo = TIPO_INFO[r.tipo];
                      const res  = RESULTADO_INFO[r.resultado];
                      const TipoIcon = tipo?.icon ?? Phone;
                      const ResIcon  = res?.icon ?? Phone;
                      return (
                        <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                          <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">{fmtDateTime(r.criadoEm)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{r.pacienteNome}</td>
                          <td className="px-4 py-3 font-mono text-slate-500 text-xs whitespace-nowrap">{fmtTelefone(r.pacienteTelefone)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tipo?.cor}`}>
                              <TipoIcon className="h-3 w-3" />{tipo?.label ?? r.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${res?.cor}`}>
                              <ResIcon className="h-3 w-3" />{res?.label ?? r.resultado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                            {r.agendamentoData ? `${fmtDate(r.agendamentoData)} ${r.agendamentoHora ?? ""}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs max-w-[200px] truncate">
                            {r.observacao ?? r.mensagemEnviada?.slice(0, 60) ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Painel de contato flutuante ─────────────────────────── */}
      {painelOpen && aptSelecionado && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4" onClick={() => setPainelOpen(false)}>
          <div className="w-full max-w-md relative" onClick={e => e.stopPropagation()}>
            <PainelContato
              apt={aptSelecionado}
              onClose={() => setPainelOpen(false)}
              onRegistrado={reloadLog}
            />
          </div>
        </div>
      )}
    </div>
  );
}
