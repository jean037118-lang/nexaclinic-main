import { createFileRoute } from "@tanstack/react-router";
import { eAdmin, registrarAuditoria } from "@/lib/auth";
import {
  listarProcedimentos,
  criarProcedimento,
  atualizarProcedimento,
  excluirProcedimento,
} from "@/lib/agendaData";
import { useState, useEffect } from "react";
import { Plus, Search, Activity, Pencil, Trash2, DollarSign, Hash, RotateCcw, Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
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

export const Route = createFileRoute("/procedimentos")({
  head: () => ({ meta: [{ title: "Procedimentos — NexaClinic" }] }),
  component: ProcedimentosPage,
});

// ─── tipos ───────────────────────────────────────────────────────────────────
interface ConvenioValor {
  convenio: string;
  valor: string; // string para permitir campo vazio
}

interface ValorPorProfissional {
  professionalId: string;
  valor: string;
}

export interface Procedimento {
  id: string;
  name: string;
  tussCode: string;       // código TUSS
  category: string;       // Consulta / Exame / Cirurgia / Terapia / Outro
  durationMin: number;
  valorParticular: string;
  convenioValores: ConvenioValor[];
  valorPorProfissional?: ValorPorProfissional[]; // valor particular por profissional
  status: "ativo" | "inativo";
  tipoConsulta?: boolean;   // marca como consulta — gera retorno
  tipoRetorno?: boolean;    // marca como retorno
  prazoRetornoDias?: number; // dias máx para agendar retorno (só tipoConsulta)
}

// ─── store ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nexaclinic_procedimentos";

const DEFAULTS: Procedimento[] = [
  {
    id: "proc1", name: "Consulta Clínica", tussCode: "10101012",
    category: "Consulta", durationMin: 30, valorParticular: "250.00",
    convenioValores: [
      { convenio: "Unimed", valor: "180.00" },
      { convenio: "Bradesco Saúde", valor: "170.00" },
    ],
    status: "ativo",
  },
  {
    id: "proc2", name: "Retorno", tussCode: "10101039",
    category: "Consulta", durationMin: 20, valorParticular: "150.00",
    convenioValores: [{ convenio: "Unimed", valor: "100.00" }],
    status: "ativo",
  },
  {
    id: "proc3", name: "Eletrocardiograma", tussCode: "40302361",
    category: "Exame", durationMin: 15, valorParticular: "120.00",
    convenioValores: [],
    status: "ativo",
  },
];

const CATEGORIES = ["Consulta", "Exame", "Cirurgia", "Terapia", "Procedimento", "Outro"];

function readConveniosNomes(): string[] {
  if (typeof window === "undefined") return ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil"];
  try {
    const saved = localStorage.getItem("nexaclinic_convenios_v2");
    if (!saved) return ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil"];
    const list = JSON.parse(saved) as { name: string; ativo?: boolean }[];
    return list.filter((c) => c.ativo !== false).map((c) => c.name);
  } catch {
    return ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil"];
  }
}

function readProcedimentos(): Procedimento[] {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULTS;
  } catch { return DEFAULTS; }
}

