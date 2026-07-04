import {
  listarProfissionais,
  criarProfissional,
  atualizarProfissional,
  excluirProfissional,
} from "@/lib/agendaData";
import { createFileRoute } from "@tanstack/react-router";
import { temPermissao, eAdmin, registrarAuditoria } from "@/lib/auth";
import { useState, useEffect, useRef } from "react";
import { Plus, Clock, Calendar as CalIcon, FileSignature, Pencil, Trash2, Camera, X, Microscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { professionals as initialProfessionals, type Professional, type RepasseRegra } from "@/lib/mock-data";
import { useSpecialty } from "@/store/useSpecialty";

export const Route = createFileRoute("/profissionais")({
  head: () => ({
    meta: [
      { title: "Profissionais — NexaClinic" },
      { name: "description", content: "Cadastro de médicos e profissionais da clínica." },
    ],
  }),
  component: ProfissionaisPage,
});

const STORAGE_KEY = "nexaclinic_professionals";

const COLORS = [
  { label: "Azul", value: "#3b82f6" },
  { label: "Verde", value: "#22c55e" },
  { label: "Roxo", value: "#a855f7" },
  { label: "Rosa", value: "#ec4899" },
  { label: "Laranja", value: "#f97316" },
  { label: "Ciano", value: "#06b6d4" },
];

const emptyForm = {
  name: "",
  specialty: "",
  crm: "",
  color: "#3b82f6",
  active: true,
  appointmentDuration: 30,
  workDays: "Seg–Sex • 08h–18h",
  scheduleStart: "08:00",
  scheduleEnd: "18:00",
  repasseType: "percentual" as "percentual" | "fixo",
  repasseValue: 50,
  repasseRegras: [] as RepasseRegra[],
  repasseSomenteComPagamento: true,
  avatar: "" as string,
  tipo: "profissional" as "profissional" | "exame",
  // Grade de horários
  agendaTipo: "permanente" as "permanente" | "especifica",
  diasSemana: [1,2,3,4,5] as number[],  // 0=Dom, 1=Seg ... 6=Sáb
  datasEspecificas: [] as string[],       // YYYY-MM-DD[]
  prazoRetornoDias: 30 as number,         // prazo máximo para retorno em dias
  observacao: "",                           // observação/anotações internas do profissional
};

// Busca convênios e procedimentos reais (Supabase, cache compartilhado —
// ver @/lib/agendaData). As chaves "nexaclinic_convenios_v2" e
// "nexaclinic_procedimentos" no localStorage não são mais gravadas por
// nenhuma tela (o cadastro migrou pro Supabase), então ler delas sempre
// caía nos nomes fictícios de fallback ou em lista vazia.
async function fetchConveniosNomesProf(): Promise<string[]> {
  try {
    const { listarConvenios } = await import("@/lib/agendaData");
    const list = await listarConvenios();
    return (list as any[]).filter((c) => c.status !== "inativo").map((c) => c.name).filter(Boolean);
  } catch { return []; }
}

async function fetchProcedimentosNomes(): Promise<{ id: string; name: string }[]> {
  try {
    const { listarProcedimentos } = await import("@/lib/agendaData");
    const list = await listarProcedimentos();
    return (list as any[]).filter((p) => p.status === "ativo").map((p) => ({ id: p.id, name: p.name }));
  } catch { return []; }
}

function readProfessionals(): Professional[] {
  if (typeof window === "undefined") return initialProfessionals;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialProfessionals;
  } catch {
    return initialProfessionals;
  }
}

function saveProfessionals(list: Professional[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Converte File para base64 string */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Redimensiona imagem para máx 200x200 antes de salvar */
function resizeImage(base64: string, maxSize = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = base64;
  });
}

function getInitials(name: string) {
  return name.split(" ").slice(1, 3).map((n) => n[0]).join("") || name[0] || "?";
}

