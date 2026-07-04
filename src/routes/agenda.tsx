'use client';
import { createFileRoute } from "@tanstack/react-router";
import { billingStorage, initBillingStorage, billingStorageEstaCarregado } from "@/lib/financial/billing-storage";
import { eAdmin, registrarAuditoria } from "@/lib/auth";
import {
  listarProfissionais,
  listarAgendamentos,
  criarAgendamento,
  atualizarAgendamento,
  excluirAgendamento,
  listarBloqueios,
  criarBloqueio,
  excluirBloqueio,
  listarListaEspera,
  criarListaEspera,
  atualizarListaEspera,
  excluirListaEspera,
  inserirLogAgenda,
  listarLogsAgenda,
  excluirRepasseItem,
  inserirFinalizadoConsultorio,
} from "@/lib/agendaData";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { patientStore } from "@/lib/patient-store";
import { sendConfirmacaoAgendamento, runDailyReminders } from "@/lib/whatsapp";
import {
  ChevronLeft, ChevronRight, Filter, Plus, CheckCircle2,
  PlayCircle, Flag, Wallet, XCircle, Receipt, Phone,
  History, Clock, UserX, Calendar, Search, DollarSign,
  UserCheck, Sparkles, Microscope, SendHorizonal, Layers, AlertTriangle,
  TrendingUp, Activity, RefreshCw, Stethoscope,
  ListOrdered, Lock, BellRing, CheckCheck, Trash2, Coffee, Menu, Pencil,
  ChevronsUpDown, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  professionals, statusColors, statusLabels,
  type Appointment, type AppointmentStatus,
} from "@/lib/mock-data";
import { CadastroCompletoDialog } from "@/components/CadastroCompletoDialog";
import { type Patient } from "@/lib/mock-data";

export const Route = createFileRoute("/agenda")({
  component: AgendaPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i);
const CELL_HEIGHT = 80; // px por hora — 80px/hora = 40px por 30min = ~1.33px por min
const PAYMENT_METHODS = ["PIX", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Boleto"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ─── Cache global de convênios (Supabase) ──────────────────────────────────
// A cache em si (auto-invalidada em criarConvenio/atualizarConvenio/excluirConvenio)
// vive em @/lib/agendaData, e é compartilhada por toda a aplicação — assim,
// convênios criados/editados/excluídos na tela de Convênios aparecem
// imediatamente aqui na Agenda, sem precisar recarregar a página.
let _conveniosCacheLocal: any[] | null = null;
async function getConveniosCache() {
  try {
    const { listarConvenios } = await import("@/lib/agendaData");
    _conveniosCacheLocal = await listarConvenios();
  } catch { _conveniosCacheLocal = _conveniosCacheLocal ?? []; }
  return _conveniosCacheLocal ?? [];
}
// Reexportado para compatibilidade com quem já importa daqui.
export { invalidateConveniosCache } from "@/lib/agendaData";

function isConvenioFaturavel(insuranceName: string): boolean {
  if (!insuranceName || insuranceName === "Particular") return false;
  try {
    const list = _conveniosCacheLocal ?? JSON.parse(localStorage.getItem("nexaclinic_convenios_v2") ?? "[]");
    const conv = list.find((c: any) => c.name?.toLowerCase().trim() === insuranceName?.toLowerCase().trim());
    return conv?.faturar === true;
  } catch { return false; }
}

function getConvenioId(insuranceName: string): string | null {
  try {
    const list = _conveniosCacheLocal ?? JSON.parse(localStorage.getItem("nexaclinic_convenios_v2") ?? "[]");
    return list.find((c: any) => c.name?.toLowerCase().trim() === insuranceName?.toLowerCase().trim())?.id ?? null;
  } catch { return null; }
}

// Hook: retorna lista de convênios completos do Supabase
// Sempre busca (a função listarConvenios já usa cache em memória internamente,
// e essa cache é invalidada automaticamente ao criar/editar/excluir convênio),
// então reabrir o diálogo sempre reflete o cadastro mais atual.
function useConveniosFull(open?: boolean): any[] {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (!open && open !== undefined) return;
    getConveniosCache().then(setList).catch(() => setList([]));
  }, [open]);
  return list;
}

function useConveniosNomes(open?: boolean): string[] {
  const full = useConveniosFull(open);
  return useMemo(() => {
    if (!full.length) {
      // fallback enquanto carrega
      try {
        const saved = localStorage.getItem("nexaclinic_convenios_v2");
        if (saved) {
          const list = JSON.parse(saved) as { name: string; status?: string }[];
          return ["Particular", ...list.filter((c) => c.status !== "inativo" && c.name?.toLowerCase() !== "particular").map((c) => c.name)];
        }
      } catch { /* */ }
      return ["Particular"];
    }
    return ["Particular", ...full.filter((c) => c.status !== "inativo" && c.name?.toLowerCase().trim() !== "particular").map((c) => c.name)];
  }, [full]);
}

// Hook: retorna lista de procedimentos ativos do Supabase
function useProcedimentosList(open?: boolean): { name: string; tussCode?: string }[] {
  const [list, setList] = useState<{ name: string; tussCode?: string }[]>([]);
  useEffect(() => {
    if (!open && open !== undefined) return;
    import("@/lib/agendaData").then(({ listarProcedimentos }) =>
      listarProcedimentos().then((procs: any[]) =>
        setList(procs.filter((p) => p.status === "ativo").map((p) => ({ name: p.name, tussCode: p.tussCode })))
      )
    ).catch(() => {
      // fallback localStorage
      try {
        const saved = JSON.parse(localStorage.getItem("nexaclinic_procedimentos") ?? "[]");
        setList(saved.filter((p: any) => p.status === "ativo").map((p: any) => ({ name: p.name })));
      } catch { setList([]); }
    });
  }, [open]);
  return list;
}

// Hook: retorna os procedimentos ativos completos (com valorParticular,
// convenioValores, valorPorProfissional, tussCode etc.) — usado para
// calcular o valor automático do procedimento (useProcedureValue).
function useProcedimentosFull(open?: boolean): any[] {
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (!open && open !== undefined) return;
    import("@/lib/agendaData").then(({ listarProcedimentos }) =>
      listarProcedimentos().then((procs: any[]) =>
        setList(procs.filter((p) => p.status === "ativo"))
      )
    ).catch(() => setList([]));
  }, [open]);
  return list;
}

export interface AppointmentExt extends Appointment {
  date: string;
  phone?: string;
  cpf?: string;           // CPF do paciente — salvo no agendamento e sincronizado com o cadastro
  procedureValue?: number;
  amount?: number;
  amountOriginal?: number;  // valor sem desconto
  discount?: number;        // percentual de desconto aplicado
  paymentMethod?: string;
  cardBrand?: string;       // bandeira do cartão (Visa, Master, etc.)
  authCode?: string;        // número de autorização do cartão
  taxaMDR?: number;         // % MDR aplicada
  valorLiquido?: number;    // valor após MDR
  valorTaxaMDR?: number;    // R$ da taxa MDR
  numeroParcelas?: number;  // 1 = à vista
  datasParcelas?: string[]; // datas previstas de recebimento
  mdrLancado?: boolean;     // taxa MDR já lançada em Contas a Pagar
  paid?: boolean;
  // Pagamento dividido em 2 formas (ex: parte Dinheiro + parte Cartão).
  // Usado pelo financeiro para lançar cada parte no destino correto
  // (Caixa Central / Conta Bancária / Maquininha) em vez de um único destino.
  paymentSplit?: { method: string; amount: number; cardBrand?: string; authCode?: string }[];

  cancelReason?: string;
  cancelledAt?: string;
}

export interface LogEntry {
  id: string;
  appointmentId: string;
  action: string;
  detail: string;
  at: string;
  user: string;
}

// ─── Storage ──────────────────────────────────────────────────────────────
const APT_KEY = "nexaclinic_appointments_v3";
// const LOG_KEY = "nexaclinic_agenda_log";  // migrado para Supabase
// const WAITLIST_KEY = "nexaclinic_waitlist";  // migrado para Supabase
// const BLOCKS_KEY   = "nexaclinic_agenda_blocks";  // migrado para Supabase

// ─── Lista de espera ──────────────────────────────────────────────────────
export interface WaitlistEntry {
  id: string;
  patientName: string;
  phone: string;
  professionalId: string;
  procedure: string;
  insurance: string;
  preferredDate?: string;       // data preferida (opcional)
  preferredStart?: string;      // horário preferido (opcional)
  notes: string;
  createdAt: string;
  notified?: boolean;           // true quando o sistema detectou uma vaga e notificou
}

// Waitlist agora vem do Supabase — funções legacy removidas

// ─── Bloqueios de horário ────────────────────────────────────────────────
export interface AgendaBlock {
  id: string;
  professionalId: string;
  date: string;
  start: string;
  end: string;
  reason: string;  // "Almoço" | "Reunião" | "Folga" | "Outros"
  createdAt: string;
}

const BLOCK_REASONS = ["Almoço", "Reunião", "Folga parcial", "Feriado interno", "Outros"] as const;

// Bloqueios agora vêm do Supabase — funções legacy removidas

function loadAppointments(): AppointmentExt[] {
  try { return JSON.parse(localStorage.getItem(APT_KEY) ?? "[]"); } catch { return []; }
}
function saveAppointments(list: AppointmentExt[]) {
  localStorage.setItem(APT_KEY, JSON.stringify(list));
}
function addLog(appointmentId: string, action: string, detail: string) {
  // Persiste log no Supabase (fire-and-forget)
  inserirLogAgenda({ appointmentId, action, detail, userName: "Sistema" }).catch(console.error);
}

// ─── Helpers de data ──────────────────────────────────────────────────────
function startOfDay(d: Date): Date {
  const c = new Date(d); c.setHours(0, 0, 0, 0); return c;
}
function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number); return h * 60 + m;
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtBRL(val?: number) {
  if (val == null) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Classifica o tipo do agendamento pela procedure (module scope — usado no componente e nos dialogs)
function getAppointmentType(procedure: string): "consulta" | "retorno" | "procedimento" | "telemedicina" | "outro" {
  const p = (procedure ?? "").toLowerCase();
  if (p.includes("retorno") || p.includes("revisão") || p.includes("revisao")) return "retorno";
  if (p.includes("tele") || p.includes("online") || p.includes("remot")) return "telemedicina";
  if (p.includes("consulta")) return "consulta";
  const procedimentos = ["eletro", "eco", "raio", "ultras", "endos", "exame", "cirurg", "curativ", "injeç", "vacin", "coleta"];
  if (procedimentos.some((kw) => p.includes(kw))) return "procedimento";
  return "outro";
}

// Retorna array dos 7 dias da semana a partir de segunda-feira da semana de `d`
function getWeekDays(d: Date): Date[] {
  const base = new Date(d);
  const dow = base.getDay(); // 0=Dom..6=Sab
  const diff = dow === 0 ? -6 : 1 - dow; // segunda-feira
  base.setDate(base.getDate() + diff);
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(base);
    day.setDate(base.getDate() + i);
    return day;
  });
}

// Retorna todos os dias do mês de `d` (completos de Dom a Sab para o grid)
function getMonthGrid(d: Date): Date[] {
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Preenche até a segunda anterior se necessário
  const startDow = firstDay.getDay(); // 0=Dom
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startDow);
  // Preenche até o sábado seguinte
  const endDow = lastDay.getDay();
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - endDow));
  const days: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ─── Hook: busca de paciente com autocomplete ─────────────────────────────
function usePatientSearch(query: string) {
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    // Tenta carregar do patientStore (async) ou localStorage como fallback
    const load = async () => {
      try {
        const result = await patientStore.getAll();
        if (Array.isArray(result)) setPatients(result);
      } catch {
        try {
          const saved = localStorage.getItem("nexaclinic_patients_v3");
          setPatients(saved ? JSON.parse(saved) : []);
        } catch { setPatients([]); }
      }
    };
    load();
  }, [query]);

  return useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return patients
      .filter((p: any) => p.name?.toLowerCase().includes(q) || p.phone?.includes(q))
      .slice(0, 6);
  }, [query, patients]);
}

// ─── Helper compartilhado: busca valor de um procedimento na tabela de um convênio ──
function buscarValorNaTabela(
  found: { id: string; name: string; tussCode?: string },
  conv: { tabelas?: any[] },
  normalize: (s: string) => string,
  planoId?: string                 // ← filtra tabela pelo plano selecionado
): string | null {
  if (!conv?.tabelas) return null;
  let tabelasAtivas = conv.tabelas.filter((t: any) => t.ativo !== false);
  // Se um plano foi selecionado, prioriza tabelas daquele plano; se não tiver, usa todas
  if (planoId) {
    const doPlano = tabelasAtivas.filter((t: any) => t.planoId === planoId);
    if (doPlano.length > 0) tabelasAtivas = doPlano;
  }
  for (const tabela of tabelasAtivas) {
    const itens: any[] = tabela.itens ?? [];
    const byId   = itens.find((i: any) => i.procedimentoId === found.id);
    if (byId) return String(byId.valor);
    if (found.tussCode?.trim()) {
      const byTUSS = itens.find((i: any) =>
        i.codigoTUSS?.trim() && i.codigoTUSS.trim() === found.tussCode!.trim()
      );
      if (byTUSS) return String(byTUSS.valor);
    }
    const byName = itens.find((i: any) =>
      normalize(i.procedimento ?? "") === normalize(found.name)
    );
    if (byName) return String(byName.valor);
  }
  return null;
}

// ─── Hook: valor padrão do procedimento ──────────────────────────────────
// Ordem de prioridade (conforme cadastro do Procedimento):
//   1. Campo do procedimento para o convênio selecionado:
//      - Particular → "Valor Particular"
//      - Convênio   → "Valores por convênio" (convenioValores[])
//   2. Se vazio → "Valor particular por profissional" (valorPorProfissional[])
//      — vale tanto para Particular quanto para convênio, pelo profissional
//        que está atendendo.
//   3. Se ainda vazio → tabela de preços cadastrada no próprio Convênio
//      (Convênios → planos/tabelas), filtrada pelo plano se selecionado.
//   4. Último fallback → Valor Particular do cadastro.
function useProcedureValue(procedureName: string, insurance: string, professionalId: string | undefined, planoId: string | undefined, procsFull: any[], conveniosFull: any[]): string {
  return useMemo(() => {
    if (!procedureName) return "";
    try {
      const normalize = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const isPositivo = (v: any) => v != null && v !== "" && parseFloat(String(v).replace(",", ".")) > 0;

      const procs = procsFull ?? [];
      const found = procs.find((p: any) => normalize(p.name) === normalize(procedureName));
      if (!found) return "";

      const convenios = conveniosFull ?? [];
      const isParticular = insurance === "Particular";

      // 1. Campo do procedimento para o convênio/particular selecionado
      const campoConvenio = isParticular
        ? found.valorParticular
        : found.convenioValores?.find((c: any) => normalize(c.convenio) === normalize(insurance))?.valor;
      if (isPositivo(campoConvenio)) return String(campoConvenio);

      // 2. Valor particular por profissional (vale para Particular e Convênio)
      if (professionalId && found.valorPorProfissional?.length) {
        const vprof = found.valorPorProfissional.find((v: any) => v.professionalId === professionalId);
        if (isPositivo(vprof?.valor)) return String(vprof.valor);
      }

      // 3. Tabela de preços cadastrada no Convênio (ou no Convênio "Particular")
      const nomeConvBusca = isParticular ? "particular" : normalize(insurance);
      const conv = convenios.find((c: any) => normalize(c.name) === nomeConvBusca);
      const daTabela = buscarValorNaTabela(found, conv ?? {}, normalize, isParticular ? undefined : planoId);
      if (daTabela) return daTabela;

      // 4. Último fallback: Valor Particular do cadastro
      return found.valorParticular ?? "";
    } catch { return ""; }
  }, [procedureName, insurance, professionalId, planoId, procsFull, conveniosFull]);
}

