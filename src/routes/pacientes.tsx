import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { eAdmin, registrarAuditoria } from "@/lib/auth";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, Search, Phone, Mail, Pencil, Trash2, CheckCircle2, AlertCircle,
  FileText, Calendar, Clock, ChevronDown, ChevronUp, Camera, Upload,
  X, Download, Eye, AlertTriangle, User, CreditCard, MapPin, Heart,
  DollarSign, Paperclip, ImageIcon, History, Activity,
} from "lucide-react";
import { Card }   from "@/components/ui/card";
import { Input }  from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge }  from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { patientStore } from "@/lib/patient-store";
import { type Patient } from "@/lib/mock-data";
import { CadastroCompletoDialog } from "@/components/CadastroCompletoDialog";
import { ImportarPacientesDialog } from "@/components/ImportarPacientesDialog";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface AppointmentExt {
  id: string; patientName: string; patientId?: string;
  professionalId: string; date?: string; start: string;
  durationMin: number; procedure: string; insurance: string;
  status: string; paid?: boolean; amount?: number; procedureValue?: number;
  cancelReason?: string; paymentMethod?: string;
}

interface Anexo {
  id: string; nome: string; tipo: "imagem" | "pdf" | "outro";
  tamanho: number; dataUpload: string; base64: string;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const APPT_KEY   = "nexaclinic_appointments_v3";
const ANEXOS_KEY = "nexaclinic_paciente_anexos";

function loadAppts(): AppointmentExt[] {
  try { return JSON.parse(localStorage.getItem(APPT_KEY) ?? "[]"); } catch { return []; }
}
function loadAnexos(pid: string): Anexo[] {
  try { return (JSON.parse(localStorage.getItem(ANEXOS_KEY) ?? "{}"))[pid] ?? []; } catch { return []; }
}
function saveAnexos(pid: string, anexos: Anexo[]) {
  try {
    const all = JSON.parse(localStorage.getItem(ANEXOS_KEY) ?? "{}");
    all[pid] = anexos;
    localStorage.setItem(ANEXOS_KEY, JSON.stringify(all));
  } catch { /* */ }
}

// ─── Helpers gerais ───────────────────────────────────────────────────────────
const fmtBRL   = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;

function calcIdade(birth: string) {
  if (!birth) return "—";
  return `${Math.floor((Date.now() - new Date(birth + "T00:00:00").getTime()) / 31557600000)} anos`;
}
function calcCompletude(p: Patient): number {
  const campos: (keyof Patient)[] = ["cpf","birth","phone","email","cep","endereco","alergias","tipoSanguineo","contatoEmergenciaNome"];
  return Math.round(campos.filter(k => !!p[k]).length / campos.length * 100);
}
function iniciais(name: string) { return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(); }

// Retorno vencido: última consulta finalizada há mais de 180 dias
function alertaRetorno(pid: string, pname: string): { vencido: boolean; dias: number } | null {
  const apts = loadAppts().filter(a =>
    a.status === "finalizado" &&
    (a.patientId === pid || a.patientName?.toLowerCase() === pname.toLowerCase())
  );
  if (!apts.length) return null;
  const ultima = apts.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))[0];
  if (!ultima.date) return null;
  const dias = Math.floor((Date.now() - new Date(ultima.date + "T12:00:00").getTime()) / 86400000);
  return { vencido: dias > 180, dias };
}