function saveProcedimentos(list: Procedimento[]) {
  if (typeof window !== "undefined")
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ─── form vazio ──────────────────────────────────────────────────────────────
const emptyForm: Omit<Procedimento, "id"> = {
  name: "", tussCode: "", category: "Consulta",
  durationMin: 30, valorParticular: "",
  convenioValores: [], valorPorProfissional: [], status: "ativo",
  tipoConsulta: false,
  tipoRetorno: false,
  prazoRetornoDias: 30,
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(v: string) {
  if (!v) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── página ──────────────────────────────────────────────────────────────────
function ProcedimentosPage() {
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [conveniosNomes, setConveniosNomes] = useState<string[]>(() => readConveniosNomes());
  const [profissionais, setProfissionais] = useState<{ id: string; name: string; specialty?: string }[]>([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Procedimento, "id">>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const lista = await listarProcedimentos();
        setProcedimentos(lista as Procedimento[]);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar procedimentos");
      }
    }
    carregar();
  }, []);
  // Relê convênios e profissionais toda vez que o dialog abre para capturar novos cadastros
  useEffect(() => {
    if (formOpen) {
      setConveniosNomes(readConveniosNomes());
      try {
        const saved = localStorage.getItem("nexaclinic_professionals");
        if (saved) {
          const all = JSON.parse(saved) as any[];
          setProfissionais(all.filter((p) => (p.tipo ?? "profissional") === "profissional" && p.status !== "inativo"));
        }
      } catch { /* silencioso */ }
    }
  }, [formOpen]);

  function persist(list: Procedimento[]) { setProcedimentos(list); }

  const filtered = procedimentos
    .filter((p) => catFilter === "Todos" || p.category === catFilter)
    .filter((p) =>
      [p.name, p.tussCode, p.category].some((f) =>
        f.toLowerCase().includes(q.toLowerCase())
      )
    );

  function openCreate() { setEditingId(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(p: Procedimento) {
    setEditingId(p.id);
    setForm({
      name: p.name, tussCode: p.tussCode, category: p.category,
      durationMin: p.durationMin, valorParticular: p.valorParticular,
      convenioValores: [...p.convenioValores],
      valorPorProfissional: [...(p.valorPorProfissional ?? [])],
      status: p.status,
    });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Informe o nome do procedimento"); return; }
    // Verifica duplicidade de nome
    const nomeLower = form.name.trim().toLowerCase();
    const duplicado = procedimentos.find(
      (p: any) => p.name.toLowerCase() === nomeLower && p.id !== editingId
    );
    if (duplicado) { toast.error(`Já existe um procedimento com o nome "${form.name.trim()}".`); return; }

    try {
      if (editingId) {
        const atual = procedimentos.find((p) => p.id === editingId);
        const atualizado = { ...atual, ...form } as Procedimento;
        await atualizarProcedimento(editingId, atualizado);
        persist(procedimentos.map((p) => p.id === editingId ? atualizado : p));
        toast.success("Procedimento atualizado");
        registrarAuditoria("EDITAR_PROCEDIMENTO", `Procedimento "${form.name}" atualizado`);
      } else {
        const novo = await criarProcedimento(form);
        persist([...procedimentos, novo as Procedimento]);
        toast.success("Procedimento cadastrado");
        registrarAuditoria("CRIAR_PROCEDIMENTO", `Procedimento "${form.name}" cadastrado`);
      }
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar procedimento");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await excluirProcedimento(deleteId);
      const removido = procedimentos.find((p: any) => p.id === deleteId);
      persist(procedimentos.filter((p) => p.id !== deleteId));
      toast.success("Procedimento removido");
      registrarAuditoria("EXCLUIR_PROCEDIMENTO", `Procedimento "${removido?.name ?? deleteId}" excluído`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir procedimento");
    } finally {
      setDeleteId(null);
    }
  }

  // gerencia os valores por convênio no formulário
  function setConvenioValor(convenio: string, valor: string) {
    setForm((prev) => {
      const existing = prev.convenioValores.find((cv) => cv.convenio === convenio);
      if (existing) {
        return { ...prev, convenioValores: prev.convenioValores.map((cv) => cv.convenio === convenio ? { ...cv, valor } : cv) };
      }
      return { ...prev, convenioValores: [...prev.convenioValores, { convenio, valor }] };
    });
  }

  function getConvenioValor(convenio: string) {
    return form.convenioValores.find((cv) => cv.convenio === convenio)?.valor ?? "";
  }

  function setProfValor(professionalId: string, valor: string) {
    setForm((prev) => {
      const vpp = prev.valorPorProfissional ?? [];
      const existing = vpp.find((v) => v.professionalId === professionalId);
      if (existing) {
        return { ...prev, valorPorProfissional: vpp.map((v) => v.professionalId === professionalId ? { ...v, valor } : v) };
      }
      return { ...prev, valorPorProfissional: [...vpp, { professionalId, valor }] };
    });
  }

  function getProfValor(professionalId: string) {
    return (form.valorPorProfissional ?? []).find((v) => v.professionalId === professionalId)?.valor ?? "";
  }

  const ativos = procedimentos.filter((p) => p.status === "ativo").length;
  const categories = ["Todos", ...CATEGORIES];

  return (
    <div className="space-y-6">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Procedimentos</h1>
          <p className="text-sm text-muted-foreground">{ativos} ativos · {procedimentos.length} cadastrados</p>
        </div>
        <Button onClick={openCreate} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Novo procedimento
        </Button>
      </div>

      {/* cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total cadastrados", value: procedimentos.length, icon: <Activity className="h-5 w-5" /> },
          { label: "Ativos",            value: ativos,               icon: <DollarSign className="h-5 w-5 text-success" /> },
          { label: "Categorias",        value: new Set(procedimentos.map((p) => p.category)).size, icon: <Hash className="h-5 w-5 text-primary" /> },
        ].map((s) => (
          <Card key={s.label} className="border-border/60 shadow-elegant">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{s.icon}</div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* busca + filtro */}
      <Card className="border-border/60 p-4 shadow-elegant">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou código TUSS…" className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                className={`rounded-full border px-3 py-1 text-xs transition ${catFilter === cat
                  ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* tabela */}
      <Card className="overflow-hidden border-border/60 shadow-elegant">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
            <p className="text-sm">Nenhum procedimento encontrado.</p>
            <Button size="sm" onClick={openCreate} className="bg-gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4" /> Cadastrar procedimento
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Procedimento</TableHead>
                <TableHead>Cód. TUSS</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Particular</TableHead>
                <TableHead>Convênios</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {p.name}
                      {(p as any).tipoConsulta && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5">
                          <Stethoscope className="h-2.5 w-2.5" /> Consulta
                        </span>
                      )}
                      {(p as any).tipoRetorno && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5">
                          <RotateCcw className="h-2.5 w-2.5" /> Retorno
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.tussCode || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{p.category}</Badge></TableCell>
                  <TableCell className="text-sm">{p.durationMin} min</TableCell>
                  <TableCell className="font-medium text-success">{fmt(p.valorParticular)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {p.convenioValores.length === 0
                        ? <span className="text-xs text-muted-foreground">—</span>
                        : p.convenioValores.filter((cv) => cv.valor).map((cv) => (
                            <Badge key={cv.convenio} variant="outline" className="text-[10px] px-1.5 py-0">
                              {cv.convenio}: {fmt(cv.valor)}
                            </Badge>
                          ))
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={p.status === "ativo"
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border text-muted-foreground"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteId(p.id)} style={{ display: eAdmin() ? undefined : "none" }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog criar/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar procedimento" : "Novo procedimento"}</DialogTitle>
            <DialogDescription>Preencha os dados e valores do procedimento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* dados básicos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nome do procedimento *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Consulta Clínica" />
              </div>
              <div>
                <Label className="text-xs">Código TUSS</Label>
                <Input value={form.tussCode} onChange={(e) => setForm({ ...form, tussCode: e.target.value })}
                  placeholder="00000000" />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Select value={String(form.durationMin)}
                  onValueChange={(v) => setForm({ ...form, durationMin: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 15, 20, 30, 45, 60, 90, 120].map((d) =>
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Procedimento["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Tipo de procedimento ── */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-primary/70" /> Tipo de procedimento
              </p>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={!!(form as any).tipoConsulta}
                    onCheckedChange={(v) => setForm({
                      ...form,
                      tipoConsulta: !!v,
                      tipoRetorno: v ? false : (form as any).tipoRetorno,
                    } as any)}
                  />
                  <span className="text-sm font-medium">Consulta</span>
                  <span className="text-xs text-muted-foreground">(gera direito a retorno)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <Checkbox
                    checked={!!(form as any).tipoRetorno}
                    onCheckedChange={(v) => setForm({
                      ...form,
                      tipoRetorno: !!v,
                      tipoConsulta: v ? false : (form as any).tipoConsulta,
                    } as any)}
                  />
                  <span className="text-sm font-medium">Retorno</span>
                  <span className="text-xs text-muted-foreground">(usa prazo do profissional)</span>
                </label>
              </div>
              {(form as any).tipoConsulta && (
                <div className="pt-1">
                  <Label className="text-xs">Prazo para retorno (dias)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      className="w-28"
                      value={(form as any).prazoRetornoDias ?? 30}
                      onChange={(e) => setForm({ ...form, prazoRetornoDias: Number(e.target.value) } as any)}
                    />
                    <span className="text-xs text-muted-foreground">dias após a consulta</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    O sistema avisará se houver retorno disponível ao agendar nova consulta.
                  </p>
                </div>
              )}
            </div>

            {/* valores */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-semibold">Valores</p>
              <div>
                <Label className="text-xs">Valor Particular (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valorParticular}
                  onChange={(e) => setForm({ ...form, valorParticular: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              <p className="text-xs text-muted-foreground font-medium pt-1">Valores por convênio (opcional)</p>
              <div className="grid grid-cols-2 gap-3">
                {conveniosNomes.map((conv) => (
                  <div key={conv}>
                    <Label className="text-xs">{conv} (R$)</Label>
                    <Input
                      inputMode="decimal"
                      value={getConvenioValor(conv)}
                      onChange={(e) => setConvenioValor(conv, e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* valores por profissional */}
            {profissionais.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary/70" /> Valor particular por profissional
                </p>
                <p className="text-xs text-muted-foreground">
                  Define um valor diferente do particular padrão para profissionais específicos. Usado automaticamente na agenda ao selecionar o profissional com pagamento Particular.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {profissionais.map((prof) => (
                    <div key={prof.id}>
                      <Label className="text-xs">
                        {prof.name}
                        {prof.specialty ? <span className="text-muted-foreground"> · {prof.specialty}</span> : null}
                        {" "}(R$)
                      </Label>
                      <Input
                        inputMode="decimal"
                        value={getProfValor(prof.id)}
                        onChange={(e) => setProfValor(prof.id, e.target.value)}
                        placeholder={form.valorParticular || "0,00"}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-gradient-primary text-primary-foreground">
              {editingId ? "Salvar alterações" : "Cadastrar procedimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover procedimento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
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