// ── Componente de upload de foto ────────────────────────────────────────────
function AvatarUpload({
  value,
  color,
  name,
  onChange,
}: {
  value: string;
  color: string;
  name: string;
  onChange: (base64: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo de 5 MB.");
      e.target.value = "";
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const resized = await resizeImage(base64);
      onChange(resized);
    } catch {
      toast.error("Não foi possível carregar a imagem.");
    }

    // limpa o input para permitir reselecionar o mesmo arquivo
    e.target.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="h-24 w-24 border-4 border-white shadow-md">
          {value ? (
            <AvatarImage src={value} alt={name} className="object-cover" />
          ) : null}
          <AvatarFallback className="text-xl text-white" style={{ background: color }}>
            {getInitials(name) || "?"}
          </AvatarFallback>
        </Avatar>

        {/* Botão de câmera overlay */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-md hover:bg-primary/90 transition-colors"
          title="Trocar foto"
        >
          <Camera className="h-4 w-4" />
        </button>

        {/* Botão de remover foto */}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-destructive text-white shadow hover:bg-destructive/90 transition-colors"
            title="Remover foto"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
      >
        <Camera className="h-3.5 w-3.5" />
        {value ? "Trocar foto" : "Adicionar foto"}
      </button>

      <p className="text-center text-[11px] text-muted-foreground">
        JPG, PNG ou WEBP • máx. 5 MB
      </p>
    </div>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
function ProfissionaisPage() {
  const { specialties } = useSpecialty();
 const [professionals, setProfessionals] =
  useState<Professional[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [conveniosDisp, setConveniosDisp] = useState<string[]>([]);
  const [procsDisp, setProcsDisp] = useState<string[]>([]);

  useEffect(() => {
  async function carregar() {
    try {
      const lista = await listarProfissionais();
      setProfessionals(lista as Professional[]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar profissionais");
    }
  }

  carregar();
  fetchConveniosNomesProf().then(setConveniosDisp);
  fetchProcedimentosNomes().then((procs) => setProcsDisp(procs.map((p) => p.name)));
}, []);
  useEffect(() => {
    if (formOpen) {
      fetchConveniosNomesProf().then(setConveniosDisp);
      fetchProcedimentosNomes().then((procs) => setProcsDisp(procs.map((p) => p.name)));
    }
  }, [formOpen]);

  function persist(list: Professional[]) {
    saveProfessionals(list);
    setProfessionals(list);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(p: Professional) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      specialty: p.specialty,
      crm: p.crm,
      color: p.color.startsWith("var(") ? "#3b82f6" : p.color,
      active: p.active,
      appointmentDuration: p.appointmentDuration,
      workDays: p.workDays,
      scheduleStart: p.scheduleStart ?? "08:00",
      scheduleEnd: p.scheduleEnd ?? "18:00",
      repasseType: p.repasseType || "percentual",
      repasseValue: p.repasseValue || 50,
      repasseRegras: p.repasseRegras || [],
      repasseSomenteComPagamento: (p as any).repasseSomenteComPagamento !== false,
      avatar: (p as any).avatar || "",
      tipo: (p as any).tipo || "profissional",
      agendaTipo: (p as any).agendaTipo || "permanente",
      diasSemana: (p as any).diasSemana || [1,2,3,4,5],
      datasEspecificas: (p as any).datasEspecificas || [],
      prazoRetornoDias: (p as any).prazoRetornoDias ?? 30,
      observacao: (p as any).observacao ?? "",
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (form.tipo === "profissional") {
      if (!form.specialty.trim()) { toast.error("Informe a especialidade"); return; }
      if (!form.crm.trim()) { toast.error("Informe o CRM"); return; }
    }
    // Verifica duplicidade de nome
    const nomeLower = form.name.trim().toLowerCase();
    const duplicado = professionals.find(
      (p: any) => p.name.toLowerCase() === nomeLower && p.id !== editingId
    );
    if (duplicado) { toast.error(`Já existe um profissional com o nome "${form.name.trim()}".`); return; }

    try {
      if (editingId) {
        await atualizarProfissional(editingId, form);
        setProfessionals((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...form } : p))
        );
        toast.success(form.tipo === "exame" ? "Sala de exame atualizada" : "Profissional atualizado");
        registrarAuditoria("EDITAR_PROFISSIONAL", `Profissional/sala "${form.name}" atualizado`);
      } else {
        const novo = await criarProfissional(form);
        setProfessionals((prev) => [...prev, novo as Professional]);
        toast.success(form.tipo === "exame" ? "Sala de exame cadastrada" : "Profissional cadastrado");
        registrarAuditoria("CRIAR_PROFISSIONAL", `Profissional/sala "${form.name}" cadastrado`);
      }
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar profissional");
    }
  }

  async function handleDelete() {
  if (!deleteId) return;

  try {
    await excluirProfissional(deleteId);

    const removido = professionals.find(
      (p) => p.id === deleteId
    );

    setProfessionals((prev) =>
      prev.filter((p) => p.id !== deleteId)
    );

    registrarAuditoria(
      "EXCLUIR_PROFISSIONAL",
      `Profissional "${removido?.name ?? deleteId}" excluído`
    );

    toast.success("Profissional removido");
    setDeleteId(null);
  } catch (error) {
    console.error(error);
    toast.error("Erro ao remover profissional");
  }
}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Profissionais</h1>
          <p className="text-sm text-muted-foreground">{professionals.length} cadastrados</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Novo profissional
        </Button>
      </div>

      {professionals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
          <p className="text-sm">Nenhum profissional cadastrado.</p>
          <Button size="sm" onClick={openCreate} className="bg-gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4" /> Cadastrar profissional
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {professionals.map((p) => {
            const avatarSrc = (p as any).avatar || "";
            const isExame = (p as any).tipo === "exame";
            return (
              <Card key={p.id} className="group relative overflow-hidden border-border/60 shadow-elegant transition hover:shadow-glow">
                {/* Banner colorido */}
                <div className="h-20" style={{ background: `linear-gradient(135deg, ${p.color}, color-mix(in oklab, ${p.color} 60%, transparent))` }} />
                <CardContent className="-mt-10 space-y-4 p-5">
                  <div className="flex items-end justify-between">
                    <Avatar className="h-20 w-20 border-4 border-card shadow-md">
                      {avatarSrc ? (
                        <AvatarImage src={avatarSrc} alt={p.name} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="text-lg text-white" style={{ background: p.color }}>
                        {isExame ? <Microscope className="h-8 w-8" /> : getInitials(p.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-end gap-1">
                      {isExame && (
                        <Badge className="border-violet-300 bg-violet-100 text-violet-700 text-[10px]">
                          <Microscope className="h-3 w-3 mr-1" /> Exame
                        </Badge>
                      )}
                      <Badge variant="outline"
                        className={p.active
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-border text-muted-foreground"}>
                        {p.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    <p className="text-sm text-primary">{p.specialty || (isExame ? "Sala de Exames" : "—")}</p>
                    {!isExame && <p className="text-xs font-mono text-muted-foreground">{p.crm}</p>}
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalIcon className="h-3.5 w-3.5 shrink-0" />
                      {(p as any).agendaTipo === "especifica"
                        ? <span>{((p as any).datasEspecificas?.length ?? 0)} data(s) específica(s) • {p.scheduleStart}–{p.scheduleEnd}</span>
                        : <span>{(() => {
                            const dias = (p as any).diasSemana as number[] | undefined;
                            const labels = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
                            return dias?.length ? dias.map(d => labels[d]).join(", ") : p.workDays;
                          })()} • {p.scheduleStart}–{p.scheduleEnd}</span>
                      }
                    </div>
                    <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> {p.appointmentDuration} min por {isExame ? "exame" : "consulta"}</div>
                    {!isExame && <div className="flex items-center gap-2"><FileSignature className="h-3.5 w-3.5" /> Assinatura digital ativa</div>}
                  </div>
                  <div className="flex gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteId(p.id)} style={{ display: eAdmin() ? undefined : "none" }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Novo"} {form.tipo === "exame" ? "sala de exame" : "profissional"}</DialogTitle>
            <DialogDescription>Preencha os dados {form.tipo === "exame" ? "da sala de exame." : "do profissional."}</DialogDescription>
          </DialogHeader>

          {/* Tipo — primeiro campo, pois muda o restante do form */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3">
            {(["profissional", "exame"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, tipo: t })}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm font-medium transition ${
                  form.tipo === t
                    ? t === "exame"
                      ? "border-violet-400 bg-violet-50 text-violet-700"
                      : "border-primary/50 bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {t === "exame" ? <Microscope className="h-5 w-5" /> : <FileSignature className="h-5 w-5" />}
                {t === "exame" ? "Sala de Exame" : "Profissional"}
              </button>
            ))}
          </div>

          {/* Upload de foto — só para profissional */}
          {form.tipo === "profissional" && (
            <div className="rounded-xl border bg-muted/30 py-5">
              <AvatarUpload
                value={form.avatar}
                color={form.color}
                name={form.name}
                onChange={(base64) => setForm({ ...form, avatar: base64 })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">{form.tipo === "exame" ? "Nome da sala / equipamento *" : "Nome completo *"}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.tipo === "exame" ? "Ex: Raio-X, Ultrassom, ECG" : "Dr. Nome Sobrenome"} />
            </div>

            {/* Especialidade — obrigatório p/ profissional, opcional p/ exame */}
            <div>
              <Label className="text-xs">
                {form.tipo === "exame" ? "Tipo de exame (opcional)" : "Especialidade *"}
              </Label>
              {specialties.length > 0 ? (
                <Select
                  value={form.specialty}
                  onValueChange={(v) => setForm({ ...form, specialty: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.tipo === "exame" ? "Selecione o tipo (opcional)" : "Selecione a especialidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {specialties.map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="space-y-1">
                  <Input
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder={form.tipo === "exame" ? "Ex: Radiologia" : "Ex: Cardiologia"}
                  />
                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                    ⚠ Nenhuma especialidade cadastrada.{" "}
                    <a href="/especialidades" className="underline font-medium hover:text-amber-700">
                      Cadastre em Especialidades
                    </a>{" "}
                    para usar a seleção.
                  </p>
                </div>
              )}
            </div>

            {/* CRM — só para profissional */}
            {form.tipo === "profissional" ? (
              <div>
                <Label className="text-xs">CRM *</Label>
                <Input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })}
                  placeholder="CRM/SP 000.000" />
              </div>
            ) : (
              <div>
                <Label className="text-xs">Código / Identificação (opcional)</Label>
                <Input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })}
                  placeholder="Ex: SALA-01" />
              </div>
            )}

            <div className="col-span-2">
              <Label className="text-xs">Dias e horário de funcionamento</Label>
              <Input value={form.workDays} onChange={(e) => setForm({ ...form, workDays: e.target.value })}
                placeholder="Seg–Sex • 08h–18h" />
            </div>
            <div>
              <Label className="text-xs">Início</Label>
              <Input type="time" value={form.scheduleStart}
                onChange={(e) => setForm({ ...form, scheduleStart: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Fim</Label>
              <Input type="time" value={form.scheduleEnd}
                onChange={(e) => setForm({ ...form, scheduleEnd: e.target.value })} />
            </div>

            {/* ── Grade de horários ─────────────────────────────────── */}
            <div className="col-span-2 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-semibold text-foreground">Grade de Atendimento</p>

              {/* Tipo de agenda */}
              <div className="flex gap-2">
                {([
                  { val: "permanente", label: "Agenda Permanente", desc: "Repete semanalmente" },
                  { val: "especifica", label: "Datas Específicas", desc: "Escolhe cada data" },
                ] as const).map(({ val, label, desc }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm({ ...form, agendaTipo: val })}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-left transition ${
                      form.agendaTipo === val
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>

              {/* Permanente — dias da semana */}
              {form.agendaTipo === "permanente" && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">Dias de atendimento</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((dia, idx) => {
                      const ativo = form.diasSemana.includes(idx);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            diasSemana: ativo
                              ? form.diasSemana.filter(d => d !== idx)
                              : [...form.diasSemana, idx].sort(),
                          })}
                          className={`w-10 h-10 rounded-xl text-xs font-bold border transition ${
                            ativo
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-background text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {dia}
                        </button>
                      );
                    })}
                  </div>
                  {form.diasSemana.length === 0 && (
                    <p className="text-[11px] text-destructive mt-1">Selecione ao menos um dia.</p>
                  )}
                </div>
              )}

              {/* Específica — seleção de datas */}
              {form.agendaTipo === "especifica" && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-2">Adicione as datas de atendimento</p>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="date"
                      className="w-auto"
                      onChange={(e) => {
                        const d = e.target.value;
                        if (!d) return;
                        if (form.datasEspecificas.includes(d)) return;
                        setForm({ ...form, datasEspecificas: [...form.datasEspecificas, d].sort() });
                        e.target.value = "";
                      }}
                    />
                    <span className="text-xs text-muted-foreground">clique para adicionar</span>
                  </div>
                  {form.datasEspecificas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {form.datasEspecificas.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day:"2-digit", month:"short", year:"2-digit" })}
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, datasEspecificas: form.datasEspecificas.filter(x => x !== d) })}
                            className="ml-0.5 text-primary/60 hover:text-destructive transition"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {form.datasEspecificas.length === 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">Nenhuma data adicionada ainda.</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Duração por {form.tipo === "exame" ? "exame" : "consulta"} (min)</Label>
              <Select value={String(form.appointmentDuration)}
                onValueChange={(v) => setForm({ ...form, appointmentDuration: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 20, 30, 45, 60, 90].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cor de identificação</Label>
              <Select value={form.color} onValueChange={(v) => setForm({ ...form, color: v })}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: form.color }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: c.value }} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Repasse ── */}
            {form.tipo === "profissional" && (
              <div className="col-span-2 space-y-3 rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-semibold text-slate-700">Regras de Repasse</p>

                {/* Regra global */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo padrão</Label>
                    <Select value={form.repasseType}
                      onValueChange={(v) => setForm({ ...form, repasseType: v as "percentual" | "fixo" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentual">Percentual (%)</SelectItem>
                        <SelectItem value="fixo">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">
                      {form.repasseType === "percentual" ? "% padrão (todos os convênios)" : "R$ fixo padrão"}
                    </Label>
                    <Input
                      type="number" min="0" max={form.repasseType === "percentual" ? 100 : undefined}
                      value={form.repasseValue}
                      onChange={(e) => setForm({ ...form, repasseValue: Number(e.target.value) })}
                      placeholder={form.repasseType === "percentual" ? "50" : "0.00"}
                    />
                  </div>
                </div>

                {/* ── Regras específicas por procedimento e/ou convênio ── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Regras específicas</Label>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                        Por procedimento e/ou convênio — sobrepõem o padrão acima
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline shrink-0"
                      onClick={() => {
                        setForm({
                          ...form,
                          repasseRegras: [
                            ...form.repasseRegras,
                            { procedimento: "*", convenio: "*", tipo: form.repasseType, valor: form.repasseValue },
                          ],
                        });
                      }}
                    >
                      + Nova regra
                    </button>
                  </div>

                  {form.repasseRegras.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Nenhuma regra específica — o valor padrão será aplicado em todos os casos.
                    </p>
                  )}

                  {form.repasseRegras.map((regra, idx) => (
                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">

                      {/* linha 1: procedimento + convênio */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Procedimento</Label>
                          <Select
                            value={(regra as any).procedimento ?? "*"}
                            onValueChange={(v) => {
                              const updated = [...form.repasseRegras];
                              (updated[idx] as any) = { ...updated[idx], procedimento: v };
                              setForm({ ...form, repasseRegras: updated });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="*">
                                <span className="text-slate-400 italic">Qualquer procedimento</span>
                              </SelectItem>
                              {procsDisp.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Convênio</Label>
                          <Select
                            value={regra.convenio ?? "*"}
                            onValueChange={(v) => {
                              const updated = [...form.repasseRegras];
                              updated[idx] = { ...updated[idx], convenio: v };
                              setForm({ ...form, repasseRegras: updated });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="*">
                                <span className="text-slate-400 italic">Qualquer convênio</span>
                              </SelectItem>
                              <SelectItem value="Particular">Particular</SelectItem>
                              {conveniosDisp.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* linha 2: tipo + valor + lixeira */}
                      <div className="grid grid-cols-[1fr_1fr_32px] gap-2 items-end">
                        <div>
                          <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Tipo</Label>
                          <Select
                            value={regra.tipo}
                            onValueChange={(v) => {
                              const updated = [...form.repasseRegras];
                              updated[idx] = { ...updated[idx], tipo: v as "percentual" | "fixo" };
                              setForm({ ...form, repasseRegras: updated });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentual">% Percentual</SelectItem>
                              <SelectItem value="fixo">R$ Valor fixo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">
                            {regra.tipo === "percentual" ? "Percentual (%)" : "Valor (R$)"}
                          </Label>
                          <Input
                            type="number" min="0" max={regra.tipo === "percentual" ? 100 : undefined}
                            className="h-8 text-xs mt-0.5"
                            value={regra.valor}
                            onChange={(e) => {
                              const updated = [...form.repasseRegras];
                              updated[idx] = { ...updated[idx], valor: Number(e.target.value) };
                              setForm({ ...form, repasseRegras: updated });
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="h-8 w-8 flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition"
                          title="Remover regra"
                          onClick={() => {
                            const updated = form.repasseRegras.filter((_, i) => i !== idx);
                            setForm({ ...form, repasseRegras: updated });
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* resumo legível da regra */}
                      <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-1.5">
                        {(() => {
                          const proc = (regra as any).procedimento;
                          const conv = regra.convenio;
                          const partes = [];
                          if (proc && proc !== "*") partes.push(`Procedimento: ${proc}`);
                          if (conv && conv !== "*") partes.push(`Convênio: ${conv}`);
                          const escopo = partes.length ? partes.join(" · ") : "Qualquer procedimento e convênio";
                          const taxa = regra.tipo === "percentual" ? `${regra.valor}%` : `R$ ${regra.valor.toFixed(2)}`;
                          return `${escopo}  →  ${taxa}`;
                        })()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Repasse somente com pagamento */}
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, repasseSomenteComPagamento: !form.repasseSomenteComPagamento })}
                    className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full border-2 transition-colors ${form.repasseSomenteComPagamento ? "border-amber-500 bg-amber-500" : "border-slate-300 bg-slate-200"}`}
                  >
                    <span className={`ml-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${form.repasseSomenteComPagamento ? "translate-x-3.5" : "translate-x-0"}`} />
                  </button>
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Repasse somente após pagamento do paciente</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">
                      {form.repasseSomenteComPagamento
                        ? "Ativado — aparece no Repasse Médico somente quando o paciente tiver pago."
                        : "Desativado — repasse calculado independente do pagamento."}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.active ? "ativo" : "inativo"}
                onValueChange={(v) => setForm({ ...form, active: v === "ativo" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Prazo de Retorno ── */}
          {form.tipo === "profissional" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                🔁 Prazo de Retorno
              </p>
              <p className="text-xs text-blue-700">
                Máximo de dias após uma consulta para o paciente agendar retorno com este profissional.
                Passado esse prazo o retorno será bloqueado.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.prazoRetornoDias ?? 30}
                  onChange={(e) => setForm({ ...form, prazoRetornoDias: Number(e.target.value) })}
                  className="w-24 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-sm text-blue-700">dias após a consulta</span>
              </div>
            </div>
          )}

          {/* Observação */}
          {form.tipo === "profissional" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">📝</span>
                <Label className="text-sm font-semibold text-amber-800">Observações</Label>
              </div>
              <p className="text-[11px] text-amber-700">
                Informações internas sobre o profissional. Visível na agenda ao clicar no nome do profissional.
              </p>
              <textarea
                rows={4}
                placeholder="Ex: Prefere não atender após as 17h. Especialista em procedimentos estéticos. Usa sala 3."
                value={form.observacao ?? ""}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none placeholder:text-amber-300"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-gradient-primary text-primary-foreground">
              {editingId ? "Salvar alterações" : form.tipo === "exame" ? "Cadastrar sala" : "Cadastrar profissional"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O profissional será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}