// ─── Status badge ──────────────────────────────────────────────────────────────
const ST: Record<string, { label: string; cls: string }> = {
  agendado:       { label: "Agendado",       cls: "bg-blue-100 text-blue-700 border-blue-200" },
  confirmado:     { label: "Confirmado",     cls: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  aguardando:     { label: "Aguardando",     cls: "bg-amber-100 text-amber-700 border-amber-200" },
  em_atendimento: { label: "Em atendimento", cls: "bg-purple-100 text-purple-700 border-purple-200" },
  finalizado:     { label: "Finalizado",     cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  cancelado:      { label: "Cancelado",      cls: "bg-red-100 text-red-700 border-red-200" },
  faltou:         { label: "Faltou",         cls: "bg-slate-100 text-slate-500 border-slate-200" },
};
function SBadge({ s }: { s: string }) {
  const info = ST[s] ?? { label: s, cls: "bg-slate-100 text-slate-500 border-slate-200" };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${info.cls}`}>{info.label}</span>;
}

// ─── Avatar com upload ────────────────────────────────────────────────────────
function AvatarUpload({ src, nome, size = "md", onSave }: {
  src?: string; nome: string; size?: "sm" | "md" | "lg"; onSave: (b64: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [hov, setHov] = useState(false);
  const dim  = size === "sm" ? "h-9 w-9"  : size === "lg" ? "h-20 w-20" : "h-14 w-14";
  const txt  = size === "sm" ? "text-[10px]" : size === "lg" ? "text-base" : "text-xs";
  const ico  = size === "sm" ? "h-3 w-3"  : size === "lg" ? "h-5 w-5"  : "h-4 w-4";

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2097152) { toast.error("Imagem muito grande. Máximo 2 MB."); return; }
    const r = new FileReader();
    r.onload = ev => { if (ev.target?.result) onSave(ev.target.result as string); };
    r.readAsDataURL(f);
    e.target.value = "";
  }

  return (
    <div className={`relative ${dim} shrink-0 cursor-pointer`}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      onClick={() => ref.current?.click()}>
      <Avatar className={dim}>
        {src && <AvatarImage src={src} className="object-cover" />}
        <AvatarFallback className={`bg-gradient-to-br from-cyan-500 to-blue-600 ${txt} font-bold text-white`}>
          {iniciais(nome)}
        </AvatarFallback>
      </Avatar>
      {hov && (
        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
          <Camera className={`${ico} text-white`} />
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handle} />
    </div>
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/pacientes")({
  head: () => ({ meta: [{ title: "Pacientes — NexaClinic" }] }),
  component: PacientesPage,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
function PacientesPage() {
  const navigate = useNavigate();
  const [q, setQ]           = useState("");
  const [filtro, setFiltro] = useState<"todos" | "ativo" | "inativo" | "alerta">("todos");
  const [patients, setPatients] = useState<Patient[]>(() => patientStore.getAll());
  const [formOpen, setFormOpen]       = useState(false);
  const [importOpen, setImportOpen]   = useState(false);
  const [editingPat, setEditingPat]   = useState<Patient | null>(null);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [perfilPat, setPerfilPat]   = useState<Patient | null>(null);

  useEffect(() => {
    setPatients(patientStore.getAll());
    return patientStore.subscribe(() => setPatients(patientStore.getAll()));
  }, []);

  // Enriquece com alerta de retorno (sem re-calc a cada render)
  const enriched = useMemo(() => patients.map(p => ({
    ...p,
    _alerta: alertaRetorno(p.id, p.name),
  })), [patients]);

  const totalAlertas = enriched.filter(p => p._alerta?.vencido).length;

  const filtered = useMemo(() => enriched.filter(p => {
    const matchQ = [p.name, p.cpf, p.email, p.phone].some(f => (f ?? "").toLowerCase().includes(q.toLowerCase()));
    if (!matchQ) return false;
    if (filtro === "ativo")   return p.status === "ativo";
    if (filtro === "inativo") return p.status === "inativo";
    if (filtro === "alerta")  return p._alerta?.vencido === true;
    return true;
  }), [enriched, q, filtro]);

  function openCreate() { setEditingPat(null); setFormOpen(true); }
  function openEdit(p: Patient) { setEditingPat(p); setFormOpen(true); }

  function handleDelete() {
    if (!deleteId) return;
    const removido = patients.find(p => p.id === deleteId);
    patientStore.remove(deleteId);
    registrarAuditoria("EXCLUIR_PACIENTE", `"${removido?.name ?? deleteId}" excluído`);
    toast.success("Paciente removido");
    setDeleteId(null);
  }

  function handleAvatarSave(id: string, b64: string) {
    patientStore.update(id, { avatar: b64 } as any);
  }

  return (
    <div className="space-y-4 p-5 -mt-4 max-w-[1400px] mx-auto">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Pacientes</h1>
          <p className="text-sm text-slate-400 mt-0.5">{patients.length} cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setImportOpen(true)} variant="outline" className="gap-2 border-cyan-200 text-cyan-700 hover:bg-cyan-50">
            <Upload className="h-4 w-4" /> Importar planilha
          </Button>
          <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> Novo paciente
          </Button>
        </div>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, CPF, e-mail ou telefone…" className="pl-9" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([
            ["todos",   `Todos (${patients.length})`],
            ["ativo",   `Ativos (${patients.filter(p=>p.status==="ativo").length})`],
            ["inativo", `Inativos (${patients.filter(p=>p.status==="inativo").length})`],
          ] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v as any)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${filtro===v ? "bg-cyan-600 text-white border-cyan-600" : "bg-white border-slate-200 text-slate-500 hover:border-cyan-300"}`}>
              {l}
            </button>
          ))}
          {totalAlertas > 0 && (
            <button onClick={() => setFiltro(filtro === "alerta" ? "todos" : "alerta")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${filtro==="alerta" ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100"}`}>
              <AlertTriangle className="h-3.5 w-3.5" />{totalAlertas} retorno(s) vencido(s)
            </button>
          )}
        </div>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────── */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-slate-400">
            <User className="h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum paciente encontrado.</p>
            <Button size="sm" onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-1">
              <Plus className="h-4 w-4" /> Cadastrar paciente
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Paciente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Convênio</TableHead>
                <TableHead>Última visita</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const pct      = calcCompletude(p);
                const completo = p.cadastroCompleto ?? pct >= 70;
                const alerta   = p._alerta;
                return (
                  <TableRow key={p.id}
                    className={`hover:bg-slate-50 transition ${alerta?.vencido ? "bg-orange-50/40" : ""}`}>

                    {/* Avatar + nome clicável */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <AvatarUpload
                          src={(p as any).avatar}
                          nome={p.name}
                          size="sm"
                          onSave={b64 => handleAvatarSave(p.id, b64)}
                        />
                        <div>
                          <button onClick={() => setPerfilPat(p)}
                            className="text-sm font-semibold text-slate-800 hover:text-cyan-600 transition text-left leading-tight">
                            {p.name}
                          </button>
                          <p className="text-xs text-slate-400">{calcIdade(p.birth)}</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="font-mono text-xs text-slate-500">{p.cpf || "—"}</TableCell>

                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600"><Phone className="h-3 w-3 text-slate-400"/>{p.phone||"—"}</div>
                        <div className="flex items-center gap-1.5 text-slate-400"><Mail className="h-3 w-3"/>{p.email||"—"}</div>
                      </div>
                    </TableCell>

                    <TableCell><Badge variant="secondary" className="text-xs">{p.insurance}</Badge></TableCell>

                    <TableCell className="text-sm text-slate-500">
                      {p.lastVisit ? new Date(p.lastVisit+"T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </TableCell>

                    <TableCell>
                      {completo
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5"/>Completo</span>
                        : <button onClick={() => openEdit(p)} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium transition">
                            <AlertCircle className="w-3.5 h-3.5"/>{pct}% completo
                          </button>
                      }
                    </TableCell>

                    {/* Alerta de retorno */}
                    <TableCell>
                      {alerta?.vencido
                        ? <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <AlertTriangle className="h-3 w-3"/>{alerta.dias}d sem retorno
                          </span>
                        : alerta
                          ? <span className="text-xs text-emerald-600 font-medium">Em dia</span>
                          : <span className="text-xs text-slate-300">—</span>
                      }
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <button title="Ver perfil" onClick={() => setPerfilPat(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                          <Eye className="h-3.5 w-3.5"/>
                        </button>
                        <button title="Prontuário"
                          onClick={() => navigate({ to: "/prontuario", search: { patientId: p.id } as any })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                          <FileText className="h-3.5 w-3.5"/>
                        </button>
                        <button title="Editar" onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition">
                          <Pencil className="h-3.5 w-3.5"/>
                        </button>
                        <button title="Excluir" onClick={() => setDeleteId(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
                          style={{ display: eAdmin() ? undefined : "none" }}>
                          <Trash2 className="h-3.5 w-3.5"/>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Perfil drawer ─────────────────────────────────────────── */}
      <PerfilDrawer
        patient={perfilPat}
        onClose={() => setPerfilPat(null)}
        onEdit={p => { setPerfilPat(null); openEdit(p); }}
        onProntuario={p => { setPerfilPat(null); navigate({ to: "/prontuario", search: { patientId: p.id } as any }); }}
        onAvatarSave={(id, b64) => {
          handleAvatarSave(id, b64);
          setPerfilPat(prev => prev ? { ...prev, avatar: b64 } as any : null);
        }}
      />

      {/* ── Importar planilha ────────────────────────────────────── */}
      <ImportarPacientesDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onConcluido={() => setPatients(patientStore.getAll())}
      />

      {/* ── Cadastro / edição ─────────────────────────────────────── */}
      <CadastroCompletoDialog
        open={formOpen} onOpenChange={setFormOpen}
        patient={editingPat}
        onSave={() => { setFormOpen(false); setPatients(patientStore.getAll()); }}
        origem="pacientes"
      />

      {/* ── Confirmar exclusão ────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover paciente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFIL DRAWER
// ═══════════════════════════════════════════════════════════════════════════════
type Aba = "resumo" | "historico" | "documentos" | "dados";

function PerfilDrawer({ patient, onClose, onEdit, onProntuario, onAvatarSave }: {
  patient: Patient | null;
  onClose: () => void;
  onEdit: (p: Patient) => void;
  onProntuario: (p: Patient) => void;
  onAvatarSave: (id: string, b64: string) => void;
}) {
  const [aba, setAba]           = useState<Aba>("resumo");
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anexos, setAnexos]     = useState<Anexo[]>([]);
  const [preview, setPreview]   = useState<Anexo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (patient) { setAnexos(loadAnexos(patient.id)); setAba("resumo"); setExpandido(null); }
  }, [patient?.id]);

  if (!patient) return null;

  const todos        = loadAppts();
  const atendimentos = todos
    .filter(a => a.patientId === patient.id || a.patientName?.toLowerCase() === patient.name.toLowerCase())
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const finalizados  = atendimentos.filter(a => a.status === "finalizado").length;
  const cancelados   = atendimentos.filter(a => a.status === "cancelado").length;
  const receitaTotal = atendimentos.filter(a => a.paid).reduce((s, a) => s + Number(a.amount || a.procedureValue || 0), 0);
  const alerta       = alertaRetorno(patient.id, patient.name);

  const proximos = todos
    .filter(a => a.date && new Date(a.date + "T12:00:00") >= new Date()
      && !["cancelado","faltou","finalizado"].includes(a.status)
      && (a.patientId === patient.id || a.patientName?.toLowerCase() === patient.name.toLowerCase()))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")).slice(0, 3);

  // Upload de documento
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 10485760) { toast.error("Arquivo muito grande. Máximo 10 MB."); return; }
    const r = new FileReader();
    r.onload = ev => {
      if (!ev.target?.result) return;
      const tipo: Anexo["tipo"] = f.type.startsWith("image/") ? "imagem" : f.type === "application/pdf" ? "pdf" : "outro";
      const novo: Anexo = {
        id: `anx_${Date.now()}`,
        nome: f.name, tipo,
        tamanho: f.size,
        dataUpload: new Date().toISOString().split("T")[0],
        base64: ev.target.result as string,
      };
      const novos = [...anexos, novo];
      setAnexos(novos); saveAnexos(patient.id, novos);
      toast.success(`"${f.name}" anexado`);
    };
    r.readAsDataURL(f);
    e.target.value = "";
  }

  function removeAnexo(id: string) {
    const novos = anexos.filter(a => a.id !== id);
    setAnexos(novos); saveAnexos(patient.id, novos);
    toast.success("Anexo removido");
  }

  const abas: { id: Aba; l: string; icon: React.ElementType }[] = [
    { id: "resumo",     l: "Resumo",     icon: User },
    { id: "historico",  l: "Histórico",  icon: History },
    { id: "documentos", l: "Documentos", icon: Paperclip },
    { id: "dados",      l: "Dados",      icon: FileText },
  ];

  return (
    <>
      <Sheet open={!!patient} onOpenChange={o => !o && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-[560px] p-0 flex flex-col overflow-hidden">

          {/* ── Cabeçalho ────────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-6 pb-5 shrink-0">
            <div className="flex items-start gap-4">
              <AvatarUpload
                src={(patient as any).avatar}
                nome={patient.name}
                size="lg"
                onSave={b64 => onAvatarSave(patient.id, b64)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white leading-tight">{patient.name}</h2>
                    <p className="text-slate-400 text-sm mt-0.5">
                      {calcIdade(patient.birth)}{patient.birth && " · "}{patient.birth && new Date(patient.birth + "T00:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 text-xs ${patient.status === "ativo" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-slate-500/40 text-slate-400"}`}>
                    {patient.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-400">
                  {patient.phone    && <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{patient.phone}</span>}
                  {patient.insurance && <span className="flex items-center gap-1"><CreditCard className="h-3 w-3"/>{patient.insurance}</span>}
                </div>
                {alerta?.vencido && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-300 bg-orange-500/15 border border-orange-500/30 px-2.5 py-1.5 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5"/> Última consulta há {alerta.dias} dias — retorno vencido
                  </div>
                )}
              </div>
            </div>

            {/* KPIs mini */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { l:"Consultas",  v: atendimentos.length,   icon: Activity,   c:"text-cyan-400" },
                { l:"Finaliz.",   v: finalizados,            icon: CheckCircle2, c:"text-emerald-400" },
                { l:"Cancelados", v: cancelados,             icon: X,          c:"text-red-400" },
                { l:"Receita",    v: receitaTotal > 0 ? `R$${(receitaTotal/1000).toFixed(1)}k` : "—", icon: DollarSign, c:"text-amber-400" },
              ].map(k => {
                const Icon = k.icon;
                return (
                  <div key={k.l} className="bg-white/5 rounded-xl px-2 py-2 text-center">
                    <Icon className={`h-4 w-4 mx-auto mb-1 ${k.c}`}/>
                    <p className="text-sm font-bold text-white">{k.v}</p>
                    <p className="text-[10px] text-slate-500">{k.l}</p>
                  </div>
                );
              })}
            </div>

            {/* Ações */}
            <div className="flex gap-2 mt-3">
              <button onClick={() => onProntuario(patient)}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-2 rounded-xl transition">
                <FileText className="h-3.5 w-3.5"/> Prontuário
              </button>
              <button onClick={() => onEdit(patient)}
                className="flex items-center justify-center gap-1.5 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl transition">
                <Pencil className="h-3.5 w-3.5"/> Editar
              </button>
            </div>
          </div>

          {/* ── Abas ─────────────────────────────────────────────── */}
          <div className="flex border-b border-slate-200 bg-white shrink-0 px-2">
            {abas.map(a => {
              const Icon = a.icon;
              const active = aba === a.id;
              return (
                <button key={a.id} onClick={() => setAba(a.id)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition ${active ? "border-cyan-600 text-cyan-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
                  <Icon className="h-3.5 w-3.5"/>{a.l}
                  {a.id === "documentos" && anexos.length > 0 && (
                    <span className="bg-cyan-100 text-cyan-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{anexos.length}</span>
                  )}
                  {a.id === "historico" && atendimentos.length > 0 && (
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{atendimentos.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Conteúdo ─────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5">

            {/* RESUMO */}
            {aba === "resumo" && (
              <div className="space-y-5">
                {/* Próximos */}
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Próximos agendamentos</p>
                  {proximos.length === 0
                    ? <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">Nenhum agendamento futuro</div>
                    : proximos.map(a => (
                        <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center shrink-0">
                            <Calendar className="h-4 w-4 text-cyan-600"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{a.procedure || "Consulta"}</p>
                            <p className="text-xs text-slate-400">{a.date ? new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR") : "—"} · {a.start}</p>
                          </div>
                          <SBadge s={a.status}/>
                        </div>
                      ))
                  }
                </div>

                {/* Dados clínicos */}
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Dados clínicos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { l:"Tipo sanguíneo", v: patient.tipoSanguineo },
                      { l:"Alergias",       v: patient.alergias },
                      { l:"Medicamentos",   v: patient.medicamentos },
                      { l:"Doenças",        v: (patient as any).doencas },
                    ].map(x => (
                      <div key={x.l} className={`rounded-xl border border-slate-100 bg-slate-50 p-3 ${!x.v ? "opacity-40" : ""}`}>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">{x.l}</p>
                        <p className="text-sm text-slate-700 font-medium leading-snug">{x.v || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emergência */}
                {patient.contatoEmergenciaNome && (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Contato de emergência</p>
                    <div className="rounded-xl border border-red-100 bg-red-50 p-3 space-y-1">
                      <p className="text-sm font-semibold text-slate-700">{patient.contatoEmergenciaNome}</p>
                      {patient.contatoEmergenciaParentesco && <p className="text-xs text-slate-500">{patient.contatoEmergenciaParentesco}</p>}
                      {patient.contatoEmergenciaTelefone  && <p className="text-xs text-slate-600 flex items-center gap-1"><Phone className="h-3 w-3"/>{patient.contatoEmergenciaTelefone}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* HISTÓRICO */}
            {aba === "historico" && (
              <div className="space-y-2">
                {atendimentos.length === 0
                  ? <div className="flex flex-col items-center gap-3 py-14 text-center text-slate-400">
                      <Calendar className="h-10 w-10 opacity-20"/>
                      <p className="text-sm">Nenhum atendimento registrado.</p>
                    </div>
                  : atendimentos.map(a => {
                      const dataFmt = a.date ? new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"numeric" }) : "—";
                      const v = Number(a.amount || a.procedureValue || 0);
                      return (
                        <div key={a.id} className="border border-slate-200 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandido(expandido === a.id ? null : a.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              <Calendar className="h-3.5 w-3.5 text-slate-500"/>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-700 truncate">{a.procedure || "Consulta"}</p>
                              <p className="text-xs text-slate-400">{dataFmt} · {a.start}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <SBadge s={a.status}/>
                              {v > 0 && <span className="text-xs font-semibold text-slate-600">{fmtBRL(v)}</span>}
                              {expandido === a.id ? <ChevronUp className="h-3.5 w-3.5 text-slate-400"/> : <ChevronDown className="h-3.5 w-3.5 text-slate-400"/>}
                            </div>
                          </button>
                          {expandido === a.id && (
                            <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 grid grid-cols-2 gap-2">
                              {[
                                ["Convênio",     a.insurance],
                                ["Duração",      a.durationMin ? `${a.durationMin} min` : null],
                                ["Pagamento",    a.paid ? `${fmtBRL(v)} · ${(a as any).paymentMethod ?? ""}`.trimEnd().replace(/ · $/, "") : "Não registrado"],
                                ["Motivo canc.", a.cancelReason],
                              ].map(([l, val]) => val ? (
                                <div key={l as string}>
                                  <p className="text-[10px] font-bold uppercase text-slate-400">{l}</p>
                                  <p className="text-xs text-slate-700 font-medium leading-snug">{val}</p>
                                </div>
                              ) : null)}
                            </div>
                          )}
                        </div>
                      );
                    })
                }
              </div>
            )}

            {/* DOCUMENTOS */}
            {aba === "documentos" && (
              <div className="space-y-3">
                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition group">
                  <Upload className="h-8 w-8 mx-auto text-slate-300 group-hover:text-cyan-500 transition mb-2"/>
                  <p className="text-sm font-semibold text-slate-600 group-hover:text-cyan-700">Clique para anexar arquivo</p>
                  <p className="text-xs text-slate-400 mt-1">Imagens, PDF e outros · máx. 10 MB</p>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFile}/>
                </div>

                {/* Lista */}
                {anexos.length === 0
                  ? <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-400">
                      <Paperclip className="h-8 w-8 opacity-20"/>
                      <p className="text-sm">Nenhum documento ainda</p>
                    </div>
                  : <div className="space-y-2">
                      {anexos.map(anx => (
                        <div key={anx.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50 transition">
                          {/* Thumb */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center">
                            {anx.tipo === "imagem"
                              ? <img src={anx.base64} alt={anx.nome} className="w-full h-full object-cover"/>
                              : anx.tipo === "pdf"
                                ? <FileText className="h-5 w-5 text-red-400"/>
                                : <Paperclip className="h-5 w-5 text-slate-400"/>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{anx.nome}</p>
                            <p className="text-xs text-slate-400">{fmtBytes(anx.tamanho)} · {new Date(anx.dataUpload+"T12:00:00").toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {anx.tipo === "imagem" && (
                              <button title="Visualizar" onClick={() => setPreview(anx)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 transition">
                                <Eye className="h-3.5 w-3.5"/>
                              </button>
                            )}
                            <button title="Baixar" onClick={() => { const a = document.createElement("a"); a.href = anx.base64; a.download = anx.nome; a.click(); }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                              <Download className="h-3.5 w-3.5"/>
                            </button>
                            <button title="Remover" onClick={() => removeAnexo(anx.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                              <X className="h-3.5 w-3.5"/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
            )}

            {/* DADOS COMPLETOS */}
            {aba === "dados" && (
              <div className="space-y-5 text-sm">
                {[
                  { t:"Identificação", icon:<User className="h-4 w-4 text-slate-400"/>, campos:[
                    ["Nome",           patient.name],
                    ["CPF",            patient.cpf],
                    ["RG",             patient.rg],
                    ["Nascimento",     patient.birth ? new Date(patient.birth+"T00:00:00").toLocaleDateString("pt-BR") : null],
                    ["Sexo",           patient.sexo],
                    ["Estado civil",   patient.estadoCivil],
                    ["Profissão",      patient.profissao],
                    ["Mãe",            patient.nomeMae],
                    ["Pai",            patient.nomePai],
                  ]},
                  { t:"Contato", icon:<Phone className="h-4 w-4 text-slate-400"/>, campos:[
                    ["Telefone",  patient.phone],
                    ["Telefone 2",patient.telefone2],
                    ["E-mail",    patient.email],
                  ]},
                  { t:"Endereço", icon:<MapPin className="h-4 w-4 text-slate-400"/>, campos:[
                    ["CEP",     patient.cep],
                    ["Endereço",patient.endereco],
                    ["Número",  patient.numero],
                    ["Bairro",  patient.bairro],
                    ["Cidade",  patient.cidade],
                    ["Estado",  patient.estado],
                  ]},
                  { t:"Convênio", icon:<CreditCard className="h-4 w-4 text-slate-400"/>, campos:[
                    ["Plano",         patient.insurance],
                    ["Nº carteirinha",patient.convenioNumero],
                    ["Validade",      patient.convenioValidade],
                  ]},
                  { t:"Saúde", icon:<Heart className="h-4 w-4 text-slate-400"/>, campos:[
                    ["Tipo sanguíneo",   patient.tipoSanguineo],
                    ["Alergias",         patient.alergias],
                    ["Medicamentos",     patient.medicamentos],
                    ["Doenças",          (patient as any).doencas],
                    ["Cirurgias",        (patient as any).cirurgias],
                    ["Observações",      patient.observacoes],
                  ]},
                ].map(sec => {
                  const filled = sec.campos.filter(([, v]) => !!v);
                  return (
                    <div key={sec.t}>
                      <div className="flex items-center gap-1.5 mb-2">{sec.icon}<p className="text-xs font-bold uppercase tracking-wide text-slate-500">{sec.t}</p></div>
                      <div className="rounded-xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                        {filled.length === 0
                          ? <p className="px-3 py-2 text-xs text-slate-400">Não preenchido</p>
                          : filled.map(([l, v]) => (
                              <div key={l as string} className="flex items-start gap-2 px-3 py-2.5">
                                <span className="text-slate-400 text-xs w-32 shrink-0">{l}</span>
                                <span className="text-slate-700 font-medium text-xs flex-1 leading-snug">{v}</span>
                              </div>
                            ))
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </SheetContent>
      </Sheet>

      {/* Preview imagem */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ImageIcon className="h-4 w-4"/>{preview?.nome}
            </DialogTitle>
            <DialogDescription className="text-xs">{preview && fmtBytes(preview.tamanho)}</DialogDescription>
          </DialogHeader>
          {preview && <img src={preview.base64} alt={preview.nome} className="w-full rounded-xl object-contain max-h-[60vh]"/>}
        </DialogContent>
      </Dialog>
    </>
  );
}