// ─── Componente principal ─────────────────────────────────────────────────
function AgendaPage() {
  const [view, setView] = useState<"day" | "week" | "month">("day");

  // Popula o cache em memória de lotes/faturas (Supabase) usado por
  // "Enviar p/ Faturamento" e pelo cancelamento de agendamento já faturado.
  // Sem isso, o cache começava sempre vazio nesta tela (só era populado
  // quando a pessoa visitava a tela de Faturamento antes).
  useEffect(() => {
    if (!billingStorageEstaCarregado()) {
      initBillingStorage().catch((e) => console.error("Erro ao inicializar billing storage:", e));
    }
  }, []);

  // Carrega profissionais do Supabase (com fallback para o cache local
  // enquanto a busca não termina, para evitar tela vazia no primeiro render)
  const [allProfessionals, setAllProfessionals] = useState(() => {
    try {
      const saved = localStorage.getItem("nexaclinic_professionals");
      return saved ? JSON.parse(saved) : professionals;
    } catch { return professionals; }
  });

  useEffect(() => {
    let ativo = true;
    listarProfissionais().then((lista) => {
      if (!ativo) return;
      if (lista && lista.length > 0) {
        setAllProfessionals(lista);
        try {
          localStorage.setItem("nexaclinic_professionals", JSON.stringify(lista));
        } catch { /* ignora erro de cache */ }
      }
    });
    return () => { ativo = false; };
  }, []);

  const [profIds, setProfIds] = useState<string[]>(
    allProfessionals.filter((p: any) => p.active).map((p: any) => p.id)
  );

  // ✅ CORREÇÃO 1: sincroniza profIds quando allProfessionals carrega do Supabase.
  // Sem isso, profIds fica com IDs antigos do mock ("p1", "p2") enquanto
  // allProfessionals já contém UUIDs reais, causando o erro
  // "professionalId inválido recebido em createAppointment".
  useEffect(() => {
    const idsAtivos = allProfessionals
      .filter((p: any) => p.active)
      .map((p: any) => p.id);
    if (idsAtivos.length > 0) {
      setProfIds((prev) => {
        const prevSet = new Set(prev);
        const changed = idsAtivos.length !== prev.length || idsAtivos.some((id) => !prevSet.has(id));
        return changed ? idsAtivos : prev;
      });
    }
  }, [allProfessionals]);

  // aba da agenda: "profissionais" | "exames"
  const [agendaTab, setAgendaTab] = useState<"profissionais" | "exames">("profissionais");
  const [filterEspecialidade, setFilterEspecialidade] = useState<string>("all");
  const [filterProfSearch, setFilterProfSearch] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<Date>(() => startOfDay(new Date()));
  const [appointments, setAppointments] = useState<AppointmentExt[]>(() => loadAppointments());
  const appointmentsPrevRef = useRef<AppointmentExt[] | null>(null);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  useEffect(() => {
    let ativo = true;
    // Carregar lista de espera e bloqueios do Supabase
    listarListaEspera().then((lista) => setWaitlist(lista as WaitlistEntry[])).catch(console.error);
    listarBloqueios().then((lista) => setBlocks(lista as AgendaBlock[])).catch(console.error);

    listarAgendamentos().then((lista: AppointmentExt[]) => {
      if (!ativo) return;
      // Marca esta carga como "vinda do servidor": sincroniza a referência junto
      // com o estado para que o efeito de diff abaixo não interprete agendamentos
      // ainda não sincronizados (ou momentaneamente fora da resposta) como
      // exclusões e não tente apagá-los do Supabase.
      appointmentsPrevRef.current = lista;
      setAppointments(lista);
      try { saveAppointments(lista); } catch { /* ignora erro de cache */ }
    });
    return () => { ativo = false; };
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [canceladosOpen, setCanceladosOpen] = useState(false);
  const [operacoesOpen, setOperacoesOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ professionalId: string; start: string; date?: string } | null>(null);
  const [profInfoOpen, setProfInfoOpen] = useState(false);
  const [profInfoTarget, setProfInfoTarget] = useState<any>(null);

  // ── Lista de espera ────────────────────────────────────────────────────
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistNewOpen, setWaitlistNewOpen] = useState(false);

  // ── Bloqueios de horário ───────────────────────────────────────────────
  const [blocks, setBlocks] = useState<AgendaBlock[]>([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDefaults, setBlockDefaults] = useState<{ professionalId?: string; date?: string; start?: string } | null>(null);

  // ── Confirmação manual de presença ─────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editApt, setEditApt] = useState<AppointmentExt | null>(null);

  // ── Cadastro completo ao iniciar atendimento ──────────────────────────────
  const [cadastroOpen, setCadastroOpen] = useState(false);
  const [pacienteCadastro, setPacienteCadastro] = useState<Patient | null>(null);
  const [pendingIniciarId, setPendingIniciarId] = useState<string | null>(null);

  function handleIniciarAtendimento(appointmentId: string, patientName: string) {
    // Busca paciente no store
    let found = patientStore.getAll().find(
      (p) => p.name.toLowerCase() === patientName.toLowerCase()
    ) ?? null;
    // Se não encontrou, usa dados do próprio agendamento para pré-preencher
    if (!found) {
      const apt = appointments.find((a) => a.id === appointmentId);
      if (apt) {
        found = {
          id: "",
          name: apt.patientName,
          cpf: (apt as any).cpf ?? "",
          phone: apt.phone ?? "",
          insurance: apt.insurance ?? "Particular",
          birth: "",
          email: "",
          lastVisit: apt.date,
          status: "ativo",
        } as any;
      }
    } else if (found && !(found.cpf)) {
      // Paciente existe mas sem CPF — tenta pegar do agendamento
      const apt = appointments.find((a) => a.id === appointmentId);
      if (apt && (apt as any).cpf) {
        found = { ...found, cpf: (apt as any).cpf };
      }
    }
    setPacienteCadastro(found);
    setPendingIniciarId(appointmentId);
    setCadastroOpen(true);
  }

  function onCadastroSalvoOuPulado() {
    if (pendingIniciarId) {
      updateStatus(pendingIniciarId, "em_atendimento", "Em atendimento");
      setPendingIniciarId(null);
    }
    setCadastroOpen(false);
  }

  useEffect(() => {
    saveAppointments(appointments); // cache local (usado por outras telas/relatórios)

    const prev = appointmentsPrevRef.current;
    appointmentsPrevRef.current = appointments;
    if (prev === null) return; // primeira carga: não há o que sincronizar ainda

    const prevById = new Map(prev.map((a) => [a.id, a]));
    const currIds = new Set(appointments.map((a) => a.id));

    appointments.forEach((apt) => {
      if (!UUID_RE.test(apt.id)) {
        // Agendamento antigo (criado antes da migração) com id em formato
        // incompatível com o Supabase — ignorado na sincronização.
        return;
      }
      const before = prevById.get(apt.id);
      if (!before) {
        criarAgendamento(apt).catch((e) => console.error("Falha ao criar agendamento no Supabase:", e));
      } else if (JSON.stringify(before) !== JSON.stringify(apt)) {
        atualizarAgendamento(apt.id, apt).catch((e) => console.error("Falha ao atualizar agendamento no Supabase:", e));
      }
    });

    prev.forEach((before) => {
      if (UUID_RE.test(before.id) && !currIds.has(before.id)) {
        excluirAgendamento(before.id).catch((e) => console.error("Falha ao excluir agendamento no Supabase:", e));
      }
    });
  }, [appointments]);
  // Waitlist e bloqueios agora são persistidos via Supabase em cada operação CRUD

  // ── Auto-notificação de vaga: verifica lista de espera quando um agendamento é cancelado ──
  function checkWaitlistForSlot(cancelledApt: AppointmentExt) {
    const candidates = waitlist.filter(
      (w) =>
        !w.notified &&
        w.professionalId === cancelledApt.professionalId &&
        (!w.preferredDate || w.preferredDate === cancelledApt.date) &&
        (!w.preferredStart || w.preferredStart === cancelledApt.start)
    );
    if (candidates.length === 0) return;
    const first = candidates[0];
    // Marca como notificado
    setWaitlist((prev) =>
      prev.map((w) => (w.id === first.id ? { ...w, notified: true } : w))
    );
    const prof = allProfessionals.find((p: any) => p.id === cancelledApt.professionalId);
    toast.success(`🔔 Vaga disponível para lista de espera!`, {
      description: `${first.patientName} • ${cancelledApt.date} às ${cancelledApt.start}${prof ? " — " + prof.name : ""}`,
      duration: 8000,
    });
  }

  // Separa profissionais de salas de exame
  const todosProfs  = useMemo(() => allProfessionals.filter((p: any) => (p.tipo ?? "profissional") === "profissional"), [allProfessionals]);
  const todasSalas  = useMemo(() => allProfessionals.filter((p: any) => p.tipo === "exame"), [allProfessionals]);

  const currentKey = toDateKey(currentDate);

  // ─── Verifica se profissional atende em determinada data ─────────────────
  function isProfAvailableOnDate(prof: any, dateStr: string): boolean {
    const agendaTipo = prof.agendaTipo ?? "permanente";
    if (agendaTipo === "especifica") {
      // datas específicas: precisa constar na lista
      const datas: string[] = prof.datasEspecificas ?? [];
      return datas.includes(dateStr);
    }
    // permanente: verifica dia da semana (0=Dom, 1=Seg ... 6=Sáb)
    const dias: number[] = prof.diasSemana ?? [0, 1, 2, 3, 4, 5, 6];
    if (dias.length === 0) return false; // nenhum dia configurado
    const [y, m, d] = dateStr.split("-").map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    return dias.includes(dow);
  }

  // ─── Filtragem central: especialidade + busca ────────────────────────────
  // Uma única função de filtro usada tanto nos chips quanto nas colunas da grade.
  function matchesFilter(p: any): boolean {
    const matchEsp =
      filterEspecialidade === "all" ||
      (p.specialty ?? "").toLowerCase() === filterEspecialidade.toLowerCase();
    const q = filterProfSearch.trim().toLowerCase();
    const matchSearch =
      q === "" ||
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.specialty ?? "").toLowerCase().includes(q);
    return matchEsp && matchSearch;
  }

  // Colunas visíveis na grade — respeita: ativo, aba, dia da semana E filtros
  const visibleProfs = useMemo(() => {
    return allProfessionals.filter((p: any) => {
      if (!profIds.includes(p.id)) return false;
      if (agendaTab === "exames" ? p.tipo !== "exame" : (p.tipo ?? "profissional") !== "profissional") return false;
      // Na view DIA: oculta profissional que não atende nesta data
      if (view === "day" && !isProfAvailableOnDate(p, currentKey)) return false;
      // Filtra por especialidade e busca
      if (!matchesFilter(p)) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profIds, allProfessionals, agendaTab, view, currentKey, filterEspecialidade, filterProfSearch]);

  // Chips do filtro — mesma lógica sem o filtro de dia (para o usuário ver todos)
  const profsParaFiltro = useMemo(() => {
    const base = agendaTab === "profissionais" ? todosProfs : todasSalas;
    return base.filter((p: any) => matchesFilter(p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaTab, todosProfs, todasSalas, filterEspecialidade, filterProfSearch]);

  // Lista de especialidades únicas para o select
  const especialidades = useMemo(() => {
    const set = new Set<string>();
    todosProfs.forEach((p: any) => { if (p.specialty) set.add(p.specialty); });
    return Array.from(set).sort();
  }, [todosProfs]);

  const dayAppointments = appointments.filter(
    (a) => a.date === currentKey && a.status !== "cancelado" && a.status !== "faltou"
  );
  const selected = appointments.find((a) => a.id === selectedId) ?? null;
  const today = startOfDay(new Date());
  const isToday = toDateKey(currentDate) === toDateKey(today);

  // ─── Labels por view ──────────────────────────────────────────────────
  const dateLabel = useMemo(() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("pt-BR", {
        weekday: "long", day: "2-digit", month: "long", year: "numeric",
      });
    }
    if (view === "week") {
      const days = getWeekDays(currentDate);
      const first = days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      const last = days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
      return `Semana: ${first} – ${last}`;
    }
    // month
    return currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }, [view, currentDate]);

  const cancelados = appointments.filter((a) => a.status === "cancelado").length;
  const faltaram = appointments.filter((a) => a.status === "faltou").length;

  // ─── Navegação adaptada à view ────────────────────────────────────────
  function navigate(dir: -1 | 1) {
    setCurrentDate((p) => {
      const n = new Date(p);
      if (view === "day") n.setDate(n.getDate() + dir);
      else if (view === "week") n.setDate(n.getDate() + dir * 7);
      else n.setMonth(n.getMonth() + dir);
      return startOfDay(n);
    });
    setSelectedId(null);
  }

  const updateStatus = useCallback(
    (id: string, status: AppointmentStatus, msg: string, extra?: Partial<AppointmentExt>) => {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status, ...extra } : a));
      addLog(id, status, msg);
      toast.success(msg);
    },
    []
  );

  function doCancel(reason: string) {
    if (!selected) return;
    const apt = selected;
    // ACCOUNTS_KEY / APTS_KEY removidos — usar financialStorage / Supabase diretamente
    const log: string[] = [];

    try {
      // ── 1. Estornar pagamento particular (paid=true) ──────────────────────
      if (apt.paid && apt.amount != null) {
        // Lança conta de estorno via Supabase (financialStorage)
        const estorno = {
          id: "",
          type: "pagar" as const,
          description: `Estorno — ${apt.patientName} (cancelamento)`,
          value: apt.amount ?? 0,
          dueDate: new Date().toISOString().split("T")[0],
          category: "Estorno / Cancelamento",
          status: "pendente" as const,
          notes: `Estorno automático. Motivo: ${reason || "não informado"}. Valor: R$ ${apt.amount?.toFixed(2)}. Método: ${apt.paymentMethod}.`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        financialStorage.saveAccount(estorno).catch(console.error);
        log.push(`💰 Pagamento de ${new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(apt.amount)} estornado`);
      }

      // ── 2. Remover do lote de faturamento (convênio) ──────────────────────
      if ((apt as any).sentToBilling || (apt as any).emLote) {
        const lotes = billingStorage.getLotes();
        let removido = false;
        for (const lote of lotes) {
          if (lote.status === "pago" || lote.status === "enviado") {
            // Lote fechado: não pode remover, apenas sinaliza
            const item = lote.items?.find((i: any) => i.appointmentId === apt.id);
            if (item) {
              log.push(`⚠️ Guia no lote ${lote.numero} (${lote.status}) — requer estorno manual junto ao convênio`);
            }
            continue;
          }
          const item = lote.items?.find((i: any) => i.appointmentId === apt.id);
          if (item) {
            billingStorage.removeItemFromLote(lote.id, item.id);
            removido = true;
            log.push(`🧾 Removido do lote ${lote.numero} (${lote.convenioName})`);
            break;
          }
        }
        // Reverte flags no agendamento
        const apts: any[] = JSON.parse(localStorage.getItem(APTS_KEY) ?? "[]");
        const idx = apts.findIndex((a: any) => a.id === apt.id);
        if (idx !== -1) {
          apts[idx] = { ...apts[idx], sentToBilling: false, emLote: false };
          localStorage.setItem(APTS_KEY, JSON.stringify(apts));
        }
      }

      // ── 3. Reverter repasse médico gerado ─────────────────────────────────
      try {
        // Remove repasse do Supabase (repasse_itens) pelo appointmentId
        excluirRepasseItem(apt.id).then(() => {
          // fire-and-forget — não bloqueia o cancelamento
        }).catch(console.error);
        log.push(`👨‍⚕️ Repasse médico cancelado`);
      } catch { /* silencioso */ }

    } catch (err) {
      console.error("Erro no cancelamento seguro:", err);
    }

    // ── 4. Cancela o agendamento em si ────────────────────────────────────
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apt.id
          ? { ...a, status: "cancelado", cancelReason: reason, cancelledAt: new Date().toISOString(), paid: false }
          : a
      )
    );
    addLog(apt.id, "cancelado", [reason || "Cancelado sem motivo informado", ...log].join(" | "));
    registrarAuditoria("CANCELAR_AGENDAMENTO",
      `${apt.patientName ?? ""} cancelado — motivo: ${reason || "não informado"} | ${log.join(" | ")}`
    );

    const descricao = log.length > 0
      ? `Ações realizadas: ${log.join(" · ")}`
      : undefined;
    toast.success("Agendamento cancelado", { description: descricao, duration: log.length > 0 ? 6000 : 3000 });
    setCancelOpen(false);
    setSelectedId(null);
    setTimeout(() => checkWaitlistForSlot(apt), 300);
  }

  // ─── Enviar agendamento direto ao Lote do mês (sem Controle de Guias) ────────
  async function handleEnviarFaturamento(apt: AppointmentExt) {
    try {
      // 0. Garante que o cache de lotes (Supabase) já foi carregado —
      // evita criar um lote duplicado caso o usuário clique antes do
      // carregamento inicial (useEffect) terminar.
      if (!billingStorageEstaCarregado()) {
        await initBillingStorage();
      }

      // 1. Localiza o convênio cadastrado (Supabase — cache compartilhado,
      // sempre atualizado com criações/edições/exclusões feitas em Convênios)
      const { listarConvenios } = await import("@/lib/agendaData");
      const convsCad: any[] = await listarConvenios();
      const conv = convsCad.find((c: any) =>
        c.name?.toLowerCase().trim() === apt.insurance?.toLowerCase().trim()
      );
      if (!conv) { toast.error("Convênio não encontrado no cadastro.", { description: `"${apt.insurance}" não está cadastrado em Convênios.` }); return; }
      if (conv.faturar !== true) {
        toast.error("Este convênio não está marcado para faturamento.", {
          description: `Ative a opção "Faturar" no cadastro do convênio "${conv.name}" para poder enviá-lo automaticamente para um lote.`,
        });
        return;
      }

      // 2. Competência = mês do agendamento (YYYY-MM)
      const competencia = (apt.date ?? new Date().toISOString().slice(0, 10)).slice(0, 7);

      // 3. Busca lote aberto do mesmo convênio e competência, ou cria novo
      const lotes = billingStorage.getLotes();
      const idsNoLote = new Set<string>();
      let lote = lotes.find((l: any) =>
        l.convenioId === conv.id &&
        l.competencia === competencia &&
        l.status === "aberto"
      );

      if (!lote) {
        lote = billingStorage.createLote({
          convenioId:   conv.id,
          convenioName: conv.name,
          ansCode:      conv.ansCode ?? "",
          competencia,
          numero:       "",
          status:       "aberto",
          observacoes:  `Lote automático — ${conv.name} — ${competencia}`,
        });
      } else {
        // Monta set dos appointmentIds já no lote para evitar duplicidade
        (lote.items ?? []).forEach((i: any) => { if (i.appointmentId) idsNoLote.add(i.appointmentId); });
      }

      // 4. Bloqueia duplicidade
      if (idsNoLote.has(apt.id)) {
        toast.warning("Este atendimento já está no lote deste mês.", {
          description: `Lote ${lote.numero} — ${conv.name} ${competencia}`,
        });
        return;
      }

      // 5. Busca profissional
      const profs: any[] = JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]");
      const prof = profs.find((p: any) => p.id === apt.professionalId);

      // 6. Adiciona item ao lote
      billingStorage.addItemToLote(lote.id, {
        appointmentId:     apt.id,
        patientName:       apt.patientName ?? "",
        patientCpf:        (apt as any).cpf ?? undefined,
        carteirinha:       (apt as any).carteirinha ?? undefined,
        convenioName:      conv.name,
        procedure:         apt.procedure ?? "",
        procedureCode:     (apt as any).procedureCode ?? undefined,
        date:              apt.date,
        quantity:          1,
        unitValue:         apt.procedureValue ?? 0,
        totalValue:        apt.procedureValue ?? 0,
        professionalName:  prof?.name ?? "",
        professionalCrm:   prof?.crm ?? undefined,
        authorizationCode: (apt as any).authorizationCode ?? undefined,
        status:            "incluido",
      });

      // 7. Marca sentToBilling no agendamento
      const APT_KEY = "nexaclinic_appointments_v3";
      const raw = localStorage.getItem(APT_KEY) ?? "[]";
      const apts = JSON.parse(raw) as AppointmentExt[];
      const idx = apts.findIndex((a) => a.id === apt.id);
      if (idx !== -1) {
        apts[idx] = { ...apts[idx], sentToBilling: true };
        localStorage.setItem(APT_KEY, JSON.stringify(apts));
      }
      setAppointments((prev) =>
        prev.map((a) => a.id === apt.id ? { ...a, sentToBilling: true } : a)
      );

      addLog(apt.id, "faturamento", `Adicionado ao Lote ${lote.numero} — ${conv.name} ${competencia}`);
      toast.success(`Adicionado ao Lote ${lote.numero}`, {
        description: `${apt.patientName} • ${conv.name} — ${competencia}`,
      });
    } catch (err) {
      console.error("Erro ao enviar para faturamento:", err);
      toast.error("Erro ao enviar para faturamento. Verifique o console.");
    }
  }

  function registerPayment(
    id: string, amount: number, method: string, discount: number, amountOriginal: number,
    cardBrand?: string, authCode?: string,
    taxaMDR?: number, numeroParcelas?: number, datasParcelas?: string[],
    paymentSplit?: { method: string; amount: number; cardBrand?: string; authCode?: string }[]
  ) {
    const isCard = method === "Cartão de crédito" || method === "Cartão de débito"
      || method.startsWith("Cartão de crédito ") || method.startsWith("Cartão de débito ");
    const valorTaxaMDR  = isCard && taxaMDR ? parseFloat((amount * taxaMDR / 100).toFixed(2)) : undefined;
    const valorLiquido  = isCard && taxaMDR ? parseFloat((amount - (valorTaxaMDR ?? 0)).toFixed(2)) : amount;

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id ? {
          ...a, status: "finalizado", paid: true, amount, amountOriginal, discount,
          paymentMethod: method,
          paymentSplit: paymentSplit || undefined,
          cardBrand: cardBrand || undefined,
          authCode: authCode || undefined,
          taxaMDR: taxaMDR || undefined,
          valorLiquido,
          valorTaxaMDR,
          numeroParcelas: numeroParcelas || 1,
          datasParcelas: datasParcelas || undefined,
          mdrLancado: false,
        } : a
      )
    );

    // Lança taxa MDR automaticamente em Contas a Pagar
    if (isCard && valorTaxaMDR && valorTaxaMDR > 0) {
      try {
        const apt = appointments.find(a => a.id === id);
        // Contas financeiras gerenciadas pelo financialStorage (Supabase)
        const accounts: any[] = []; // carregado via financialStorage quando necessário
        const hoje = new Date().toISOString().split("T")[0];
        const novaConta = {
          id: `mdr_${id}_${Date.now()}`,
          type: "pagar",
          description: `Taxa MDR ${cardBrand ?? ""} (${taxaMDR}%) — ${apt?.patientName ?? "Paciente"}`,
          value: valorTaxaMDR,
          dueDate: hoje,
          category: "Taxa Cartão / MDR",
          status: "pendente",
          paymentMethod: method,
          destino: "maquininha",
          origem: "manual",
          notes: `Gerado automaticamente. Atend: ${apt?.patientName}. Valor bruto: ${fmtBRL(amount)}. Taxa ${taxaMDR}% = ${fmtBRL(valorTaxaMDR)}`,
          mdrLancado: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        financialStorage.saveAccount(novaConta).catch(console.error);
      } catch { /* silencioso */ }
    }

    const descontoInfo   = discount > 0 ? ` (desconto ${discount}%)` : "";
    const autorizacaoInfo = authCode ? ` | Aut: ${authCode}` : "";
    const bandeiraInfo   = cardBrand ? ` ${cardBrand}` : "";
    const mdrInfo        = valorTaxaMDR ? ` | Taxa MDR: ${fmtBRL(valorTaxaMDR)} | Líquido: ${fmtBRL(valorLiquido)}` : "";
    const parcelaInfo    = numeroParcelas && numeroParcelas > 1 ? ` | ${numeroParcelas}x` : "";
    addLog(id, "pagamento", `${fmtBRL(amount)} via ${method}${bandeiraInfo}${parcelaInfo}${descontoInfo}${autorizacaoInfo}${mdrInfo}`);
    toast.success("Pagamento registrado", {
      description: `${fmtBRL(amount)} via ${method}${bandeiraInfo}${parcelaInfo}${descontoInfo}${mdrInfo ? " · MDR lançado" : ""}`,
    });
  }

  function updateAppointment(id: string, data: Partial<AppointmentExt>) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...data } : a))
    );
    addLog(id, "edição", "Dados do agendamento atualizados");
    toast.success("Agendamento atualizado");
  }

  function createAppointment(data: Omit<AppointmentExt, "id" | "status">) {
    const PROF_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!data.professionalId || !PROF_UUID_RE.test(data.professionalId)) {
      console.error("professionalId inválido recebido em createAppointment:", JSON.stringify(data.professionalId), "| allProfessionals carregados:", allProfessionals.length);
      toast.error("Selecione um profissional válido antes de agendar.", {
        description: "A lista de profissionais pode não ter carregado a tempo — tente novamente em alguns segundos.",
      });
      return;
    }
    const exists = appointments.find(
      (a) =>
        a.date === data.date &&
        a.start === data.start &&
        a.professionalId === data.professionalId &&
        a.status !== "cancelado" &&
        a.status !== "faltou"
    );
    if (exists) { toast.error("Horário já ocupado para este profissional"); return; }

    const id = crypto.randomUUID();
    const cpfValue: string = ((data as any).cpf ?? "").replace(/\D/g, "");
    const novo: AppointmentExt = { ...data, id, status: "agendado", cpf: cpfValue };
    setAppointments((prev) => [...prev, novo]);

    // Sincroniza CPF com o cadastro do paciente — sempre atualiza se informado
    patientStore.upsertByName(data.patientName, {
      phone: data.phone,
      insurance: data.insurance,
      cpf: cpfValue || undefined,
    }).then((pat) => {
      // Garante que o CPF foi salvo no cadastro do paciente
      if (cpfValue && pat) {
        const existingCpfDigits = (pat.cpf ?? "").replace(/\D/g, "");
        if (existingCpfDigits !== cpfValue) {
          patientStore.update(pat.id, { cpf: cpfValue });
        }
      }
    }).catch(() => {
      // fallback: salva CPF diretamente no localStorage
      if (cpfValue) {
        try {
          const patients = JSON.parse(localStorage.getItem("nexaclinic_patients_v3") ?? "[]");
          const idx = patients.findIndex((p: any) => p.name?.toLowerCase() === data.patientName.toLowerCase());
          if (idx !== -1) { patients[idx].cpf = cpfValue; localStorage.setItem("nexaclinic_patients_v3", JSON.stringify(patients)); }
        } catch { /* silencioso */ }
      }
    });

    addLog(id, "agendado", `Criado para ${data.patientName} às ${data.start} em ${data.date}`);
    toast.success("Agendamento criado", {
      description: `${data.patientName} • ${data.start}`,
    });

    // Envia mensagem de confirmação via WhatsApp (se a automação estiver ativada)
    if (data.phone && data.phone.replace(/\D/g, "")) {
      const profNome = allProfessionals.find((p: any) => p.id === data.professionalId)?.name ?? "";
      sendConfirmacaoAgendamento({
        appointmentId: id,
        patientName: data.patientName,
        phone: data.phone,
        procedimento: data.procedure ?? "Consulta",
        profissional: profNome,
        dateKey: data.date,
        hora: data.start,
        convenio: data.insurance,
      }).then((res) => {
        if (res.success) {
          toast.success("WhatsApp enviado", { description: "Paciente notificado do agendamento." });
        }
        // erros são apenas logados (não interrompem o fluxo)
      });
    }
  }

  const statusDot: Record<AppointmentStatus, string> = {
    agendado: "bg-info",
    confirmado: "bg-primary",
    aguardando: "bg-warning",
    em_atendimento: "bg-accent",
    finalizado: "bg-success",
    cancelado: "bg-destructive",
    faltou: "bg-muted-foreground",
  };

  // ─── Dados de semana/mês ──────────────────────────────────────────────
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate, view]);
  const monthGrid = useMemo(() => getMonthGrid(currentDate), [currentDate, view]);
  const todayKey = toDateKey(today);

  // ─── Horários dinâmicos por profissional ─────────────────────────────
  const minHour = useMemo(() => {
    if (visibleProfs.length === 0) return 8;
    return Math.min(...visibleProfs.map((p: any) =>
      p.scheduleStart ? parseInt(p.scheduleStart.split(":")[0]) : 8
    ));
  }, [visibleProfs]);

  const maxHour = useMemo(() => {
    if (visibleProfs.length === 0) return 20;
    return Math.max(...visibleProfs.map((p: any) =>
      p.scheduleEnd ? parseInt(p.scheduleEnd.split(":")[0]) : 20
    ));
  }, [visibleProfs]);

  const dynamicHours = useMemo(
    () => Array.from({ length: Math.max(maxHour - minHour, 1) }, (_, i) => minHour + i),
    [minHour, maxHour]
  );


  // ─── Helpers de estilo para os cards de agendamento ──────────────────────
  // Cor de borda por tipo (usada quando o status não sobrepõe)
  const typeColors: Record<string, string> = {
    consulta:     "#2563eb", // azul
    retorno:      "#7c3aed", // roxo
    procedimento: "#ea580c", // laranja
    telemedicina: "#0891b2", // ciano
    outro:        "#64748b", // cinza
  };

  function getCardStyle(a: AppointmentExt, profColor: string) {
    const type = getAppointmentType(a.procedure ?? "");
    const typeBorder = typeColors[type] ?? profColor;
    const styles: Record<string, { bg: string; border: string; text: string; badge: string }> = {
      confirmado:     { bg: "linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%)", border: "#16a34a", text: "#14532d", badge: "#bbf7d0" },
      aguardando:     { bg: "linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%)", border: "#d97706", text: "#78350f", badge: "#fde68a" },
      em_atendimento: { bg: "linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)", border: "#2563eb", text: "#1e3a8a", badge: "#bfdbfe" },
      finalizado:     { bg: "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)", border: "#64748b", text: "#334155", badge: "#e2e8f0" },
      agendado:       { bg: "linear-gradient(135deg,#fafaff 0%,#f0f0ff 100%)", border: typeBorder, text: "#1e1b4b", badge: "#e0e7ff" },
    };
    return styles[a.status] ?? styles.agendado;
  }

  return (
    <div className="space-y-4 -mt-4">
      {/* ── Cabeçalho ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif", letterSpacing: "-0.02em" }}
          >
            Agenda
          </h1>
          <p className="text-sm capitalize text-muted-foreground mt-0.5" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => { if (v) setView(v as typeof view); }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="day">Dia</ToggleGroupItem>
            <ToggleGroupItem value="week">Semana</ToggleGroupItem>
            <ToggleGroupItem value="month">Mês</ToggleGroupItem>
          </ToggleGroup>

          {/* Navegação */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setCurrentDate(startOfDay(new Date())); setSelectedId(null); }}
            disabled={isToday && view === "day"}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* ── Dropdown Operações ── */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setOperacoesOpen(o => !o)}
            >
              <Menu className="h-4 w-4" />
              Operações
              {(() => {
                const alertas =
                  (cancelados + faltaram) +
                  waitlist.filter((w) => !w.notified).length;
                return alertas > 0 ? (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-white">
                    {alertas}
                  </span>
                ) : null;
              })()}
            </Button>

            {operacoesOpen && (
              <>
                {/* Overlay invisível para fechar */}
                <div className="fixed inset-0 z-40" onClick={() => setOperacoesOpen(false)} />

                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Operações</p>
                  </div>
                  <div className="py-1">

                    {/* Lista de Espera */}
                    <button
                      onClick={() => { setOperacoesOpen(false); setWaitlistOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <span className="text-base">📋</span>
                      <span className="font-medium flex-1">Lista de Espera</span>
                      {waitlist.filter((w) => !w.notified).length > 0 && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          {waitlist.filter((w) => !w.notified).length}
                        </span>
                      )}
                    </button>

                    {/* Bloquear Horário */}
                    <button
                      onClick={() => { setOperacoesOpen(false); setBlockDefaults(null); setBlockOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <span className="text-base">🔒</span>
                      <span className="font-medium">Bloquear Horário</span>
                    </button>

                    <div className="my-1 mx-3 border-t border-slate-100" />

                    {/* Logs */}
                    <button
                      onClick={() => { setOperacoesOpen(false); setLogsOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <span className="text-base">📝</span>
                      <span className="font-medium flex-1">Logs</span>
                      {(cancelados + faltaram) > 0 && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                          {cancelados + faltaram}
                        </span>
                      )}
                    </button>

                    {/* Exportar */}
                    <button
                      onClick={() => {
                        setOperacoesOpen(false);
                        try {
                          const blob = new Blob(
                            [JSON.stringify(appointments, null, 2)],
                            { type: "application/json" }
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `agenda-${new Date().toISOString().split("T")[0]}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch { /* silencioso */ }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <span className="text-base">📤</span>
                      <span className="font-medium">Exportar Agenda</span>
                    </button>

                    {/* Imprimir */}
                    <button
                      onClick={() => { setOperacoesOpen(false); setPrintOpen(true); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition text-left"
                    >
                      <span className="text-base">🖨️</span>
                      <span className="font-medium">Imprimir Agenda</span>
                    </button>

                  </div>
                </div>
              </>
            )}
          </div>

          {/* Agendar */}
          <Button
            onClick={() => setNewOpen(true)}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Agendar
          </Button>
        </div>
      </div>

      {/* ── Painel de ocupação do dia ────────────────────────────────── */}
      {view === "day" && (() => {
        const totalAtivos = dayAppointments.length;
        if (totalAtivos === 0 && cancelados === 0) return null;

        const consultas   = dayAppointments.filter((a) => getAppointmentType(a.procedure ?? "") === "consulta").length;
        const retornos    = dayAppointments.filter((a) => getAppointmentType(a.procedure ?? "") === "retorno").length;
        const procedimentos = dayAppointments.filter((a) => getAppointmentType(a.procedure ?? "") === "procedimento").length;
        const telemed     = dayAppointments.filter((a) => getAppointmentType(a.procedure ?? "") === "telemedicina").length;
        const receitaPrevista = dayAppointments.reduce((sum, a) => sum + (a.procedureValue ?? 0), 0);

        return (
          <div
            className="rounded-2xl border border-border/40 px-4 py-3"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)/0.3) 100%)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {/* Total */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">Total</p>
                  <p className="text-base font-bold leading-tight" style={{ fontFamily: "'Sora', system-ui" }}>{totalAtivos}</p>
                </div>
              </div>

              <div className="h-8 w-px bg-border/60 hidden sm:block" />

              {/* Consultas */}
              {consultas > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-sm" />
                  <span className="text-xs font-semibold text-foreground/80">Consultas: <span className="text-foreground font-bold">{consultas}</span></span>
                </div>
              )}
              {/* Retornos */}
              {retornos > 0 && (
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3 text-violet-600" />
                  <span className="text-xs font-semibold text-foreground/80">Retornos: <span className="text-foreground font-bold">{retornos}</span></span>
                </div>
              )}
              {/* Procedimentos */}
              {procedimentos > 0 && (
                <div className="flex items-center gap-1.5">
                  <Stethoscope className="h-3 w-3 text-orange-500" />
                  <span className="text-xs font-semibold text-foreground/80">Procedimentos: <span className="text-foreground font-bold">{procedimentos}</span></span>
                </div>
              )}
              {/* Telemedicina */}
              {telemed > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-sm" />
                  <span className="text-xs font-semibold text-foreground/80">Telemedicina: <span className="text-foreground font-bold">{telemed}</span></span>
                </div>
              )}
              {/* Cancelados */}
              {cancelados > 0 && (
                <button
                  onClick={() => setCanceladosOpen(true)}
                  className="flex items-center gap-1.5 hover:opacity-75 transition"
                >
                  <UserX className="h-3 w-3 text-destructive" />
                  <span className="text-xs font-semibold text-destructive">Canceladas: {cancelados}</span>
                </button>
              )}

              {/* Receita prevista */}
              {receitaPrevista > 0 && (
                <>
                  <div className="h-8 w-px bg-border/60 hidden sm:block ml-auto" />
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">Receita Prevista</p>
                      <p className="text-sm font-bold text-green-600 leading-tight">{fmtBRL(receitaPrevista)}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Filtro de profissionais ──────────────────────────────────── */}
      <div
        className="rounded-2xl border border-border/50 p-3"
        style={{ background: "linear-gradient(135deg, hsl(var(--muted)/0.4) 0%, hsl(var(--background)) 100%)", boxShadow: "0 2px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-border overflow-hidden shrink-0 shadow-sm">
            <button
              onClick={() => setAgendaTab("profissionais")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition ${
                agendaTab === "profissionais"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Filter className="h-3.5 w-3.5" /> Profissionais
              {todosProfs.length > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold ${agendaTab === "profissionais" ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                  {todosProfs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setAgendaTab("exames")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition border-l border-border ${
                agendaTab === "exames"
                  ? "bg-violet-600 text-white"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Microscope className="h-3.5 w-3.5" /> Exames
              {todasSalas.length > 0 && (
                <span className={`ml-1 rounded-full px-1.5 py-0 text-[10px] font-bold ${agendaTab === "exames" ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                  {todasSalas.length}
                </span>
              )}
            </button>
          </div>
          {/* ── Busca por especialidade + nome ─────────────────── */}
          {agendaTab === "profissionais" && especialidades.length > 0 && (
            <Select value={filterEspecialidade} onValueChange={setFilterEspecialidade}>
              <SelectTrigger className="h-7 w-40 text-xs rounded-full border-border/60 bg-background">
                <SelectValue placeholder="Especialidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas especialidades</SelectItem>
                {especialidades.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar profissional..."
              value={filterProfSearch}
              onChange={(e) => setFilterProfSearch(e.target.value)}
              className="h-7 w-40 rounded-full border border-border/60 bg-background pl-7 pr-3 text-xs outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>
          {/* ── Chips de profissionais ─────────────────────────── */}
          {profsParaFiltro.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">
              {filterProfSearch || filterEspecialidade !== "all"
                ? "Nenhum profissional encontrado."
                : agendaTab === "exames"
                  ? "Nenhuma sala de exame cadastrada."
                  : "Nenhum profissional cadastrado."}
            </span>
          ) : (
            profsParaFiltro.map((p: any) => {
              const active = profIds.includes(p.id);
              const disponivel = view !== "day" || isProfAvailableOnDate(p, currentKey);
              return (
                <span
                  key={p.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border text-xs font-semibold transition-all ${
                    active && disponivel
                      ? "border-transparent text-white shadow-md"
                      : active && !disponivel
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : "border-border bg-background text-muted-foreground opacity-50"
                  }`}
                  style={active && disponivel ? { background: p.color, boxShadow: `0 2px 8px ${p.color}55` } : {}}
                >
                  {/* Botão de toggle (ícone/bolinha) */}
                  <button
                    onClick={() =>
                      setProfIds((prev) =>
                        active ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className="pl-3 py-1 flex items-center gap-1.5 focus:outline-none"
                    title={!disponivel ? `${p.name} não atende neste dia` : `Mostrar/ocultar ${p.name}`}
                  >
                    {p.tipo === "exame" ? <Microscope className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full" style={{ background: active && disponivel ? "rgba(255,255,255,0.7)" : p.color }} />}
                    {p.name.split(" ").slice(0, 3).join(" ")}
                    {!disponivel && <span className="ml-0.5 rounded-full bg-amber-200 text-amber-800 text-[9px] px-1.5 py-0">Folga</span>}
                  </button>
                  {/* Botão de info (horários) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setProfInfoTarget(p); setProfInfoOpen(true); }}
                    className={`pr-2.5 py-1 flex items-center focus:outline-none hover:opacity-70 transition-opacity`}
                    title={`Ver horários de ${p.name}`}
                  >
                    <Calendar className="h-3 w-3" />
                  </button>
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          VIEW: DIA
      ═══════════════════════════════════════════════════ */}
      {view === "day" && (
        <>
          <div
            className="overflow-hidden rounded-2xl border border-border/40"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)", background: "hsl(var(--card))" }}
          >
            <div className="overflow-x-auto">
              <div
                className="grid min-w-[640px]"
                style={{ gridTemplateColumns: `72px repeat(${visibleProfs.length}, minmax(180px, 1fr))` }}
              >
                {/* Header vazio */}
                <div className="border-b border-r border-border/40" style={{ background: "hsl(var(--muted)/0.2)" }} />

                {/* Headers dos profissionais */}
                {visibleProfs.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-b border-r border-border/40 p-3 last:border-r-0"
                    style={{ background: `linear-gradient(180deg, ${p.color}12 0%, transparent 100%)` }}
                  >

                    <Avatar className="h-10 w-10 ring-2 ring-white shadow-md" style={{ boxShadow: `0 0 0 2px ${p.color}55` }}>
                      {(p as any).avatar ? (
                        <AvatarImage src={(p as any).avatar} alt={p.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ background: `linear-gradient(135deg, ${p.color} 0%, ${p.color}cc 100%)` }}
                      >
                        {p.name.split(" ").slice(1, 3).map((n: string) => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>{p.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.specialty} • {p.crm}</p>
                    </div>
                  </div>
                ))}

                {/* Coluna de horários */}
                <div
                  className="relative border-r border-border/40"
                  style={{ height: `${dynamicHours.length * CELL_HEIGHT}px`, background: "hsl(var(--muted)/0.15)" }}
                >
                  {dynamicHours.map((h) => {
                    const top = (h - minHour) * CELL_HEIGHT;
                    return (
                      <div key={h} className="absolute w-full" style={{ top: `${top}px`, height: `${CELL_HEIGHT}px` }}>
                        {/* Hora cheia — faixa cinza + negrito */}
                        <div
                          className="flex items-center justify-end px-2 border-b border-border/40"
                          style={{
                            height: `${CELL_HEIGHT / 2}px`,
                            background: "hsl(var(--muted)/0.55)",
                          }}
                        >
                          <span
                            className="text-[12px] font-bold tabular-nums"
                            style={{ color: "hsl(var(--foreground)/0.75)", fontFamily: "'Sora', monospace, system-ui", letterSpacing: "0.03em" }}
                          >
                            {String(h).padStart(2, "0")}:00
                          </span>
                        </div>
                        {/* Meia hora — faixa mais suave */}
                        <div
                          className="flex items-center justify-end px-2 border-b border-dashed border-border/25"
                          style={{
                            height: `${CELL_HEIGHT / 2}px`,
                            background: "hsl(var(--muted)/0.25)",
                          }}
                        >
                          <span
                            className="text-[10px] tabular-nums font-medium"
                            style={{ color: "hsl(var(--foreground)/0.38)", fontFamily: "monospace" }}
                          >
                            :30
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mensagem quando nenhum profissional atende neste dia */}
                {visibleProfs.length === 0 && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                    <span className="text-4xl">📅</span>
                    <p className="text-sm font-medium">Nenhum profissional atende neste dia.</p>
                    <p className="text-xs">Verifique a grade de atendimento ou navegue para outra data.</p>
                  </div>
                )}
                {/* Colunas dos profissionais */}
                {visibleProfs.map((p: any) => {
                  const profStart = p.scheduleStart ? parseInt(p.scheduleStart.split(":")[0]) : minHour;
                  const profEnd = p.scheduleEnd ? parseInt(p.scheduleEnd.split(":")[0]) : maxHour;
                  const appts = dayAppointments.filter((a) => a.professionalId === p.id);
                  const totalGridHeight = dynamicHours.length * CELL_HEIGHT;
                  return (
                    <div
                      key={p.id}
                      className="relative border-r border-border/40 last:border-r-0"
                      style={{ height: `${totalGridHeight}px` }}
                    >

                      {/* Grade de fundo clicável */}
                      {dynamicHours.map((h) => {
  const isOut = h < profStart || h >= profEnd;
  const topHour = (h - minHour) * CELL_HEIGHT;

                        // Bloqueios que intersectam esta hora (inteiros ou parciais)
                        const blocksThisHour = blocks.filter((b) => {
                          if (b.professionalId !== p.id || b.date !== currentKey) return false;
                          const bStartMin = timeToMinutes(b.start);
                          const bEndMin   = timeToMinutes(b.end);
                          const hStartMin = h * 60;
                          const hEndMin   = (h + 1) * 60;
                          return bStartMin < hEndMin && bEndMin > hStartMin;
                        });

                        // Verifica se cada meia-hora está bloqueada
                        function isHalfBlocked(halfHour: 0 | 30) {
                          const slotStart = h * 60 + halfHour;
                          const slotEnd   = slotStart + 30;
                          return blocksThisHour.some((b) => {
                            const bS = timeToMinutes(b.start);
                            const bE = timeToMinutes(b.end);
                            return bS <= slotStart && bE >= slotEnd;
                          });
                        }
                        const blocked00 = isHalfBlocked(0);
                        const blocked30 = isHalfBlocked(30);

                        function BlockedSlot({ halfHour, label }: { halfHour: 0 | 30; label: string }) {
                          const block = blocksThisHour.find((b) => {
                            const bS = timeToMinutes(b.start);
                            const bE = timeToMinutes(b.end);
                            const s  = h * 60 + halfHour;
                            return bS <= s && bE >= s + 30;
                          });
                          const reasonIcon: Record<string, string> = {
                            "Almoço": "🍽", "Reunião": "📋", "Folga parcial": "🌴",
                            "Feriado interno": "🗓", "Outros": "🔒",
                          };
                          return (
                            <div
                              className="absolute w-full group"
                              style={{
                                top: halfHour === 0 ? 0 : `${CELL_HEIGHT / 2}px`,
                                height: `${CELL_HEIGHT / 2}px`,
                                background: "repeating-linear-gradient(-45deg, hsl(var(--muted)/0.65), hsl(var(--muted)/0.65) 4px, hsl(var(--muted)/0.35) 4px, hsl(var(--muted)/0.35) 8px)",
                                borderBottom: "1px dashed hsl(var(--muted-foreground)/0.25)",
                                zIndex: 8,
                                cursor: "default",
                              }}
                            >
                              <div className="flex items-center gap-1 h-full px-2 overflow-hidden">
                                <span className="text-[11px] leading-none shrink-0">{block ? (reasonIcon[block.reason] ?? "🔒") : "🔒"}</span>
                                <span className="text-[10px] font-semibold text-muted-foreground truncate leading-none">
                                  {block?.reason ?? "Bloqueado"} · {label}
                                </span>
                                {/* Botão desbloquear — aparece no hover */}
                                {block && (
                                  <button
                                    className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBlocks((prev) => prev.filter((x) => x.id !== block.id));
                                      toast.success("Bloqueio removido");
                                    }}
                                    title="Remover bloqueio"
                                  >
                                    <Trash2 className="h-2.5 w-2.5" /> Desbloquear
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                         return (
  <div key={h} className="absolute w-full" style={{ top: `${topHour}px`, height: `${CELL_HEIGHT}px`, display: "flex", flexDirection: "column" }}>
    {/* Slot HH:00 */}
    {blocked00 ? (
      <BlockedSlot halfHour={0} label={`${String(h).padStart(2,"0")}:00`} />
    ) : (
      <div
        className={`flex-1 w-full border-b border-border/20 transition-colors ${isOut ? "cursor-not-allowed" : "cursor-pointer hover:bg-primary/5"}`}
        style={{
          background: isOut ? "hsl(var(--muted)/0.4)" : undefined,
        }}
        title={isOut ? "Fora do horário" : `Agendar às ${String(h).padStart(2,"0")}:00`}
        onClick={() => {
          if (isOut) return;
          setNewDefaults({ professionalId: p.id, start: `${String(h).padStart(2,"0")}:00`, date: currentKey });
          setNewOpen(true);
        }}
      />
    )}

    {/* Slot HH:30 */}
    {blocked30 ? (
      <BlockedSlot halfHour={30} label={`${String(h).padStart(2,"0")}:30`} />
    ) : (
      <div
        className={`flex-1 w-full border-b border-dashed border-border/15 transition-colors ${isOut ? "cursor-not-allowed" : "cursor-pointer hover:bg-primary/5"}`}
        style={{
          background: isOut ? "hsl(var(--muted)/0.4)" : undefined,
        }}
        title={isOut ? "Fora do horário" : `Agendar às ${String(h).padStart(2,"0")}:30`}
        onClick={() => {
          if (isOut) return;
          setNewDefaults({ professionalId: p.id, start: `${String(h).padStart(2,"0")}:30`, date: currentKey });
          setNewOpen(true);
        }}
      />
    )}
  </div>
);
})}

                      {/* Cards de agendamento */}
                      {isToday && (() => {
                        const now = new Date();
                        const nowMin = now.getHours() * 60 + now.getMinutes();
                        const gridStartMin = minHour * 60;
                        const gridEndMin = maxHour * 60;
                        if (nowMin < gridStartMin || nowMin > gridEndMin) return null;
                        const topPx = ((nowMin - gridStartMin) / 60) * CELL_HEIGHT;
                        return (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none"
                            style={{ top: `${topPx}px` }}
                          >
                            <div className="relative flex items-center">
                              <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-md shrink-0 -ml-1.5 z-10" />
                              <div className="flex-1 h-[2px] bg-red-500 opacity-80" />
                            </div>
                          </div>
                        );
                      })()}
                      {/* Cards de agendamento */}
                      {appts.map((a) => {
                        const top = ((timeToMinutes(a.start) - minHour * 60) / 60) * CELL_HEIGHT;
                        const height = Math.max((a.durationMin / 60) * CELL_HEIGHT - 4, 24);
                        const isSmall = height < 46;
                        const isMedium = height >= 46 && height < 80;
                        const isLarge = height >= 80;
                        const cs = getCardStyle(a, p.color);
                        return (
                          <button
                            key={a.id}
                            onClick={() => setSelectedId(a.id)}
                            className="absolute left-1.5 right-1.5 rounded-xl text-left transition-all hover:-translate-y-px active:translate-y-0"
                            style={{
                              top: `${top + 2}px`,
                              height: `${height}px`,
                              zIndex: 10,
                              overflow: "hidden",
                              padding: isSmall ? "2px 8px" : "6px 10px",
                              background: cs.bg,
                              borderLeft: `3.5px solid ${cs.border}`,
                              boxShadow: `0 2px 8px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)`,
                            }}
                          >
                            {isSmall && (
                              <div className="flex items-center justify-between gap-1 w-full h-full">
                                <span
                                  className="truncate text-[10px] font-bold leading-none"
                                  style={{ color: cs.text, fontFamily: "'Sora', system-ui" }}
                                >
                                  {a.patientName}
                                </span>
                                <span
                                  className="shrink-0 text-[10px] font-semibold tabular-nums leading-none ml-1 px-1.5 rounded-full"
                                  style={{ color: cs.border, background: cs.badge, fontFamily: "monospace" }}
                                >
                                  {a.start}
                                </span>
                              </div>
                            )}
                            {isMedium && (
                              <>
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className="truncate text-[11px] font-bold leading-tight"
                                    style={{ color: cs.text, fontFamily: "'Sora', system-ui" }}
                                  >
                                    {a.patientName}
                                  </span>
                                  <span
                                    className="shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full"
                                    style={{ color: cs.border, background: cs.badge, fontFamily: "monospace" }}
                                  >
                                    {a.start}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5" style={{ color: cs.text + "99" }}>
                                  <Clock className="h-2.5 w-2.5 shrink-0" />
                                  <span className="text-[9px] font-medium">{a.durationMin} min</span>
                                  {a.procedureValue != null && (
                                    <span className="text-[9px] font-bold ml-1" style={{ color: "#16a34a" }}>
                                      {fmtBRL(a.procedureValue)}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                            {isLarge && (
                              <>
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className="truncate text-[12px] font-bold leading-tight"
                                    style={{ color: cs.text, fontFamily: "'Sora', system-ui" }}
                                  >
                                    {a.patientName}
                                  </span>
                                  <span
                                    className="shrink-0 text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                                    style={{ color: cs.border, background: cs.badge, fontFamily: "monospace", letterSpacing: "0.03em" }}
                                  >
                                    {a.start}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1" style={{ color: cs.text + "88" }}>
                                  <Clock className="h-2.5 w-2.5 shrink-0" />
                                  <span className="text-[10px] font-medium">{a.durationMin} min</span>
                                  {a.procedureValue != null && (
                                    <span className="text-[10px] font-bold ml-1" style={{ color: "#16a34a" }}>
                                      {fmtBRL(a.procedureValue)}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1.5">
                                  <span
                                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
                                    style={{ background: cs.badge, color: cs.border }}
                                  >
                                    {statusLabels[a.status]}
                                  </span>
                                </div>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {dayAppointments.length === 0 && visibleProfs.length > 0 && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ background: "linear-gradient(135deg, hsl(var(--muted)/0.6) 0%, hsl(var(--muted)/0.3) 100%)" }}
              >
                <Calendar className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/60">Nenhum agendamento para este dia</p>
                <p className="text-xs text-muted-foreground mt-1">Clique em qualquer horário na grade ou use o botão abaixo</p>
              </div>
              <Button size="sm" onClick={() => setNewOpen(true)} className="bg-gradient-primary text-primary-foreground gap-1.5">
                <Plus className="h-4 w-4" /> Criar agendamento
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <p className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Tipos</p>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Consulta</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> Retorno</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Procedimento</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Telemedicina</div>
            <div className="h-3 w-px bg-border/60 mx-1" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 self-center">Status</p>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> Confirmado</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm" /> Aguardando</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" /> Em atendimento</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-slate-400 shadow-sm" /> Finalizado</div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════
          VIEW: SEMANA
      ═══════════════════════════════════════════════════ */}
      {view === "week" && (
        <div
          className="overflow-hidden rounded-2xl border border-border/40"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", background: "hsl(var(--card))" }}
        >
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `72px repeat(7, 1fr)` }}>

              {/* Cabeçalho — coluna vazia + dias */}
              <div className="border-b border-r border-border/40 p-2" style={{ background: "hsl(var(--muted)/0.2)" }} />
              {weekDays.map((day) => {
                const key = toDateKey(day);
                const isTodayCell = key === todayKey;
                const dayCnt = appointments.filter((a) => a.date === key && a.status !== "cancelado" && a.status !== "faltou").length;
                const cancelCnt = appointments.filter((a) => a.date === key && a.status === "cancelado").length;
                // profissionais que têm consulta neste dia (para bolinhas coloridas)
                const dayProfs = Array.from(
                  new Set(
                    appointments
                      .filter((a) => a.date === key && a.status !== "cancelado" && a.status !== "faltou")
                      .map((a) => a.professionalId)
                  )
                ).map((id) => allProfessionals.find((p) => p.id === id)).filter(Boolean);

                return (
                  <div
                    key={key}
                    className={`border-b border-r border-border/40 p-2 text-center last:border-r-0 cursor-pointer hover:bg-primary/5 transition`}
                    style={{ background: isTodayCell ? "hsl(var(--primary)/0.08)" : "hsl(var(--muted)/0.15)" }}
                    onClick={() => { setCurrentDate(startOfDay(day)); setView("day"); }}
                  >
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isTodayCell ? "text-primary" : "text-muted-foreground"}`}
                       style={{ fontFamily: "'Sora', system-ui" }}>
                      {day.toLocaleDateString("pt-BR", { weekday: "short" })}
                    </p>
                    <p className={`text-xl font-bold leading-tight ${isTodayCell ? "text-primary" : ""}`}
                       style={{ fontFamily: "'Sora', system-ui" }}>
                      {day.getDate()}
                    </p>
                    {/* Indicador de ocupação */}
                    {dayCnt > 0 && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                          style={{ background: isTodayCell ? "hsl(var(--primary))" : "#64748b" }}
                        >
                          {dayCnt} {dayCnt === 1 ? "cons." : "cons."}
                        </span>
                        {/* Bolinhas dos profissionais */}
                        <div className="flex gap-0.5 flex-wrap justify-center mt-0.5">
                          {dayProfs.slice(0, 4).map((p: any) => (
                            <span
                              key={p.id}
                              className="h-2 w-2 rounded-full border border-white/60 shadow-sm"
                              style={{ background: p.color }}
                              title={p.name}
                            />
                          ))}
                          {dayProfs.length > 4 && (
                            <span className="text-[8px] text-muted-foreground font-bold">+{dayProfs.length - 4}</span>
                          )}
                        </div>
                        {cancelCnt > 0 && (
                          <span className="text-[9px] font-semibold text-destructive/70">{cancelCnt} cancel.</span>
                        )}
                      </div>
                    )}
                    {dayCnt === 0 && (
                      <p className="text-[9px] text-muted-foreground/40 mt-1">livre</p>
                    )}
                  </div>
                );
              })}

              {/* Grade de horas */}
              {HOURS.map((h) => (
                <>
                  <div
                    key={`h-${h}`}
                    className="border-b border-r border-border/30 px-2 py-1 text-right h-16 flex items-center justify-end"
                    style={{ background: "hsl(var(--muted)/0.5)" }}
                  >
                    <span
                      className="text-[12px] font-bold tabular-nums"
                      style={{ color: "hsl(var(--foreground)/0.75)", fontFamily: "'Sora', monospace, system-ui", letterSpacing: "0.03em" }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                  {weekDays.map((day) => {
                    const key = toDateKey(day);
                    const isTodayCell = key === todayKey;
                    const slotAppts = appointments.filter(
                      (a) => a.date === key && a.start === `${String(h).padStart(2, "0")}:00` && a.status !== "cancelado" && a.status !== "faltou"
                    );
                    // linha do horário atual
                    const showNowLine = isTodayCell && (() => {
                      const now = new Date();
                      return now.getHours() === h;
                    })();
                    const nowTopPct = (() => {
                      const now = new Date();
                      return Math.round((now.getMinutes() / 60) * 100);
                    })();

                    return (
                      <div
                        key={`${key}-${h}`}
                        className={`relative border-b border-r border-border/30 last:border-r-0 h-16 cursor-pointer transition hover:bg-primary/5 ${isTodayCell ? "bg-primary/[0.03]" : ""}`}
                        onClick={() => {
                          if (slotAppts.length === 0) {
                            setCurrentDate(startOfDay(day));
                            setView("day");
                            setNewDefaults({ professionalId: visibleProfs[0]?.id ?? allProfessionals[0]?.id ?? "", start: `${String(h).padStart(2, "0")}:00`, date: key });
                            setNewOpen(true);
                          }
                        }}
                      >
                        {/* Linha do horário atual */}
                        {showNowLine && (
                          <div
                            className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                            style={{ top: `${nowTopPct}%` }}
                          >
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-sm shrink-0 -ml-1" />
                            <div className="flex-1 h-[2px] bg-red-500 opacity-70" />
                          </div>
                        )}

                        {/* Cards de agendamento */}
                        {slotAppts.length === 1 && (() => {
                          const a = slotAppts[0];
                          const prof = allProfessionals.find((p) => p.id === a.professionalId);
                          const cs = getCardStyle(a, prof?.color ?? "#888");
                          return (
                            <button
                              key={a.id}
                              onClick={(e) => { e.stopPropagation(); setCurrentDate(startOfDay(day)); setSelectedId(a.id); }}
                              className="absolute inset-x-0.5 top-0.5 bottom-0.5 overflow-hidden rounded-lg text-left transition hover:shadow-md hover:brightness-95"
                              style={{
                                background: cs.bg,
                                borderLeft: `3px solid ${cs.border}`,
                                boxShadow: `0 1px 4px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)`,
                                padding: "3px 6px",
                              }}
                            >
                              <p className="truncate text-[10px] font-bold leading-tight" style={{ color: cs.text, fontFamily: "'Sora', system-ui" }}>
                                {a.patientName.split(" ")[0]}
                              </p>
                              <p className="text-[9px] font-semibold truncate" style={{ color: cs.text + "99" }}>
                                {a.procedure}
                              </p>
                              {/* bolinha do profissional */}
                              {prof && (
                                <span
                                  className="absolute top-1 right-1 h-2 w-2 rounded-full border border-white/60"
                                  style={{ background: prof.color }}
                                  title={prof.name}
                                />
                              )}
                            </button>
                          );
                        })()}

                        {/* Múltiplos agendamentos no mesmo horário */}
                        {slotAppts.length > 1 && (
                          <div className="absolute inset-x-0.5 top-0.5 bottom-0.5 flex gap-0.5">
                            {slotAppts.slice(0, 3).map((a) => {
                              const prof = allProfessionals.find((p) => p.id === a.professionalId);
                              return (
                                <button
                                  key={a.id}
                                  onClick={(e) => { e.stopPropagation(); setCurrentDate(startOfDay(day)); setSelectedId(a.id); }}
                                  className="flex-1 min-w-0 overflow-hidden rounded-md text-left transition hover:brightness-95"
                                  style={{
                                    background: prof?.color ?? "#888",
                                    borderTop: `2px solid ${prof?.color ?? "#888"}`,
                                    padding: "2px 4px",
                                    opacity: 0.9,
                                  }}
                                >
                                  <p className="truncate text-[9px] font-bold text-white leading-tight">{a.patientName.split(" ")[0]}</p>
                                </button>
                              );
                            })}
                            {slotAppts.length > 3 && (
                              <div className="flex items-center justify-center w-4 shrink-0">
                                <span className="text-[8px] font-bold text-muted-foreground">+{slotAppts.length - 3}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {slotAppts.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          VIEW: MÊS
      ═══════════════════════════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════
          VIEW: MÊS
      ═══════════════════════════════════════════════════ */}
      {view === "month" && (
        <div
          className="overflow-hidden rounded-2xl border border-border/40"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)", background: "hsl(var(--card))" }}
        >
          <div className="overflow-x-auto">
            {/* Cabeçalho dos dias da semana */}
            <div className="grid grid-cols-7 border-b border-border/40">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="border-r border-border/40 p-2 text-center last:border-r-0" style={{ background: "hsl(var(--muted)/0.2)" }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: "'Sora', system-ui" }}>{d}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthGrid.map((day) => {
                const key = toDateKey(day);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isTodayDay = key === todayKey;
                const dayAppts = appointments.filter((a) => a.date === key && a.status !== "cancelado" && a.status !== "faltou");
                const cancelados = appointments.filter((a) => a.date === key && a.status === "cancelado").length;

                // Profissionais com agenda nesse dia
                const dayProfIds = Array.from(new Set(dayAppts.map((a) => a.professionalId)));
                const dayProfs = dayProfIds.map((id) => allProfessionals.find((p) => p.id === id)).filter(Boolean);

                // Barra de ocupação: % do total máximo (max 10 agendamentos = barra cheia)
                const occupancyPct = Math.min((dayAppts.length / 10) * 100, 100);
                const occupancyColor =
                  dayAppts.length === 0 ? "transparent"
                  : dayAppts.length <= 3 ? "#22c55e"
                  : dayAppts.length <= 7 ? "#f59e0b"
                  : "#ef4444";

                return (
                  <div
                    key={key}
                    onClick={() => { setCurrentDate(startOfDay(day)); setView("day"); }}
                    className={`min-h-[90px] cursor-pointer border-b border-r border-border/30 p-1.5 transition last:border-r-0 hover:bg-primary/5 flex flex-col ${!isCurrentMonth ? "opacity-35" : ""}`}
                    style={isTodayDay ? { background: "hsl(var(--primary)/0.08)", boxShadow: "inset 0 0 0 1.5px hsl(var(--primary)/0.4)" } : {}}
                  >
                    {/* Linha topo: número + barra de ocupação */}
                    <div className="flex items-center justify-between mb-1 gap-1">
                      <p className={`text-xs font-bold leading-none ${isTodayDay ? "text-primary" : isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}
                         style={{ fontFamily: "'Sora', system-ui" }}>
                        {isTodayDay ? (
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white text-[11px]"
                            style={{ background: "hsl(var(--primary))" }}
                          >
                            {day.getDate()}
                          </span>
                        ) : day.getDate()}
                      </p>
                      {/* Barra de ocupação */}
                      {dayAppts.length > 0 && (
                        <div className="flex-1 h-1 rounded-full overflow-hidden bg-border/30">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${occupancyPct}%`, background: occupancyColor }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Cards de agendamento */}
                    <div className="space-y-0.5 flex-1">
                      {dayAppts.slice(0, 3).map((a) => {
                        const prof = allProfessionals.find((p) => p.id === a.professionalId);
                        const type = getAppointmentType(a.procedure ?? "");
                        const cs = getCardStyle(a, prof?.color ?? "#888");
                        return (
                          <div
                            key={a.id}
                            onClick={(e) => { e.stopPropagation(); setCurrentDate(startOfDay(day)); setSelectedId(a.id); }}
                            className="truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white flex items-center gap-1 hover:opacity-90 transition"
                            style={{
                              background: a.status === "cancelado" ? "#ef4444"
                                : a.status === "finalizado" ? "#64748b"
                                : prof?.color ?? "#888",
                              borderLeft: `2.5px solid ${cs.border}`,
                              paddingLeft: "4px",
                            }}
                            title={`${a.start} • ${a.patientName} • ${a.procedure}`}
                          >
                            <span className="truncate">{a.start} {a.patientName.split(" ")[0]}</span>
                          </div>
                        );
                      })}
                      {dayAppts.length > 3 && (
                        <p className="text-[10px] font-semibold text-muted-foreground pl-1 hover:text-foreground transition">
                          +{dayAppts.length - 3} mais
                        </p>
                      )}
                    </div>

                    {/* Rodapé: bolinhas dos profissionais + cancelados */}
                    {(dayProfs.length > 0 || cancelados > 0) && (
                      <div className="flex items-center justify-between mt-1 pt-0.5 border-t border-border/20">
                        <div className="flex gap-0.5">
                          {dayProfs.slice(0, 5).map((p: any) => (
                            <span
                              key={p.id}
                              className="h-1.5 w-1.5 rounded-full border border-white/40"
                              style={{ background: p.color }}
                              title={p.name}
                            />
                          ))}
                          {dayProfs.length > 5 && (
                            <span className="text-[8px] text-muted-foreground font-bold">+{dayProfs.length - 5}</span>
                          )}
                        </div>
                        {cancelados > 0 && (
                          <span className="text-[9px] font-bold text-destructive/70">{cancelados}✕</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal detalhe do agendamento ─────────────────────────────── */}
      <Dialog open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.patientName}</DialogTitle>
                <DialogDescription>Detalhes e ações do atendimento</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusColors[selected.status]}>
                    {statusLabels[selected.status]}
                  </Badge>
                  {/* Badge de confirmação de presença */}
                  {(selected as any).confirmadoPresenca ? (
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                      <CheckCheck className="mr-1 h-3 w-3" /> Presença confirmada
                    </Badge>
                  ) : (selected.status === "agendado" || selected.status === "confirmado") ? (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-400 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition"
                    >
                      <BellRing className="h-3 w-3" /> Confirmar presença
                    </button>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {selected.start} • {selected.durationMin} min • {selected.date}
                  </span>
                  {selected.paid && (
                    <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                      <Receipt className="mr-1 h-3 w-3" /> Pago
                    </Badge>
                  )}
                  {(selected as any).sentToBilling && !selected.paid && (
                    <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-700">
                      <Layers className="mr-1 h-3 w-3" /> Em faturamento
                    </Badge>
                  )}
                </div>

                {/* ── Barra de alerta: sem pagamento (não exibe para retornos) ── */}
                {!selected.paid && !(selected as any).sentToBilling &&
                  selected.status !== "cancelado" && selected.status !== "faltou" && selected.status !== "agendado" &&
                  getAppointmentType(selected.procedure ?? "") !== "retorno" && (
                  <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <p className="text-xs text-orange-700 font-medium">
                      {isConvenioFaturavel(selected.insurance)
                        ? "Pendente: enviar ao faturamento antes de finalizar"
                        : "Pendente: pagamento não registrado"}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Procedimento</p>
                    <p className="font-medium">{selected.procedure}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Convênio</p>
                    <p className="font-medium">{selected.insurance}</p>
                  </div>
                  {selected.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="font-medium flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {selected.phone}
                      </p>
                    </div>
                  )}
                  {selected.procedureValue != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor do procedimento</p>
                      <p className="font-medium text-success">{fmtBRL(selected.procedureValue)}</p>
                    </div>
                  )}
                  {selected.paid && selected.amount != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor pago</p>
                      <div className="space-y-0.5">
                        <p className="font-medium">{fmtBRL(selected.amount)} via {selected.paymentMethod}{selected.cardBrand ? ` (${selected.cardBrand})` : ""}{selected.numeroParcelas && selected.numeroParcelas > 1 ? ` — ${selected.numeroParcelas}x` : ""}{selected.discount && selected.discount > 0 ? ` — ${selected.discount}% desconto` : ""}{selected.authCode ? ` | Aut: ${selected.authCode}` : ""}</p>
                        {(selected as any).taxaMDR > 0 && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-orange-600">Taxa MDR {(selected as any).taxaMDR}% = − {fmtBRL((selected as any).valorTaxaMDR ?? 0)}</span>
                            <span className="text-emerald-600 font-semibold">Líquido: {fmtBRL((selected as any).valorLiquido ?? selected.amount)}</span>
                          </div>
                        )}
                        {(selected as any).numeroParcelas > 1 && (selected as any).datasParcelas?.length > 0 && (
                          <p className="text-xs text-slate-400">
                            1ª parcela prevista: {new Date((selected as any).datasParcelas[0] + "T12:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {selected.status !== "cancelado" && selected.status !== "faltou" && (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    {/* ── AVANÇAR status ── */}
                    {selected.status === "agendado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-primary/30 text-primary"
                        onClick={() => updateStatus(selected.id, "confirmado", "Consulta confirmada")}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                      </Button>
                    )}
                    {(selected.status === "agendado" || selected.status === "confirmado") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50"
                        onClick={() => { setEditApt(selected); setEditOpen(true); }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    )}
                    {(selected.status === "agendado" || selected.status === "confirmado") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => updateStatus(selected.id, "aguardando", "Paciente aguardando")}
                      >
                        <Clock className="h-3.5 w-3.5" /> Chegou
                      </Button>
                    )}
                    {selected.status === "aguardando" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-accent-foreground"
                        onClick={() => handleIniciarAtendimento(selected.id, selected.patientName)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" /> Iniciar
                      </Button>
                    )}

                    {/* ── VOLTAR status (desfazer) — bloqueado após pagamento/finalizado ── */}
                    {selected.status === "confirmado" && !selected.paid && !(selected as any).sentToBilling && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30"
                        onClick={() => updateStatus(selected.id, "agendado", "Status revertido para Agendado")}
                        title="Desfazer confirmação"
                      >
                        <RefreshCw className="h-3 w-3" /> Desfazer confirmação
                      </Button>
                    )}
                    {selected.status === "aguardando" && !selected.paid && !(selected as any).sentToBilling && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30"
                        onClick={() => updateStatus(selected.id, "confirmado", "Status revertido para Confirmado")}
                        title="Desfazer chegada"
                      >
                        <RefreshCw className="h-3 w-3" /> Desfazer chegada
                      </Button>
                    )}
                    {selected.status === "em_atendimento" && !selected.paid && !(selected as any).sentToBilling && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30"
                        onClick={() => updateStatus(selected.id, "aguardando", "Status revertido para Aguardando")}
                        title="Desfazer início de atendimento"
                      >
                        <RefreshCw className="h-3 w-3" /> Desfazer início
                      </Button>
                    )}

                    {selected.status === "em_atendimento" && (() => {
                      const convFaturavel = isConvenioFaturavel(selected.insurance);
                      const isRetorno = getAppointmentType(selected.procedure ?? "") === "retorno";
                      const quitado = selected.paid || (selected as any).sentToBilling || isRetorno;
                      return quitado ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-success"
                          onClick={() => updateStatus(selected.id, "finalizado", "Atendimento finalizado")}
                        >
                          <Flag className="h-3.5 w-3.5" /> Finalizar
                        </Button>
                      ) : (
                        <div className="w-full rounded-xl border border-orange-300 bg-orange-50 px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-semibold text-orange-800">
                                {convFaturavel ? "Envie ao faturamento antes de finalizar" : "Registre o pagamento antes de finalizar"}
                              </p>
                              <p className="text-[11px] text-orange-600 mt-0.5">
                                {convFaturavel
                                  ? "Este convênio exige envio ao lote de faturamento."
                                  : "Não é possível finalizar sem pagamento registrado."}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {!selected.paid && !isConvenioFaturavel(selected.insurance) &&
                      getAppointmentType(selected.procedure ?? "") !== "retorno" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-success"
                        onClick={() => setPayOpen(true)}
                      >
                        <Wallet className="h-3.5 w-3.5" /> Pagamento
                      </Button>
                    )}
                    {!selected.paid && isConvenioFaturavel(selected.insurance) && !(selected as any).sentToBilling && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-purple-600 border-purple-300 hover:bg-purple-50"
                        onClick={() => handleEnviarFaturamento(selected)}
                      >
                        <SendHorizonal className="h-3.5 w-3.5" /> Enviar p/ Faturamento
                      </Button>
                    )}
                    {(selected as any).sentToBilling && (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                        <Layers className="h-3 w-3" /> Enviado ao faturamento
                      </span>
                    )}
                    {selected.status !== "finalizado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-warning-foreground"
                        onClick={() => updateStatus(selected.id, "faltou", "Paciente faltou")}
                      >
                        <UserX className="h-3.5 w-3.5" /> Faltou
                      </Button>
                    )}
                    {eAdmin() && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5"
                      onClick={() => setCancelOpen(true)}
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        patientName={selected?.patientName ?? ""}
        appointment={selected}
        onConfirm={doCancel}
      />

      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} appointments={appointments} />

      <CanceladosDialog
        open={canceladosOpen}
        onOpenChange={setCanceladosOpen}
        appointments={appointments}
        professionals={allProfessionals}
      />

      <NewAppointmentDialog
        open={newOpen}
        onOpenChange={(o) => { setNewOpen(o); if (!o) setNewDefaults(null); }}
        defaultProfessional={newDefaults?.professionalId ?? visibleProfs[0]?.id ?? allProfessionals[0]?.id ?? ""}
        defaultStart={newDefaults?.start}
        defaultDate={newDefaults?.date}
        currentDate={currentDate}
        professionals={allProfessionals}
        onCreate={createAppointment}
        isProfAvailableOnDate={isProfAvailableOnDate}
      />

      <EditAppointmentDialog
        open={editOpen}
        onOpenChange={(o) => { setEditOpen(o); if (!o) setEditApt(null); }}
        appointment={editApt}
        professionals={allProfessionals}
        onSave={(data) => {
          if (editApt) updateAppointment(editApt.id, data);
          setEditOpen(false);
          setEditApt(null);
        }}
        isProfAvailableOnDate={isProfAvailableOnDate}
      />

      <PrintAgendaDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        appointments={appointments}
        professionals={allProfessionals}
        defaultDate={toDateKey(currentDate)}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        appointment={selected}
        onConfirm={(amount, method, discount, amountOriginal, cardBrand, authCode, taxaMDR, numeroParcelas, datasParcelas, paymentSplit) => {
          if (selected) registerPayment(selected.id, amount, method, discount, amountOriginal, cardBrand, authCode, taxaMDR, numeroParcelas, datasParcelas, paymentSplit);
          setPayOpen(false);
        }}
      />

      {/* Modal: horários de atendimento do profissional */}
      <ProfInfoDialog
        open={profInfoOpen}
        onOpenChange={setProfInfoOpen}
        prof={profInfoTarget}
        currentDate={currentDate}
        isProfAvailableOnDate={isProfAvailableOnDate}
        appointments={appointments}
        currentKey={currentKey}
      />

      {/* Modal cadastro completo ao iniciar atendimento */}
      <CadastroCompletoDialog
        open={cadastroOpen}
        onOpenChange={(o) => {
          if (!o) onCadastroSalvoOuPulado();
          else setCadastroOpen(o);
        }}
        patient={pacienteCadastro}
        onSave={() => onCadastroSalvoOuPulado()}
        origem="agenda"
      />

      {/* Modal: confirmação de presença */}
      <ConfirmPresencaDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        appointment={selected}
        onConfirm={(via) => {
          if (!selected) return;
          setAppointments((prev) =>
            prev.map((a) =>
              a.id === selected.id
                ? { ...a, confirmadoPresenca: true, confirmadoVia: via, confirmadoEm: new Date().toISOString() }
                : a
            )
          );
          addLog(selected.id, "confirmado_presenca", `Presença confirmada via ${via}`);
          toast.success("Presença confirmada!");
          setConfirmOpen(false);
        }}
      />

      {/* Modal: lista de espera */}
      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        waitlist={waitlist}
        professionals={allProfessionals}
        onAdd={(entry) => {
          setWaitlist((prev) => [...prev, { ...entry, id: `wl_${Date.now()}`, createdAt: new Date().toISOString(), notified: false }]);
          toast.success("Paciente adicionado à lista de espera");
        }}
        onRemove={(id) => {
          excluirListaEspera(id).then(() => {
        setWaitlist((prev) => prev.filter((w) => w.id !== id));
      }).catch(console.error);
          toast.success("Removido da lista de espera");
        }}
        onSchedule={(entry) => {
          setWaitlist((prev) => prev.filter((w) => w.id !== entry.id));
          setNewDefaults({ professionalId: entry.professionalId, start: entry.preferredStart ?? "08:00", date: entry.preferredDate });
          setWaitlistOpen(false);
          setNewOpen(true);
        }}
      />

      {/* Modal: bloquear horário */}
      <BlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        professionals={allProfessionals}
        defaults={blockDefaults}
        currentDate={currentKey}
        onSave={(block) => {
          const novo: AgendaBlock = { ...block, id: `blk_${Date.now()}`, createdAt: new Date().toISOString() };
          setBlocks((prev) => [...prev, novo]);
          toast.success(`Horário bloqueado: ${block.reason} · ${block.start}–${block.end}`);
          setBlockOpen(false);
        }}
      />
    </div>
  );
}

// ─── Dialog: cancelamento com motivo ─────────────────────────────────────
function CancelDialog({ open, onOpenChange, patientName, appointment, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientName: string;
  appointment?: any;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);

  const isPaid        = !!appointment?.paid;
  const isSentBilling = !!(appointment?.sentToBilling || appointment?.emLote);
  const amount        = appointment?.amount as number | undefined;
  const payMethod     = appointment?.paymentMethod as string | undefined;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Verifica status do lote se enviado ao faturamento
  const loteStatus: string | null = (() => {
    if (!isSentBilling) return null;
    try {
      const lotes: any[] = JSON.parse(localStorage.getItem("nexaclinic_lotes_faturamento") ?? "[]");
      for (const l of lotes) {
        if (l.items?.some((i: any) => i.appointmentId === appointment?.id)) return l.status;
      }
    } catch { /* */ }
    return null;
  })();

  const lotesFechado = loteStatus === "enviado" || loteStatus === "pago";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" /> Cancelar agendamento
          </DialogTitle>
          <DialogDescription>
            {patientName} — informe o motivo do cancelamento.
          </DialogDescription>
        </DialogHeader>

        {/* Painel de impactos */}
        <div className="space-y-2">
          {isPaid && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 text-base">💰</span>
              <div>
                <p className="text-xs font-bold text-orange-800">Pagamento será estornado</p>
                <p className="text-[11px] text-orange-700 mt-0.5">
                  {amount ? fmtBRL(amount) : ""} via {payMethod} — lançado em Contas a Pagar como estorno pendente.
                </p>
              </div>
            </div>
          )}
          {isSentBilling && !lotesFechado && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 text-base">🧾</span>
              <div>
                <p className="text-xs font-bold text-purple-800">Guia será removida do lote</p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  A guia será retirada automaticamente do lote de faturamento aberto.
                </p>
              </div>
            </div>
          )}
          {isSentBilling && lotesFechado && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 text-base">⚠️</span>
              <div>
                <p className="text-xs font-bold text-red-800">Lote já foi {loteStatus} ao convênio</p>
                <p className="text-[11px] text-red-700 mt-0.5">
                  A guia está num lote fechado. O cancelamento será registrado mas o estorno deve ser comunicado manualmente ao convênio.
                </p>
              </div>
            </div>
          )}
          {!isPaid && !isSentBilling && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-start gap-2">
              <span className="shrink-0 text-base">✅</span>
              <p className="text-xs text-slate-600">Sem impacto financeiro — agendamento sem pagamento registrado.</p>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Motivo do cancelamento *</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: paciente solicitou remarcação, emergência, etc."
            rows={3}
          />
          <p className="text-[10px] text-muted-foreground">Obrigatório para rastreabilidade.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (!reason.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
              onConfirm(reason.trim());
            }}
          >
            <XCircle className="h-4 w-4" /> Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: logs e cancelamentos ────────────────────────────────────────
// ─── Dialog: Agendamentos Cancelados ─────────────────────────────────────────
function CanceladosDialog({ open, onOpenChange, appointments, professionals }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointments: AppointmentExt[];
  professionals: any[];
}) {
  const [search, setSearch] = useState("");
  const [filterProf, setFilterProf] = useState("todos");

  const profissionais = useMemo(
    () => professionals.filter((p: any) => (p.tipo ?? "profissional") === "profissional"),
    [professionals]
  );

  const cancelados = useMemo(() => {
    return appointments
      .filter((a) => a.status === "cancelado")
      .filter((a) => {
        if (filterProf !== "todos" && a.professionalId !== filterProf) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            a.patientName.toLowerCase().includes(q) ||
            (a.cancelReason ?? "").toLowerCase().includes(q) ||
            (professionals.find((p: any) => p.id === a.professionalId)?.name ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.cancelledAt ?? a.date;
        const db = b.cancelledAt ?? b.date;
        return db.localeCompare(da);
      });
  }, [appointments, professionals, search, filterProf]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <UserX className="h-5 w-5" /> Agendamentos Cancelados
          </DialogTitle>
          <DialogDescription>
            {cancelados.length} cancelamento{cancelados.length !== 1 ? "s" : ""} encontrado{cancelados.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar paciente, motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filterProf}
            onChange={(e) => setFilterProf(e.target.value)}
            className="h-9 border border-border rounded-lg px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="todos">Todos os profissionais</option>
            {profissionais.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Lista */}
        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
          {cancelados.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum cancelamento encontrado.
            </p>
          )}
          {cancelados.map((a) => {
            const prof = professionals.find((p: any) => p.id === a.professionalId);
            const dataBR = a.date
              ? new Date(a.date + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—";
            const canceladoEm = (a as any).cancelledAt
              ? new Date((a as any).cancelledAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
              : null;
            return (
              <div key={a.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                {/* Linha 1: nome + horário da consulta */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                      <UserX className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{a.patientName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {dataBR} às {a.start} · {a.durationMin ?? 30} min
                      </p>
                    </div>
                  </div>
                  {canceladoEm && (
                    <p className="text-[10px] text-muted-foreground shrink-0 text-right">
                      Cancelado em<br />{canceladoEm}
                    </p>
                  )}
                </div>

                {/* Linha 2: profissional + procedimento + convênio */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground pl-10">
                  {prof && (
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: prof.color ?? "#888" }} />
                      {prof.name}
                    </span>
                  )}
                  {a.procedure && <span>📋 {a.procedure}</span>}
                  {a.insurance && <span>🏥 {a.insurance}</span>}
                </div>

                {/* Linha 3: motivo */}
                {(a as any).cancelReason && (
                  <div className="pl-10">
                    <p className="text-[11px] text-destructive/80 bg-destructive/10 rounded-md px-2 py-1">
                      <span className="font-semibold">Motivo:</span> {(a as any).cancelReason}
                    </p>
                  </div>
                )}
                {!(a as any).cancelReason && (
                  <div className="pl-10">
                    <p className="text-[11px] text-muted-foreground italic">Motivo não informado</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogsDialog({ open, onOpenChange, appointments }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointments: AppointmentExt[];
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    if (open) {
      listarLogsAgenda().then((lista) => setLogs(lista.slice(0, 50) as LogEntry[])).catch(console.error);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de atividades</DialogTitle>
          <DialogDescription>Últimas 50 ações registradas na agenda.</DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum log registrado.</p>
          )}
          {logs.map((log) => {
            const apt = appointments.find((a) => a.id === log.appointmentId);
            return (
              <div key={log.id} className="flex gap-3 rounded-lg border border-border/50 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{apt?.patientName ?? log.appointmentId}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {log.action}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{fmtDateTime(log.at)}</p>
                  <p className="text-[10px] text-muted-foreground">{log.user}</p>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: horários de atendimento do profissional ─────────────────────
const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ProfInfoDialog({ open, onOpenChange, prof, currentDate, isProfAvailableOnDate, appointments, currentKey }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prof: any | null;
  currentDate: Date;
  isProfAvailableOnDate: (prof: any, dateStr: string) => boolean;
  appointments: AppointmentExt[];
  currentKey: string;
}) {
  if (!prof) return null;

  const agendaTipo: "permanente" | "especifica" = prof.agendaTipo ?? "permanente";
  const diasSemana: number[] = prof.diasSemana ?? [0, 1, 2, 3, 4, 5, 6];
  const datasEspecificas: string[] = (prof.datasEspecificas ?? []).sort();
  const scheduleStart: string = prof.scheduleStart ?? "08:00";
  const scheduleEnd: string = prof.scheduleEnd ?? "18:00";

  const atendimentoHoje = isProfAvailableOnDate(prof, toDateKey(currentDate));

  // Próximas datas de atendimento (próximos 30 dias)
  const proximasDatas = useMemo(() => {
    const result: string[] = [];
    const base = new Date();
    for (let i = 0; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const key = toDateKey(d);
      if (isProfAvailableOnDate(prof, key)) result.push(key);
      if (result.length >= 8) break;
    }
    return result;
  }, [prof]);

  function fmtData(str: string) {
    const [y, m, d] = str.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-white shadow-md" style={{ boxShadow: `0 0 0 2px ${prof.color}55` }}>
              {prof.avatar ? <AvatarImage src={prof.avatar} alt={prof.name} className="object-cover" /> : null}
              <AvatarFallback className="text-sm font-bold text-white" style={{ background: `linear-gradient(135deg, ${prof.color} 0%, ${prof.color}cc 100%)` }}>
                {prof.name.split(" ").slice(1, 3).map((n: string) => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-base">{prof.name}</DialogTitle>
              <DialogDescription className="text-xs">{prof.specialty}{prof.crm ? ` • CRM ${prof.crm}` : ""}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status hoje */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
            atendimentoHoje
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <span className={`h-2 w-2 rounded-full ${atendimentoHoje ? "bg-green-500" : "bg-amber-400"}`} />
            {atendimentoHoje
              ? `Atende hoje (${currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })})`
              : `De folga hoje (${currentDate.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "short" })})`}
          </div>

          {/* ── Estatísticas do dia ─────────────────────────────────────── */}
          {(() => {
            const profAppts = appointments.filter(
              (a) => a.professionalId === prof.id && a.date === currentKey && a.status !== "cancelado" && a.status !== "faltou"
            );
            const totalHoje = profAppts.length;
            const retornosHoje = profAppts.filter((a) => getAppointmentType(a.procedure ?? "") === "retorno").length;
            const receitaHoje = profAppts.reduce((s, a) => s + (a.procedureValue ?? 0), 0);
            const finalizados = profAppts.filter((a) => a.status === "finalizado").length;
            const canceladosProf = appointments.filter((a) => a.professionalId === prof.id && a.date === currentKey && a.status === "cancelado").length;

            if (totalHoje === 0 && canceladosProf === 0) return null;

            return (
              <div
                className="rounded-xl border border-border/50 p-3"
                style={{ background: `linear-gradient(135deg, ${prof.color}08 0%, transparent 100%)` }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Estatísticas do dia
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2 border border-border/40">
                    <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: prof.color }} />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Consultas hoje</p>
                      <p className="text-base font-bold leading-tight" style={{ fontFamily: "'Sora', system-ui" }}>{totalHoje}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2 border border-border/40">
                    <RefreshCw className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Retornos</p>
                      <p className="text-base font-bold leading-tight" style={{ fontFamily: "'Sora', system-ui" }}>{retornosHoje}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2 border border-border/40">
                    <Activity className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Finalizados</p>
                      <p className="text-base font-bold leading-tight" style={{ fontFamily: "'Sora', system-ui" }}>{finalizados}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2 border border-border/40">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground leading-none">Receita</p>
                      <p className="text-sm font-bold leading-tight text-green-600">{receitaHoje > 0 ? fmtBRL(receitaHoje) : "—"}</p>
                    </div>
                  </div>
                </div>
                {canceladosProf > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5">
                    <UserX className="h-3 w-3 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 font-medium">{canceladosProf} cancelamento{canceladosProf > 1 ? "s" : ""} neste dia</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Horário */}
          <div className="rounded-lg border border-border/50 p-3 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Horário de atendimento</p>
            <p className="text-sm font-bold" style={{ color: prof.color }}>{scheduleStart} – {scheduleEnd}</p>
          </div>

          {/* Grade de dias */}
          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {agendaTipo === "permanente" ? "Dias da semana" : "Datas específicas"}
            </p>

            {agendaTipo === "permanente" ? (
              <div className="grid grid-cols-7 gap-1">
                {DIAS_SEMANA_CURTO.map((dia, idx) => {
                  const atende = diasSemana.includes(idx);
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col items-center rounded-lg py-1.5 text-[10px] font-semibold ${
                        atende
                          ? "text-white"
                          : "bg-muted/60 text-muted-foreground opacity-40"
                      }`}
                      style={atende ? { background: prof.color } : {}}
                    >
                      {dia}
                    </div>
                  );
                })}
              </div>
            ) : datasEspecificas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma data específica cadastrada.</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {datasEspecificas.map((ds) => {
                  const isToday = ds === toDateKey(new Date());
                  return (
                    <div key={ds} className={`flex items-center justify-between rounded-md px-2 py-1 text-xs ${isToday ? "bg-primary/10 font-bold text-primary" : "bg-muted/40"}`}>
                      <span>{fmtData(ds)}</span>
                      {isToday && <span className="text-[9px] bg-primary text-primary-foreground rounded-full px-1.5">hoje</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Próximas datas */}
          {proximasDatas.length > 0 && (
            <div className="rounded-lg border border-border/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próximos atendimentos</p>
              <div className="flex flex-wrap gap-1.5">
                {proximasDatas.map((ds) => (
                  <span key={ds} className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ds === toDateKey(new Date()) ? "text-white" : "bg-muted text-muted-foreground"}`}
                    style={ds === toDateKey(new Date()) ? { background: prof.color } : {}}>
                    {fmtData(ds)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {proximasDatas.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              Nenhum atendimento previsto nos próximos 30 dias.
            </div>
          )}

          {/* Observações do profissional */}
          {prof.observacao && prof.observacao.trim() && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <span>📝</span> Observações
              </p>
              <p className="text-xs text-amber-900 leading-relaxed whitespace-pre-wrap">{prof.observacao}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog: novo agendamento ─────────────────────────────────────────────
function NewAppointmentDialog({
  open, onOpenChange, defaultProfessional, defaultStart, defaultDate, currentDate, professionals: profissionaisList, onCreate, isProfAvailableOnDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultProfessional: string;
  defaultStart?: string;
  defaultDate?: string;
  currentDate: Date;
  professionals?: any[];
  onCreate: (data: Omit<AppointmentExt, "id" | "status">) => void;
  isProfAvailableOnDate?: (prof: any, dateStr: string) => boolean;
}) {
  const [profId, setProfId] = useState(defaultProfessional);
  const [start, setStart] = useState(defaultStart ?? "09:00");
  const [date, setDate] = useState(defaultDate ?? toDateKey(currentDate));
  const [patientName, setPatientName] = useState("");
  const [phone, setPhone] = useState("");
  const [cpf, setCpf] = useState("");
  const [duration, setDuration] = useState("30");
  // Sem valor padrão fixo — evita mostrar um procedimento que talvez nunca
  // tenha sido cadastrado. É preenchido com o 1º procedimento ativo real
  // assim que a lista carrega (ver efeito abaixo).
  const [procedure, setProcedure] = useState("");
  const [insurance, setInsurance] = useState("Particular");
  const [planoId, setPlanoId]     = useState("");
  const [procedureValueStr, setProcedureValueStr] = useState("");
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestions = usePatientSearch(query);
  const conveniosList = useConveniosNomes(open);

  // Convênios e procedimentos completos (Supabase — cache compartilhado)
  const conveniosFull = useConveniosFull(open);
  const procedimentosFull = useProcedimentosFull(open);
  const autoValue = useProcedureValue(procedure, insurance, profId, planoId, procedimentosFull, conveniosFull);
  const planosList = useMemo(() => {
    if (insurance === "Particular") return [];
    const conv = conveniosFull.find((c: any) => c.name?.toLowerCase().trim() === insurance?.toLowerCase().trim());
    return (conv?.planos ?? []).filter((p: any) => p.ativo !== false);
  }, [insurance, conveniosFull]);

  // O campo Procedimento começa vazio ("Selecione...") e só é preenchido
  // quando o usuário escolhe explicitamente na busca — nunca um valor
  // padrão automático, para não sugerir um procedimento que não existe
  // ou não foi escolhido pelo usuário.


  // ─── Aviso de retorno disponível ──────────────────────────────────────────
  // Calcula se o paciente selecionado tem um retorno disponível com este profissional
  const retornoInfo = useMemo(() => {
    if (!patientName.trim() || !profId || !date) return null;
    try {
      // Carrega appointments para o paciente
      const apts: any[] = JSON.parse(localStorage.getItem("nexaclinic_appointments_v3") ?? "[]");
      const procs: any[] = procedimentosFull;
      const profs: any[] = JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]");

      const prof = profs.find((p: any) => p.id === profId);
      const prazoProfDias: number = prof?.prazoRetornoDias ?? 30;

      // Filtra consultas finalizadas do paciente com este profissional
      const consultasDoProf = apts.filter((a: any) =>
        a.patientName?.toLowerCase() === patientName.trim().toLowerCase() &&
        a.professionalId === profId &&
        (a.status === "finalizado" || a.status === "aguardando" || a.status === "confirmado")
      );

      // Encontra procedimentos marcados como tipoConsulta
      const procConsulta = (name: string) => {
        const p = procs.find((p: any) => p.name?.toLowerCase() === name?.toLowerCase());
        return p?.tipoConsulta === true;
      };

      // Encontra procedimento selecionado como tipoRetorno
      const procAtualERetorno = (() => {
        const p = procs.find((p: any) => p.name?.toLowerCase() === procedure?.toLowerCase());
        return p?.tipoRetorno === true;
      })();

      if (!procAtualERetorno) return null; // só avisa quando está agendando retorno

      // Verifica se há uma consulta dentro do prazo
      const [dy, dm, dd] = date.split("-").map(Number);
      const dataAgendamento = new Date(dy, dm - 1, dd);

      for (const apt of consultasDoProf) {
        if (!procConsulta(apt.procedure)) continue;
        const [ay, am, ad] = apt.date.split("-").map(Number);
        const dataConsulta = new Date(ay, am - 1, ad);
        const diasPassados = Math.floor((dataAgendamento.getTime() - dataConsulta.getTime()) / 86400000);
        const prazoProc = (() => {
          const p = procs.find((p: any) => p.name?.toLowerCase() === apt.procedure?.toLowerCase());
          return p?.prazoRetornoDias ?? prazoProfDias;
        })();
        const prazoFinal = Math.min(prazoProc, prazoProfDias);
        if (diasPassados >= 0 && diasPassados <= prazoFinal) {
          return { ok: true, diasPassados, prazoFinal, dataConsulta: apt.date, procNome: apt.procedure };
        }
        if (diasPassados > prazoFinal) {
          return { ok: false, diasPassados, prazoFinal, dataConsulta: apt.date, procNome: apt.procedure };
        }
      }
      return null;
    } catch { return null; }
  }, [patientName, profId, date, procedure, procedimentosFull]);

  useEffect(() => {
    if (open) {
      // ✅ CORREÇÃO 3: garante que profId inicial é um UUID válido.
      // Se defaultProfessional for um ID legado ("p1", "p2"), usa o primeiro
      // profissional ativo da lista real recebida via prop.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const resolvedProfId = UUID_RE.test(defaultProfessional)
        ? defaultProfessional
        : (profissionaisList ?? []).find((p: any) => p.active)?.id ?? defaultProfessional;
      setProfId(resolvedProfId);
      setStart(defaultStart ?? "09:00");
      setDate(defaultDate ?? toDateKey(currentDate));
      setPatientName("");
      setPhone("");
      setCpf("");  // limpa CPF ao abrir novo agendamento
      setDuration("30");
      // Não força mais "Consulta Clínica" — reseta e deixa o efeito de
      // procedimentosFull escolher o 1º procedimento realmente cadastrado.
      setProcedure("");
      setInsurance("Particular");
      setPlanoId("");
      setQuery("");
      setProcedureValueStr("");
      // O valor é preenchido automaticamente pelo efeito abaixo assim que
      // `autoValue` (useProcedureValue, com dados reais do Supabase) calcular.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultProfessional, defaultStart, defaultDate]);

  // Sincroniza o valor com o autoValue sempre que procedimento ou convênio mudar
  useEffect(() => {
    setProcedureValueStr(autoValue ?? "");
  }, [autoValue]);

  function handleSelectPatient(name: string, patPhone: string, patInsurance: string, patCpf?: string) {
    setPatientName(name);
    setQuery(name);
    if (patPhone && !phone) setPhone(patPhone);
    // Sempre preenche CPF do cadastro (com máscara)
    if (patCpf) {
      const digits = patCpf.replace(/\D/g, "").slice(0, 11);
      const masked = digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
      setCpf(masked);
    }
    if (patInsurance) setInsurance(patInsurance);
    setShowSuggestions(false);
  }

  function submit() {
    if (!patientName.trim()) { toast.error("Informe o nome do paciente"); return; }
    if (!phone.trim()) { toast.error("Telefone é obrigatório"); return; }
    if (!cpf.trim()) { toast.error("CPF é obrigatório"); return; }
    if (!procedure.trim()) { toast.error("Selecione o procedimento"); return; }
    // Valida se o profissional atende na data selecionada
    if (isProfAvailableOnDate && date) {
      try {
        const saved = localStorage.getItem("nexaclinic_professionals");
        const profs = saved ? JSON.parse(saved) : professionals;
        const prof = profs.find((p: any) => p.id === profId);
        if (prof && !isProfAvailableOnDate(prof, date)) {
          toast.error(`${prof.name} não atende neste dia.`, { description: "Verifique a grade de atendimento no cadastro do profissional." });
          return;
        }
      } catch { /* silencioso */ }
    }
    // Bloqueia retorno fora do prazo
    if (retornoInfo && !retornoInfo.ok) {
      toast.error("Prazo de retorno vencido.", {
        description: `Consulta de ${retornoInfo.dataConsulta} — prazo era de ${retornoInfo.prazoFinal} dias (${retornoInfo.diasPassados} dias atrás).`,
      });
      return;
    }
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) { toast.error("CPF inválido. Informe os 11 dígitos."); return; }
    if (!date) { toast.error("Informe a data"); return; }
    const procedureValue = procedureValueStr
      ? parseFloat(procedureValueStr.replace(",", "."))
      : undefined;
    // Aviso: ao agendar consulta, verifica se paciente tem retorno disponível não usado
    try {
      const procs: any[] = procedimentosFull;
      const procAtual = procs.find((p: any) => p.name?.toLowerCase() === procedure?.toLowerCase());
      const isConsulta = procAtual?.tipoConsulta === true;
      if (isConsulta) {
        const apts: any[] = JSON.parse(localStorage.getItem("nexaclinic_appointments_v3") ?? "[]");
        const profs: any[] = JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]");
        const prof = profs.find((p: any) => p.id === profId);
        const prazoProfDias: number = prof?.prazoRetornoDias ?? 30;
        const [dy, dm, dd] = (date || "").split("-").map(Number);
        const dataAgendamento = new Date(dy, dm - 1, dd);
        const consultasAntes = apts.filter((a: any) =>
          a.patientName?.toLowerCase() === patientName.trim().toLowerCase() &&
          a.professionalId === profId &&
          (a.status === "finalizado" || a.status === "confirmado" || a.status === "aguardando")
        );
        for (const apt of consultasAntes) {
          const pApt = procs.find((p: any) => p.name?.toLowerCase() === apt.procedure?.toLowerCase());
          if (!pApt?.tipoConsulta) continue;
          const [ay, am, ad] = apt.date.split("-").map(Number);
          const dataConsulta = new Date(ay, am - 1, ad);
          const diasPassados = Math.floor((dataAgendamento.getTime() - dataConsulta.getTime()) / 86400000);
          const prazo = Math.min(pApt.prazoRetornoDias ?? prazoProfDias, prazoProfDias);
          if (diasPassados >= 0 && diasPassados <= prazo) {
            toast.warning(`Atenção: ${patientName.trim()} tem retorno disponível!`, {
              description: `Consulta em ${apt.date} — prazo de retorno: ${prazo} dias (${prazo - diasPassados} dias restantes).`,
              duration: 6000,
            });
            break;
          }
        }
      }
    } catch { /* silencioso */ }

    onCreate({
      patientName: patientName.trim(),
      phone: phone.trim() || undefined,
      cpf: cpf.replace(/\D/g, "") || undefined,
      professionalId: profId,
      start,
      durationMin: Number(duration),
      procedure,
      insurance,
      planoId: planoId || undefined,
      date,
      procedureValue: procedureValue && procedureValue > 0 ? procedureValue : undefined,
    } as any);
    onOpenChange(false);
  }

  // Lista de nomes de procedimentos para o combobox (reaproveita procedimentosFull já carregado)
  const proceduresList = procedimentosFull.map((p) => p.name);
  // Busca local no combobox
  const [procSearch, setProcSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [procPopoverOpen, setProcPopoverOpen] = useState(false);
  const [convPopoverOpen, setConvPopoverOpen] = useState(false);
  const filteredProcs = proceduresList.filter((n) => n.toLowerCase().includes(procSearch.toLowerCase()));
  const filteredConvs = conveniosList.filter((n) => n.toLowerCase().includes(convSearch.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
          <DialogDescription>Preencha os dados para criar a consulta.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Busca de paciente com autocomplete */}
          <div>
            <Label className="text-xs">Paciente *</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Nome ou telefone..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPatientName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-lg">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={() => handleSelectPatient(p.name, p.phone, p.insurance, p.cpf)}
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.phone} • {p.insurance}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Aviso de retorno ─────────────────────────────────────────── */}
          {retornoInfo && retornoInfo.ok && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 flex items-start gap-2">
              <span className="text-green-600 text-lg leading-none mt-0.5">🔁</span>
              <div>
                <p className="text-sm font-semibold text-green-800">Retorno disponível!</p>
                <p className="text-xs text-green-700">
                  Consulta em {retornoInfo.dataConsulta} — {retornoInfo.diasPassados} dias atrás.
                  Prazo: {retornoInfo.prazoFinal} dias. Retorno dentro do prazo ✓
                </p>
              </div>
            </div>
          )}
          {retornoInfo && !retornoInfo.ok && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
              <span className="text-red-600 text-lg leading-none mt-0.5">⛔</span>
              <div>
                <p className="text-sm font-semibold text-red-800">Prazo de retorno vencido</p>
                <p className="text-xs text-red-700">
                  Consulta em {retornoInfo.dataConsulta} — {retornoInfo.diasPassados} dias atrás.
                  Prazo era de {retornoInfo.prazoFinal} dias. Agendamento de retorno bloqueado.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Horário *</Label>
              <Input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Profissional *</Label>
              <Select value={profId} onValueChange={setProfId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    try {
                      // ✅ CORREÇÃO 2: usa a prop `profissionaisList` (vinda do estado do pai,
                      // já atualizada com UUIDs reais do Supabase) em vez de ler direto do
                      // localStorage, que pode conter IDs antigos do mock ("p1", "p2").
                      const saved = localStorage.getItem("nexaclinic_professionals");
                      const profs = profissionaisList && profissionaisList.length > 0
                        ? profissionaisList
                        : saved ? JSON.parse(saved) : professionals;
                      return profs.filter((p: any) => p.active).map((p: any) => {
                        const disponivel = !isProfAvailableOnDate || !date || isProfAvailableOnDate(p, date);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <span className={!disponivel ? "text-amber-600" : undefined}>
                              {p.name}{!disponivel ? " ⚠ Não atende neste dia" : ""}
                            </span>
                          </SelectItem>
                        );
                      });
                    } catch {
                      return professionals.filter((p) => p.active).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ));
                    }
                  })()}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 20, 30, 45, 60, 90].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Procedimento</Label>
              <Popover open={procPopoverOpen} onOpenChange={setProcPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-10">
                    <span className={procedure ? "text-foreground" : "text-muted-foreground"}>{procedure || "Selecione..."}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <input
                      className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
                      placeholder="Buscar procedimento..."
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredProcs.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                    )}
                    {filteredProcs.map((name) => (
                      <button key={name} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${procedure === name ? "font-semibold text-primary" : ""}`}
                        onClick={() => { setProcedure(name); setProcSearch(""); setProcPopoverOpen(false); }}>
                        {procedure === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Convênio</Label>
              <Popover open={convPopoverOpen} onOpenChange={setConvPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-10">
                    <span className={insurance ? "text-foreground" : "text-muted-foreground"}>{insurance || "Selecione..."}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <input
                      className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
                      placeholder="Buscar convênio..."
                      value={convSearch}
                      onChange={(e) => setConvSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredConvs.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                    )}
                    {filteredConvs.map((name) => (
                      <button key={name} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${insurance === name ? "font-semibold text-primary" : ""}`}
                        onClick={() => { setInsurance(name); setPlanoId(""); setConvSearch(""); setConvPopoverOpen(false); }}>
                        {insurance === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Plano — aparece apenas quando o convênio tem planos cadastrados */}
          {planosList.length > 0 && (
            <div>
              <Label className="text-xs">Plano</Label>
              <Select value={planoId} onValueChange={setPlanoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano..." />
                </SelectTrigger>
                <SelectContent>
                  {planosList.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}{p.abrangencia ? ` — ${p.abrangencia}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-0.5">
                O valor será buscado na tabela de preços do plano selecionado.
              </p>
            </div>
          )}

          {/* Valor + Telefone + CPF numa linha só */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Valor
                {autoValue && (
                  <span className="ml-1 text-[10px] text-success flex items-center gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" /> auto
                  </span>
                )}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={procedureValueStr}
                onChange={(e) => setProcedureValueStr(e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs">Telefone *</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  if (v.length > 10) v = v.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
                  else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
                  else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
                  setPhone(v);
                }}
                maxLength={15}
              />
            </div>

            <div>
              <Label className="text-xs">CPF *</Label>
              <Input
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2})/, "$1.$2.$3-$4");
                  else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{0,3})/, "$1.$2.$3");
                  else if (v.length > 3) v = v.replace(/^(\d{3})(\d{0,3})/, "$1.$2");
                  setCpf(v);
                }}
                maxLength={14}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Tabela de taxas MDR por bandeira/tipo ────────────────────────────────────
// Fonte: médias de mercado 2024. Editável futuramente via Configurações.
const MDR_TAXAS: Record<string, { credito_vista: number; credito_parcelado: number; debito: number }> = {
  "Visa":             { credito_vista: 2.49, credito_parcelado: 2.99, debito: 1.59 },
  "Mastercard":       { credito_vista: 2.49, credito_parcelado: 2.99, debito: 1.59 },
  "Elo":              { credito_vista: 2.69, credito_parcelado: 3.19, debito: 1.69 },
  "American Express": { credito_vista: 2.99, credito_parcelado: 3.49, debito: 1.99 },
  "Hipercard":        { credito_vista: 2.69, credito_parcelado: 3.19, debito: 1.69 },
  "Cabal":            { credito_vista: 2.49, credito_parcelado: 2.99, debito: 1.59 },
  "Outra":            { credito_vista: 2.99, credito_parcelado: 3.49, debito: 1.99 },
};
const CARD_BRANDS = Object.keys(MDR_TAXAS);

function calcDatasParcelas(numeroParcelas: number): string[] {
  const datas: string[] = [];
  const hoje = new Date();
  for (let i = 1; i <= numeroParcelas; i++) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + i * 30);
    datas.push(d.toISOString().split("T")[0]);
  }
  return datas;
}

function PaymentDialog({ open, onOpenChange, appointment, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: AppointmentExt | null;
  onConfirm: (amount: number, method: string, discount: number, amountOriginal: number, cardBrand?: string, authCode?: string, taxaMDR?: number, numeroParcelas?: number, datasParcelas?: string[], paymentSplit?: { method: string; amount: number; cardBrand?: string; authCode?: string }[]) => void;
}) {
  const [amountStr, setAmountStr]     = useState("");
  const [method, setMethod]           = useState(PAYMENT_METHODS[0]);
  const [discount, setDiscount]       = useState(0);
  const [cardBrand, setCardBrand]     = useState("");
  const [authCode, setAuthCode]       = useState("");
  const [numeroParcelas, setNParcelas] = useState(1);
  const [taxaMDRCustom, setTaxaMDRCustom] = useState<string>("");
  const [editandoMDR, setEditandoMDR] = useState(false);
  // ── Duplo pagamento ──────────────────────────────────────────────────────
  const [duploPagamento, setDuploPagamento] = useState(false);
  const [method2, setMethod2]           = useState(PAYMENT_METHODS[3]); // Dinheiro
  const [amount2Str, setAmount2Str]     = useState("");
  const [cardBrand2, setCardBrand2]     = useState("");
  const [authCode2, setAuthCode2]       = useState("");

  const maxDesconto = useMemo(() => {
    try {
      const sessao = JSON.parse(sessionStorage.getItem("nexaclinic_sessao_v2") ?? "null");
      return sessao?.maxDesconto ?? 0;
    } catch { return 0; }
  }, [open]);

  const isCredito = method === "Cartão de crédito";
  const isDebito  = method === "Cartão de débito";
  const isCard    = isCredito || isDebito;

  // Taxa MDR automática pela bandeira + tipo + parcelas
  const taxaMDR = useMemo((): number => {
    if (!isCard || !cardBrand) return 0;
    if (editandoMDR && taxaMDRCustom !== "") return parseFloat(taxaMDRCustom.replace(",", ".")) || 0;
    const tabela = MDR_TAXAS[cardBrand];
    if (!tabela) return 0;
    if (isDebito) return tabela.debito;
    return numeroParcelas > 1 ? tabela.credito_parcelado : tabela.credito_vista;
  }, [isCard, cardBrand, isDebito, numeroParcelas, editandoMDR, taxaMDRCustom]);

  const amountOriginal = parseFloat(amountStr.replace(",", ".")) || 0;
  const amountFinal    = amountOriginal > 0 ? parseFloat((amountOriginal * (1 - discount / 100)).toFixed(2)) : 0;
  const valorTaxaMDR   = isCard && taxaMDR > 0 ? parseFloat((amountFinal * taxaMDR / 100).toFixed(2)) : 0;
  const valorLiquido   = isCard ? parseFloat((amountFinal - valorTaxaMDR).toFixed(2)) : amountFinal;
  const valorParcela   = numeroParcelas > 1 ? parseFloat((amountFinal / numeroParcelas).toFixed(2)) : 0;

  useEffect(() => {
    if (open && appointment) {
      setAmountStr(appointment.procedureValue != null ? String(appointment.procedureValue.toFixed(2)) : "");
      setMethod(PAYMENT_METHODS[0]);
      setDiscount(0);
      setCardBrand("");
      setAuthCode("");
      setNParcelas(1);
      setTaxaMDRCustom("");
      setEditandoMDR(false);
      setDuploPagamento(false);
      setMethod2(PAYMENT_METHODS[3]);
      setAmount2Str("");
      setCardBrand2("");
      setAuthCode2("");
    }
  }, [open, appointment]);
  
  const isCard2 = method2 === "Cartão de crédito" || method2 === "Cartão de débito";
  const amount2 = parseFloat(amount2Str.replace(",", ".")) || 0;

  function submit() {
    if (!amountOriginal || amountOriginal <= 0) { toast.error("Informe um valor válido"); return; }
    if (discount > maxDesconto) { toast.error(`Seu limite de desconto é ${maxDesconto}%`); return; }
    if (isCard && !cardBrand) { toast.error("Selecione a bandeira do cartão (1ª forma)"); return; }
    if (duploPagamento) {
      if (amount2 <= 0) { toast.error("Informe o valor da 2ª forma de pagamento"); return; }
      if (isCard2 && !cardBrand2) { toast.error("Selecione a bandeira do cartão (2ª forma)"); return; }
      const totalDuplo = amountFinal - amount2;
      if (totalDuplo < 0) { toast.error("Soma das duas formas não pode ultrapassar o valor total"); return; }
      // Concatena métodos no campo paymentMethod: "PIX + Dinheiro"
      const methodCombinado = `${method} + ${method2}`;
      const brandCombinado = [isCard ? cardBrand : "", isCard2 ? cardBrand2 : ""].filter(Boolean).join(" + ") || undefined;
      const authCombinado = [isCard ? authCode : "", isCard2 ? authCode2 : ""].filter(Boolean).join(" / ") || undefined;
      const datas = isCredito && numeroParcelas > 1 ? calcDatasParcelas(numeroParcelas) : undefined;
      // Detalha cada forma separadamente — usado no financeiro para lançar
      // cada parte no destino certo (Caixa Central / Conta Bancária / Maquininha)
      const paymentSplit = [
        { method, amount: totalDuplo, cardBrand: isCard ? cardBrand : undefined, authCode: isCard ? authCode : undefined },
        { method: method2, amount: amount2, cardBrand: isCard2 ? cardBrand2 : undefined, authCode: isCard2 ? authCode2 : undefined },
      ];
      onConfirm(amountFinal, methodCombinado, discount, amountOriginal, brandCombinado, authCombinado, isCard ? taxaMDR : undefined, isCard ? numeroParcelas : undefined, datas, paymentSplit);
    } else {
      const datas = isCredito && numeroParcelas > 1 ? calcDatasParcelas(numeroParcelas) : undefined;
      onConfirm(amountFinal, method, discount, amountOriginal, isCard ? cardBrand : undefined, isCard ? authCode : undefined, isCard ? taxaMDR : undefined, isCard ? numeroParcelas : undefined, datas);
    }
  }

  const fmtBRLLocal = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>{appointment?.patientName} — {appointment?.procedure}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Valor */}
          <div>
            <Label className="text-xs">Valor (R$) *</Label>
            <Input type="number" step="0.01" min="0" placeholder="0,00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
          </div>

          {/* Desconto */}
          {maxDesconto > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Desconto</Label>
                <span className="text-xs font-semibold text-cyan-600">{discount}%</span>
              </div>
              <input type="range" min={0} max={maxDesconto} step={1} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-full accent-cyan-500" />
            </div>
          )}

          {/* Forma de pagamento */}
          <div>
            <Label className="text-xs">Forma de pagamento *</Label>
            <Select value={method} onValueChange={(v) => { setMethod(v); setCardBrand(""); setAuthCode(""); setNParcelas(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* ── CAMPOS DE CARTÃO ── */}
          {isCard && (
            <>
              {/* Bandeira */}
              <div>
                <Label className="text-xs">Bandeira *</Label>
                <Select value={cardBrand} onValueChange={(v) => { setCardBrand(v); setEditandoMDR(false); setTaxaMDRCustom(""); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a bandeira" /></SelectTrigger>
                  <SelectContent>
                    {CARD_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Parcelas — só crédito */}
              {isCredito && (
                <div>
                  <Label className="text-xs">Número de parcelas</Label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {[1,2,3,4,6,8,10,12].map((n) => (
                      <button key={n} onClick={() => setNParcelas(n)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${numeroParcelas === n ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-600 hover:border-slate-400"}`}>
                        {n === 1 ? "À vista" : `${n}x`}
                      </button>
                    ))}
                  </div>
                  {numeroParcelas > 1 && amountFinal > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{numeroParcelas}x de {fmtBRLLocal(valorParcela)} — recebimento em ~30 dias cada parcela</p>
                  )}
                </div>
              )}

              {/* Taxa MDR */}
              {cardBrand && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-orange-800 flex items-center gap-1">
                      💳 Taxa MDR ({isDebito ? "Débito" : numeroParcelas > 1 ? `Crédito ${numeroParcelas}x` : "Crédito à vista"})
                    </p>
                    <button onClick={() => { setEditandoMDR(!editandoMDR); setTaxaMDRCustom(taxaMDR.toString()); }}
                      className="text-[10px] text-orange-600 underline hover:text-orange-800">
                      {editandoMDR ? "Usar tabela" : "Editar taxa"}
                    </button>
                  </div>
                  {editandoMDR ? (
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" min="0" max="10" value={taxaMDRCustom}
                        onChange={(e) => setTaxaMDRCustom(e.target.value)}
                        className="h-8 text-sm w-24" placeholder="0,00" />
                      <span className="text-xs text-orange-700">% (taxa personalizada)</span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-orange-700">{taxaMDR.toFixed(2).replace(".", ",")}%</p>
                  )}
                  <p className="text-[10px] text-orange-600">Taxa será lançada automaticamente em Contas a Pagar.</p>
                </div>
              )}

              {/* Autorização */}
              <div>
                <Label className="text-xs">Código de autorização</Label>
                <Input placeholder="Ex: 123456" value={authCode} onChange={(e) => setAuthCode(e.target.value)} maxLength={20} />
              </div>
            </>
          )}

          {/* ── DUPLO PAGAMENTO ── */}
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={duploPagamento} onCheckedChange={setDuploPagamento} id="duplo-pag" />
            <label htmlFor="duplo-pag" className="text-xs text-slate-600 cursor-pointer select-none">
              Dividir em 2 formas de pagamento
            </label>
          </div>

          {duploPagamento && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600">2ª Forma de Pagamento</p>
              <div>
                <Label className="text-xs">Valor da 2ª forma (R$) *</Label>
                <Input type="number" step="0.01" min="0" placeholder="0,00"
                  value={amount2Str} onChange={(e) => setAmount2Str(e.target.value)} />
                {amount2 > 0 && amountFinal > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    1ª forma: {(amountFinal - amount2).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · 
                    2ª forma: {amount2.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">2ª Forma *</Label>
                <Select value={method2} onValueChange={setMethod2}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {isCard2 && (
                <>
                  <div>
                    <Label className="text-xs">Bandeira *</Label>
                    <Select value={cardBrand2} onValueChange={setCardBrand2}>
                      <SelectTrigger><SelectValue placeholder="Selecione a bandeira" /></SelectTrigger>
                      <SelectContent>
                        {CARD_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Código de autorização</Label>
                    <Input placeholder="Ex: 123456" value={authCode2} onChange={(e) => setAuthCode2(e.target.value)} maxLength={20} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── RESUMO FINANCEIRO ── */}
          {amountFinal > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 divide-y divide-slate-200 overflow-hidden">
              {discount > 0 && (
                <div className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="text-slate-500">Desconto ({discount}%)</span>
                  <span className="text-red-600 font-medium">− {fmtBRLLocal(amountOriginal - amountFinal)}</span>
                </div>
              )}
              <div className="flex justify-between items-center px-3 py-2 text-sm font-semibold">
                <span className="text-slate-700">Valor cobrado</span>
                <span className="text-slate-800">{fmtBRLLocal(amountFinal)}</span>
              </div>
              {isCard && taxaMDR > 0 && (
                <>
                  <div className="flex justify-between items-center px-3 py-2 text-sm">
                    <span className="text-orange-600">Taxa MDR ({taxaMDR.toFixed(2)}%)</span>
                    <span className="text-orange-700 font-medium">− {fmtBRLLocal(valorTaxaMDR)}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 text-sm font-bold bg-white">
                    <span className="text-slate-700">Valor líquido (clínica recebe)</span>
                    <span className="text-emerald-700">{fmtBRLLocal(valorLiquido)}</span>
                  </div>
                  {isCredito && numeroParcelas > 1 && (
                    <div className="px-3 py-2 text-[11px] text-slate-500">
                      ⏱ {numeroParcelas} parcelas de {fmtBRLLocal(parseFloat((valorLiquido / numeroParcelas).toFixed(2)))} líq./parcela · 1ª prevista em ~30 dias
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="gap-1.5">
            <Receipt className="h-4 w-4" /> Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIALOG: CONFIRMAÇÃO DE PRESENÇA
// ══════════════════════════════════════════════════════════════════════════════
function ConfirmPresencaDialog({ open, onOpenChange, appointment, onConfirm }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: AppointmentExt | null;
  onConfirm: (via: string) => void;
}) {
  const [via, setVia] = useState("Telefone");
  const vias = ["Telefone", "WhatsApp", "E-mail", "Pessoalmente", "App"];

  if (!appointment) return null;

  // Se já foi confirmado
  const jaConfirmado = (appointment as any).confirmadoPresenca;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-500" /> Confirmar Presença
          </DialogTitle>
          <DialogDescription>
            {appointment.patientName} — {appointment.date} às {appointment.start}
          </DialogDescription>
        </DialogHeader>

        {jaConfirmado ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Presença já confirmada</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Via {(appointment as any).confirmadoVia} em{" "}
                {(appointment as any).confirmadoEm
                  ? new Date((appointment as any).confirmadoEm).toLocaleString("pt-BR")
                  : "—"}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Como a confirmação foi obtida?</Label>
              <div className="flex flex-wrap gap-2">
                {vias.map((v) => (
                  <button
                    key={v}
                    onClick={() => setVia(v)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      via === v
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              Esta ação registra que o paciente confirmou presença para a consulta.
              O status do agendamento não é alterado.
            </div>
          </div>
        )}

        <DialogFooter>
          {!jaConfirmado && (
            <Button onClick={() => onConfirm(via)} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCheck className="h-4 w-4" /> Marcar como confirmado
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIALOG: LISTA DE ESPERA
// ══════════════════════════════════════════════════════════════════════════════
function WaitlistDialog({ open, onOpenChange, waitlist, professionals, onAdd, onRemove, onSchedule }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  waitlist: WaitlistEntry[];
  professionals: any[];
  onAdd: (entry: Omit<WaitlistEntry, "id" | "createdAt" | "notified">) => void;
  onRemove: (id: string) => void;
  onSchedule: (entry: WaitlistEntry) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    patientName: "", phone: "", professionalId: "", procedure: "",
    insurance: "Particular", preferredDate: "", preferredStart: "", notes: "",
  });
  const [patientQuery, setPatientQuery] = useState("");
  const patientSuggestions = usePatientSearch(patientQuery);

  function submit() {
    if (!form.patientName || !form.professionalId) {
      toast.error("Informe o paciente e o profissional.");
      return;
    }
    onAdd(form);
    setForm({ patientName: "", phone: "", professionalId: "", procedure: "", insurance: "Particular", preferredDate: "", preferredStart: "", notes: "" });
    setAdding(false);
  }

  const sortedList = [...waitlist].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="h-5 w-5 text-amber-600" /> Lista de Espera
            <span className="ml-auto text-sm font-normal text-muted-foreground">{waitlist.length} na fila</span>
          </DialogTitle>
          <DialogDescription>
            Pacientes aguardando vaga. Notificação automática ao cancelar um agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Formulário de adição */}
          {adding ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">Novo paciente na lista de espera</p>

              {/* Busca de paciente */}
              <div className="relative">
                <Label className="text-xs mb-1 block">Paciente *</Label>
                <Input
                  value={patientQuery || form.patientName}
                  onChange={(e) => { setPatientQuery(e.target.value); setForm({ ...form, patientName: e.target.value }); }}
                  placeholder="Nome do paciente..."
                />
                {patientSuggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-white border border-border rounded-xl shadow-lg overflow-hidden">
                    {patientSuggestions.map((p: any) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition"
                        onClick={() => {
                          setForm({ ...form, patientName: p.name, phone: p.phone ?? form.phone, insurance: p.insurance ?? form.insurance });
                          setPatientQuery("");
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.phone && <span className="text-muted-foreground ml-2 text-xs">{p.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Profissional *</Label>
                  <select
                    value={form.professionalId}
                    onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
                    className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Selecione...</option>
                    {professionals.filter((p: any) => (p.tipo ?? "profissional") === "profissional" && p.active).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Procedimento</Label>
                  <Input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} placeholder="Ex: Consulta" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Data preferida</Label>
                  <Input type="date" value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Horário preferido</Label>
                  <Input type="time" value={form.preferredStart} onChange={(e) => setForm({ ...form, preferredStart: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Convênio</Label>
                  <Input value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">Observações</Label>
                <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Urgência, preferências..." />
              </div>
              <div className="flex gap-2">
                <Button onClick={submit} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                  <Plus className="h-4 w-4" /> Adicionar à lista
                </Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setAdding(true)} variant="outline" className="w-full gap-1.5 border-dashed">
              <Plus className="h-4 w-4" /> Adicionar paciente à lista de espera
            </Button>
          )}

          {/* Lista */}
          {sortedList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <ListOrdered className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhum paciente em espera</p>
            </div>
          ) : (
            sortedList.map((entry, idx) => {
              const prof = professionals.find((p: any) => p.id === entry.professionalId);
              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-4 ${entry.notified ? "border-emerald-200 bg-emerald-50" : "border-border bg-card"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white font-bold text-sm shrink-0"
                        style={{ background: prof?.color ?? "#94a3b8" }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{entry.patientName}</p>
                          {entry.notified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                              <BellRing className="h-3 w-3" /> Vaga disponível!
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {prof?.name ?? "—"} · {entry.procedure || "Consulta"} · {entry.insurance}
                        </p>
                        {(entry.preferredDate || entry.preferredStart) && (
                          <p className="text-xs text-sky-600 mt-0.5">
                            Prefere: {entry.preferredDate ? new Date(entry.preferredDate + "T00:00").toLocaleDateString("pt-BR") : "qualquer dia"}
                            {entry.preferredStart ? ` às ${entry.preferredStart}` : ""}
                          </p>
                        )}
                        {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Adicionado em {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                          {entry.phone ? ` · ${entry.phone}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-xs text-primary border-primary/30"
                        onClick={() => onSchedule(entry)}
                        title="Abrir formulário de agendamento"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Agendar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => onRemove(entry.id)}
                        title="Remover da lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIALOG: EDITAR AGENDAMENTO
// ══════════════════════════════════════════════════════════════════════════════
function EditAppointmentDialog({
  open, onOpenChange, appointment, professionals, onSave, isProfAvailableOnDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointment: AppointmentExt | null;
  professionals: any[];
  onSave: (data: Partial<AppointmentExt>) => void;
  isProfAvailableOnDate?: (prof: any, dateStr: string) => boolean;
}) {
  const [profId, setProfId] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("30");
  const [procedure, setProcedure] = useState("");
  const [insurance, setInsurance] = useState("");
  const [procedureValueStr, setProcedureValueStr] = useState("");
  const [phone, setPhone] = useState("");
  const [userEditedValue, setUserEditedValue] = useState(false);

  // Convênios e procedimentos completos (Supabase — cache compartilhado)
  const conveniosFull = useConveniosFull(open);
  const procedimentosFull = useProcedimentosFull(open);
  // Hook que busca o valor automático do procedimento (igual ao dialog de criação)
  const autoValue = useProcedureValue(procedure, insurance, profId, undefined, procedimentosFull, conveniosFull);

  // Preenche os campos quando o dialog abre
  useEffect(() => {
    if (open && appointment) {
      setProfId(appointment.professionalId ?? "");
      setDate(appointment.date ?? "");
      setStart(appointment.start ?? "");
      setDuration(String(appointment.durationMin ?? 30));
      setProcedure(appointment.procedure ?? "");
      setInsurance(appointment.insurance ?? "Particular");
      setProcedureValueStr(appointment.procedureValue ? String(appointment.procedureValue).replace(".", ",") : "");
      setPhone(appointment.phone ?? "");
      setUserEditedValue(false);
    }
  }, [open, appointment]);

  // Atualiza o valor automaticamente ao trocar procedimento ou convênio
  // (somente se o usuário não editou manualmente o campo valor)
  useEffect(() => {
    if (!userEditedValue && autoValue) {
      setProcedureValueStr(autoValue);
    }
  }, [autoValue, userEditedValue]);

  const proceduresList = procedimentosFull.map((p) => p.name);

  const conveniosList = useConveniosNomes(open);
  const [procSearch, setProcSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [procPopoverOpen, setProcPopoverOpen] = useState(false);
  const [convPopoverOpen, setConvPopoverOpen] = useState(false);
  const filteredProcs = proceduresList.filter((n) => n.toLowerCase().includes(procSearch.toLowerCase()));
  const filteredConvs = conveniosList.filter((n) => n.toLowerCase().includes(convSearch.toLowerCase()));

  function submit() {
    if (!date) { toast.error("Informe a data"); return; }
    if (!start) { toast.error("Informe o horário"); return; }
    if (isProfAvailableOnDate) {
      try {
        const saved = localStorage.getItem("nexaclinic_professionals");
        const profs = saved ? JSON.parse(saved) : professionals;
        const prof = profs.find((p: any) => p.id === profId);
        if (prof && !isProfAvailableOnDate(prof, date)) {
          toast.error(`${prof.name} não atende neste dia.`);
          return;
        }
      } catch { /* silencioso */ }
    }
    const procedureValue = procedureValueStr
      ? parseFloat(procedureValueStr.replace(",", "."))
      : undefined;
    onSave({
      professionalId: profId,
      date,
      start,
      durationMin: Number(duration),
      procedure,
      insurance,
      phone: phone.trim() || undefined,
      procedureValue: procedureValue && procedureValue > 0 ? procedureValue : undefined,
    });
  }

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar agendamento</DialogTitle>
          <DialogDescription>{appointment.patientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Profissional */}
          <div>
            <Label className="text-xs">Profissional</Label>
            <select
              value={profId}
              onChange={(e) => setProfId(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
            >
              {professionals.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Data e Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
          </div>

          {/* Duração e Procedimento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Duração (min)</Label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
              >
                {["15","20","30","45","60","90","120"].map((d) => (
                  <option key={d} value={d}>{d} min</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Procedimento</Label>
              <Popover open={procPopoverOpen} onOpenChange={setProcPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-10">
                    <span className={procedure ? "text-foreground" : "text-muted-foreground"}>{procedure || "Selecione..."}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <input
                      className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
                      placeholder="Buscar procedimento..."
                      value={procSearch}
                      onChange={(e) => setProcSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredProcs.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                    )}
                    {filteredProcs.map((name) => (
                      <button key={name} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${procedure === name ? "font-semibold text-primary" : ""}`}
                        onClick={() => { setProcedure(name); setProcSearch(""); setProcPopoverOpen(false); }}>
                        {procedure === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Convênio e Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Convênio</Label>
              <Popover open={convPopoverOpen} onOpenChange={setConvPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 h-10">
                    <span className={insurance ? "text-foreground" : "text-muted-foreground"}>{insurance || "Selecione..."}</span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <input
                      className="w-full text-sm px-2 py-1 outline-none bg-transparent placeholder:text-muted-foreground"
                      placeholder="Buscar convênio..."
                      value={convSearch}
                      onChange={(e) => setConvSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {filteredConvs.length === 0 && (
                      <p className="text-xs text-muted-foreground p-3 text-center">Nenhum resultado</p>
                    )}
                    {filteredConvs.map((name) => (
                      <button key={name} className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2 ${insurance === name ? "font-semibold text-primary" : ""}`}
                        onClick={() => { setInsurance(name); setConvSearch(""); setConvPopoverOpen(false); }}>
                        {insurance === name && <Check className="h-3.5 w-3.5 shrink-0" />}
                        {name}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={procedureValueStr}
                onChange={(e) => { setUserEditedValue(true); setProcedureValueStr(e.target.value); }}
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} className="bg-gradient-primary text-primary-foreground">
            <Pencil className="h-4 w-4" /> Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIALOG: BLOQUEIO DE HORÁRIO
// ══════════════════════════════════════════════════════════════════════════════
function BlockDialog({ open, onOpenChange, professionals, defaults, currentDate, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  professionals: any[];
  defaults: { professionalId?: string; date?: string; start?: string } | null;
  currentDate: string;
  onSave: (block: Omit<AgendaBlock, "id" | "createdAt">) => void;
}) {
  const [form, setForm] = useState({
    professionalId: "",
    date: currentDate,
    start: "12:00",
    end: "13:00",
    reason: "Almoço" as typeof BLOCK_REASONS[number],
  });

  useEffect(() => {
    if (open) {
      setForm({
        professionalId: defaults?.professionalId ?? professionals.find((p: any) => (p.tipo ?? "profissional") === "profissional" && p.active)?.id ?? "",
        date: defaults?.date ?? currentDate,
        start: defaults?.start ?? "12:00",
        end: defaults?.start
          ? `${String(parseInt(defaults.start.split(":")[0]) + 1).padStart(2, "0")}:${defaults.start.split(":")[1]}`
          : "13:00",
        reason: "Almoço",
      });
    }
  }, [open]);

  function save() {
    if (!form.professionalId) { toast.error("Selecione o profissional."); return; }
    if (!form.start || !form.end) { toast.error("Informe início e fim."); return; }
    if (form.start >= form.end) { toast.error("O início deve ser anterior ao fim."); return; }
    onSave(form);
  }

  const reasonIcons: Record<string, string> = {
    "Almoço": "🍽", "Reunião": "📋", "Folga parcial": "🌴", "Feriado interno": "🗓", "Outros": "🔒",
  };

  const profsFiltrados = professionals.filter((p: any) => (p.tipo ?? "profissional") === "profissional" && p.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-slate-600" /> Bloquear Horário
          </DialogTitle>
          <DialogDescription>
            Bloqueia um intervalo de tempo na agenda sem criar agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profissional */}
          <div>
            <Label className="text-xs mb-1.5 block">Profissional *</Label>
            <select
              value={form.professionalId}
              onChange={(e) => setForm({ ...form, professionalId: e.target.value })}
              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">Selecione...</option>
              {profsFiltrados.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <Label className="text-xs mb-1.5 block">Data *</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>

          {/* Horários */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1.5 block">Início *</Label>
              <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Fim *</Label>
              <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>

          {/* Motivo */}
          <div>
            <Label className="text-xs mb-1.5 block">Motivo *</Label>
            <div className="flex flex-wrap gap-2">
              {BLOCK_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setForm({ ...form, reason: r })}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    form.reason === r
                      ? "bg-slate-800 border-slate-800 text-white"
                      : "border-border text-muted-foreground hover:border-slate-400"
                  }`}
                >
                  <span>{reasonIcons[r]}</span> {r}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="rounded-xl border border-dashed border-muted-foreground/30 px-4 py-3 text-xs text-muted-foreground"
            style={{
              background: "repeating-linear-gradient(-45deg, hsl(var(--muted)/0.5), hsl(var(--muted)/0.5) 4px, hsl(var(--muted)/0.3) 4px, hsl(var(--muted)/0.3) 8px)",
            }}
          >
            <span className="font-semibold">{reasonIcons[form.reason]} {form.reason}</span>
            {" · "}
            {form.date ? new Date(form.date + "T00:00").toLocaleDateString("pt-BR") : "—"}
            {" · "}
            {form.start}–{form.end}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} className="gap-1.5 bg-slate-800 hover:bg-slate-700 text-white">
            <Lock className="h-4 w-4" /> Salvar Bloqueio
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIALOG: IMPRIMIR AGENDA
// ══════════════════════════════════════════════════════════════════════════════
function PrintAgendaDialog({
  open, onOpenChange, appointments, professionals, defaultDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  appointments: AppointmentExt[];
  professionals: any[];
  defaultDate: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [profId, setProfId] = useState<string>("todos");

  useEffect(() => {
    if (open) { setDate(defaultDate); setProfId("todos"); }
  }, [open, defaultDate]);

  const profissionais = useMemo(
    () => professionals.filter((p: any) => (p.tipo ?? "profissional") === "profissional"),
    [professionals]
  );

  const agendamentosFiltrados = useMemo(() => {
    return appointments
      .filter((a) => {
        if (a.status === "cancelado") return false;
        if (a.date !== date) return false;
        if (profId !== "todos" && a.professionalId !== profId) return false;
        return true;
      })
      .sort((a, b) => {
        if (profId === "todos") {
          const pa = professionals.find((p: any) => p.id === a.professionalId)?.name ?? "";
          const pb = professionals.find((p: any) => p.id === b.professionalId)?.name ?? "";
          if (pa !== pb) return pa.localeCompare(pb);
        }
        return a.start.localeCompare(b.start);
      });
  }, [appointments, date, profId, professionals]);

  const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
    agendado:   { label: "Agendado",   color: "#2563eb", bg: "#eff6ff" },
    confirmado: { label: "Confirmado", color: "#059669", bg: "#f0fdf4" },
    atendido:   { label: "Atendido",   color: "#7c3aed", bg: "#f5f3ff" },
    faltou:     { label: "Faltou",     color: "#d97706", bg: "#fffbeb" },
    cancelado:  { label: "Cancelado",  color: "#dc2626", bg: "#fef2f2" },
  };

  function handlePrint() {
    const cfg = (() => { try { return JSON.parse(localStorage.getItem("nexaclinic_config") ?? "{}"); } catch { return {}; } })();
    const clinicName: string = cfg.clinicName ?? "Clínica";
    const clinicPhone: string = cfg.phone ?? cfg.telefone ?? "";
    const clinicAddress: string = cfg.address ?? cfg.endereco ?? "";

    const profNome = profId === "todos"
      ? "Todos os profissionais"
      : (professionals.find((p: any) => p.id === profId)?.name ?? "");

    const dataBR = date
      ? new Date(date + "T00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
      : "";

    // Agrupa por profissional
    const grupos: { profNome: string; itens: AppointmentExt[] }[] = [];
    if (profId === "todos") {
      const map = new Map<string, AppointmentExt[]>();
      agendamentosFiltrados.forEach((a) => {
        if (!map.has(a.professionalId)) map.set(a.professionalId, []);
        map.get(a.professionalId)!.push(a);
      });
      map.forEach((itens, pid) => {
        const nome = professionals.find((p: any) => p.id === pid)?.name ?? pid;
        grupos.push({ profNome: nome, itens });
      });
    } else {
      grupos.push({ profNome, itens: agendamentosFiltrados });
    }

    const totalGeral = agendamentosFiltrados.reduce((s, a) => s + (a.procedureValue ?? 0), 0);

    const gruposHTML = grupos.map(({ profNome: pn, itens }) => {
      const linhas = itens.map((a, idx) => {
        const sb = statusBadge[a.status as string] ?? { label: a.status, color: "#64748b", bg: "#f8fafc" };
        const valor = a.procedureValue
          ? a.procedureValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—";
        const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        return `
          <tr>
            <td style="padding:9px 12px;background:${rowBg};font-weight:700;color:#1e293b;white-space:nowrap;font-size:13px;border-bottom:1px solid #f1f5f9">${a.start}</td>
            <td style="padding:9px 12px;background:${rowBg};color:#1e293b;font-size:13px;border-bottom:1px solid #f1f5f9;font-weight:500">${a.patientName}</td>
            <td style="padding:9px 12px;background:${rowBg};color:#475569;font-size:12px;border-bottom:1px solid #f1f5f9">${a.procedure ?? "—"}</td>
            <td style="padding:9px 12px;background:${rowBg};color:#475569;font-size:12px;border-bottom:1px solid #f1f5f9">${a.insurance ?? "Particular"}</td>
            <td style="padding:9px 12px;background:${rowBg};border-bottom:1px solid #f1f5f9">
              <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${sb.bg};color:${sb.color};border:1px solid ${sb.color}30">${sb.label}</span>
            </td>
            <td style="padding:9px 12px;background:${rowBg};color:#1e293b;font-size:13px;font-weight:600;text-align:right;white-space:nowrap;border-bottom:1px solid #f1f5f9">${valor}</td>
          </tr>`;
      }).join("");

      const subtotal = itens.reduce((s, a) => s + (a.procedureValue ?? 0), 0);
      const subtotalStr = subtotal > 0 ? subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

      return `
        <div style="margin-bottom:32px;break-inside:avoid">
          ${profId === "todos" ? `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:4px;height:20px;background:linear-gradient(180deg,#0ea5e9,#6366f1);border-radius:2px"></div>
            <h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:0">${pn}</h3>
          </div>` : ""}
          <table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
            <thead>
              <tr style="background:linear-gradient(135deg,#0f172a,#1e293b)">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Horário</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Paciente</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Procedimento</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Convênio</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Status</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.06em;text-transform:uppercase">Valor</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
            <tfoot>
              <tr style="background:#f8fafc;border-top:2px solid #e2e8f0">
                <td colspan="4" style="padding:9px 12px;font-size:12px;color:#64748b">
                  <strong>${itens.length}</strong> agendamento${itens.length !== 1 ? "s" : ""}
                </td>
                <td colspan="2" style="padding:9px 12px;text-align:right;font-weight:700;color:#0f172a;font-size:13px">
                  ${subtotalStr}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }).join("");

    const totalGeralHTML = grupos.length > 1 && totalGeral > 0 ? `
      <div style="margin-top:8px;padding:12px 16px;background:#0f172a;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:#94a3b8">${agendamentosFiltrados.length} agendamentos no total</span>
        <span style="font-size:15px;font-weight:800;color:#ffffff">${totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
      </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Agenda – ${clinicName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #0f172a; }
    .page { padding: 32px 36px; max-width: 900px; margin: 0 auto; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: 100%; }
      @page { margin: 14mm 16mm; size: A4 portrait; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Cabeçalho -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:3px solid #0f172a;margin-bottom:24px">
    <div>
      <div style="font-size:22px;font-weight:900;color:#0f172a;letter-spacing:-0.5px">${clinicName}</div>
      ${clinicAddress ? `<div style="font-size:12px;color:#64748b;margin-top:3px">${clinicAddress}</div>` : ""}
      ${clinicPhone ? `<div style="font-size:12px;color:#64748b;margin-top:1px">📞 ${clinicPhone}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="display:inline-block;background:#f1f5f9;border-radius:8px;padding:10px 16px;text-align:right">
        <div style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Relatório de Agenda</div>
        <div style="font-size:15px;font-weight:800;color:#0f172a;margin-top:3px;text-transform:capitalize">${dataBR}</div>
        ${profId !== "todos" ? `<div style="font-size:12px;color:#475569;margin-top:2px;font-weight:600">${profNome}</div>` : `<div style="font-size:12px;color:#475569;margin-top:2px">Todos os profissionais</div>`}
      </div>
    </div>
  </div>

  <!-- Conteúdo -->
  ${agendamentosFiltrados.length === 0
    ? `<div style="text-align:center;padding:60px 0;color:#94a3b8">
        <div style="font-size:36px;margin-bottom:12px">📅</div>
        <div style="font-size:15px;font-weight:600">Nenhum agendamento encontrado</div>
        <div style="font-size:13px;margin-top:4px">para os filtros selecionados</div>
      </div>`
    : gruposHTML + totalGeralHTML
  }

  <!-- Rodapé -->
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:10px;color:#cbd5e1">Documento gerado pelo NexaClinic</span>
    <span style="font-size:10px;color:#cbd5e1">Impresso em ${new Date().toLocaleString("pt-BR")}</span>
  </div>

</div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=960,height=750");
    if (!w) { alert("Permita pop-ups para imprimir."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  }

  const dataBRPreview = date
    ? new Date(date + "T00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🖨️ Imprimir Agenda
          </DialogTitle>
          <DialogDescription>
            Escolha a data e o profissional para gerar o relatório.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Data */}
          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
            {dataBRPreview && (
              <p className="text-xs text-slate-500 mt-1 capitalize">{dataBRPreview}</p>
            )}
          </div>

          {/* Profissional */}
          <div>
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Profissional</Label>
            <select
              value={profId}
              onChange={(e) => setProfId(e.target.value)}
              className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
            >
              <option value="todos">Todos os profissionais</option>
              {profissionais.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Prévia */}
          {date && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Prévia — {agendamentosFiltrados.length} agendamento{agendamentosFiltrados.length !== 1 ? "s" : ""}
              </p>
              {agendamentosFiltrados.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-2">Nenhum agendamento nesta data / profissional.</p>
              ) : (
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {agendamentosFiltrados.map((a) => {
                    const sb = statusBadge[a.status as string] ?? { label: a.status, color: "#64748b", bg: "#f8fafc" };
                    return (
                      <div key={a.id} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-2 border border-slate-100">
                        <span className="font-mono font-bold text-slate-700 w-10 shrink-0">{a.start}</span>
                        <span className="font-medium text-slate-800 flex-1 truncate">{a.patientName}</span>
                        <span className="text-slate-400 truncate max-w-[80px] hidden sm:block">{a.procedure}</span>
                        <span className="text-slate-400 truncate max-w-[70px] hidden sm:block">{a.insurance ?? "Particular"}</span>
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.color}30` }}
                        >{sb.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {agendamentosFiltrados.length > 0 && agendamentosFiltrados.some(a => a.procedureValue) && (
                <p className="text-xs text-slate-400 mt-2 text-right font-semibold">
                  Total previsto: {agendamentosFiltrados.reduce((s, a) => s + (a.procedureValue ?? 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handlePrint}
            disabled={!date || agendamentosFiltrados.length === 0}
            className="bg-slate-800 hover:bg-slate-700 text-white gap-2"
          >
            🖨️ Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
