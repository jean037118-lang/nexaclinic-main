'use client';
import { createFileRoute } from "@tanstack/react-router";
import { eAdmin, registrarAuditoria } from "@/lib/auth";
import {
  listarConvenios,
  criarConvenio,
  atualizarConvenio,
  excluirConvenio,
  listarProcedimentos,
} from "@/lib/agendaData";
import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Plus, Search, ShieldCheck, Pencil, Trash2, Building2,
  ChevronRight, ArrowLeft, FileSpreadsheet, Download,
  UploadCloud, DollarSign, ListChecks, ChevronDown, ChevronUp,
  Tag, X, Check, AlertCircle,
} from "lucide-react";
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

export const Route = createFileRoute("/convenios")({
  head: () => ({ meta: [{ title: "Convênios — NexaClinic" }] }),
  component: ConveniosPage,
});

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanoConvenio {
  id: string;
  nome: string;           // ex: "Apartamento", "Enfermaria", "Executivo"
  codigo: string;         // código do plano
  abrangencia: string;    // Nacional / Regional / Local
  ativo: boolean;
}

export interface ItemTabelaPreco {
  id: string;
  codigoTUSS: string;
  procedimento: string;
  procedimentoId?: string;  // referência ao Procedimento cadastrado
  categoria: string;
  valor: number;            // valor em R$
}

export interface TabelaPreco {
  id: string;
  planoId: string;        // vínculo com plano
  nome: string;           // nome da tabela ex: "Tabela CBHPM 2024"
  vigenciaInicio: string;
  vigenciaFim: string;
  itens: ItemTabelaPreco[];
  ativo: boolean;
}

export interface Convenio {
  id: string;
  name: string;
  ansCode: string;
  type: string;
  repasse: string;
  carencia: string;
  contact: string;
  status: "ativo" | "inativo";
  faturar?: boolean;
  repasseAoFaturar?: boolean;  // gera repasse médico ao enviar ao faturamento
  planos: PlanoConvenio[];
  tabelas: TabelaPreco[];
}

// ── Storage removido: dados agora vêm exclusivamente do Supabase ──────────────

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

const ABRANGENCIAS = ["Nacional", "Regional", "Local", "Grupo"];
const CATEGORIAS   = ["Consulta", "Exame", "Cirurgia", "Terapia", "Procedimento", "Outro"];

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL (navegação entre views)
// ═══════════════════════════════════════════════════════════════════════════
type View = "lista" | "detalhe" | "tabela";

function ConveniosPage() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<View>("lista");
  const [convenioId, setConvenioId] = useState<string | null>(null);
  const [tabelaId, setTabelaId]     = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        const lista = await listarConvenios();
        setConvenios(lista as Convenio[]);
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar convênios");
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  function persist(list: Convenio[]) { setConvenios(list); }

  function abrirDetalhe(id: string) { setConvenioId(id); setView("detalhe"); }
  function abrirTabela(convId: string, tabId: string) {
    setConvenioId(convId); setTabelaId(tabId); setView("tabela");
  }
  function voltar() {
    if (view === "tabela") { setView("detalhe"); setTabelaId(null); }
    else { setView("lista"); setConvenioId(null); }
  }

  const convenio = convenios.find((c) => c.id === convenioId) ?? null;
  const tabela   = convenio?.tabelas.find((t) => t.id === tabelaId) ?? null;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {view !== "lista" && (
        <button onClick={voltar} className="flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-600 transition">
          <ArrowLeft className="w-4 h-4" />
          {view === "tabela" ? `Voltar para ${convenio?.name}` : "Voltar para Convênios"}
        </button>
      )}

      {view === "lista"  && <ListaConvenios convenios={convenios} onPersist={persist} onAbrirDetalhe={abrirDetalhe} />}
      {view === "detalhe" && convenio && (
        <DetalheConvenio
          convenio={convenio}
          onPersist={(conv) => {
            atualizarConvenio(conv.id, conv).catch((err) => {
              console.error(err);
              toast.error("Erro ao salvar alterações do convênio");
            });
            persist(convenios.map((c) => c.id === conv.id ? conv : c));
          }}
          onAbrirTabela={(tabId) => abrirTabela(convenio.id, tabId)}
        />
      )}
      {view === "tabela" && convenio && tabela && (
        <TabelaPrecoView
          convenio={convenio}
          tabela={tabela}
          onPersist={(tab) => {
            const conv = { ...convenio, tabelas: convenio.tabelas.map((t) => t.id === tab.id ? tab : t) };
            atualizarConvenio(conv.id, conv).catch((err) => {
              console.error(err);
              toast.error("Erro ao salvar tabela de preços");
            });
            persist(convenios.map((c) => c.id === conv.id ? conv : c));
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW 1 — LISTA DE CONVÊNIOS
// ═══════════════════════════════════════════════════════════════════════════
function ListaConvenios({
  convenios, onPersist, onAbrirDetalhe,
}: {
  convenios: Convenio[];
  onPersist: (list: Convenio[]) => void;
  onAbrirDetalhe: (id: string) => void;
}) {
  const [q, setQ]               = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [form, setForm]           = useState(emptyConvenioForm());

  function emptyConvenioForm() {
    return { name: "", ansCode: "", type: "Médico", repasse: "", carencia: "", contact: "", status: "ativo" as const, faturar: false, repasseAoFaturar: false };
  }

  const filtered = convenios.filter((c) =>
    [c.name, c.ansCode, c.type].some((f) => f.toLowerCase().includes(q.toLowerCase()))
  );

  function openCreate() { setEditingId(null); setForm(emptyConvenioForm()); setFormOpen(true); }
  function openEdit(c: Convenio) {
    setEditingId(c.id);
    setForm({ name: c.name, ansCode: c.ansCode, type: c.type, repasse: c.repasse, carencia: c.carencia, contact: c.contact, status: c.status, faturar: c.faturar ?? false, repasseAoFaturar: c.repasseAoFaturar ?? false });
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    // Verifica duplicidade de nome
    const nomeLower = form.name.trim().toLowerCase();
    const duplicado = convenios.find(
      (c) => c.name.toLowerCase() === nomeLower && c.id !== editingId
    );
    if (duplicado) { toast.error(`Já existe um convênio com o nome "${form.name.trim()}".`); return; }

    try {
      if (editingId) {
        const atual = convenios.find((c) => c.id === editingId);
        const atualizado = { ...atual, ...form } as Convenio;
        await atualizarConvenio(editingId, atualizado);
        onPersist(convenios.map((c) => c.id === editingId ? atualizado : c));
        toast.success("Convênio atualizado");
        registrarAuditoria("EDITAR_CONVENIO", `Convênio "${form.name}" atualizado`);
      } else {
        const novo = await criarConvenio({ ...form, planos: [], tabelas: [] });
        onPersist([...convenios, novo as Convenio]);
        toast.success("Convênio cadastrado");
        registrarAuditoria("CRIAR_CONVENIO", `Convênio "${form.name}" cadastrado`);
      }
      setFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar convênio");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await excluirConvenio(deleteId);
      const removido = convenios.find((x: any) => x.id === deleteId);
      onPersist(convenios.filter((c) => c.id !== deleteId));
      toast.success("Convênio removido");
      registrarAuditoria("EXCLUIR_CONVENIO", `Convênio "${removido?.name ?? deleteId}" excluído`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir convênio");
    } finally {
      setDeleteId(null);
    }
  }

  const ativos = convenios.filter((c) => c.status === "ativo").length;

  return (
    <div className="space-y-4 -mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-600" /> Convênios
          </h1>
          <p className="text-sm text-slate-500 mt-1">{ativos} ativos · {convenios.length} cadastrados</p>
        </div>
        <Button onClick={openCreate} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Novo convênio
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total cadastrados", value: convenios.length,           icon: <Building2 className="h-5 w-5" />,               cor: "bg-cyan-100 text-cyan-700" },
          { label: "Ativos",            value: ativos,                     icon: <ShieldCheck className="h-5 w-5" />,             cor: "bg-green-100 text-green-700" },
          { label: "Total de planos",   value: convenios.reduce((s,c) => s + c.planos.length, 0), icon: <Tag className="h-5 w-5" />, cor: "bg-violet-100 text-violet-700" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.cor}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Busca */}
      <Card className="border-slate-200 p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, código ANS ou tipo…" className="pl-9 rounded-xl" />
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-slate-400">
            <p className="text-sm">Nenhum convênio encontrado.</p>
            <Button size="sm" onClick={openCreate} className="bg-cyan-600 text-white rounded-xl">
              <Plus className="h-4 w-4" /> Cadastrar convênio
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Convênio</TableHead>
                <TableHead>ANS</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Planos</TableHead>
                <TableHead>Tabelas</TableHead>
                <TableHead>Repasse</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-cyan-50/50" onClick={() => onAbrirDetalhe(c.id)}>
                  <TableCell className="font-semibold text-slate-800">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{c.ansCode || "—"}</TableCell>
                  <TableCell><Badge variant="secondary">{c.type}</Badge></TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-violet-700">
                      {c.planos.filter((p) => p.ativo).length} plano(s)
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium text-cyan-700">
                      {c.tabelas.filter((t) => t.ativo).length} tabela(s)
                    </span>
                  </TableCell>
                  <TableCell>{c.repasse ? `${c.repasse}%` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.status === "ativo" ? "border-green-300 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(c.id)} style={{ display: eAdmin() ? undefined : "none" }}>
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

      {/* Dialog criar/editar convênio */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar convênio" : "Novo convênio"}</DialogTitle>
            <DialogDescription>Preencha os dados principais. Planos e tabelas são gerenciados dentro do convênio.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Nome do convênio *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" placeholder="Ex: Unimed" />
            </div>
            <div>
              <Label className="text-xs">Código ANS</Label>
              <Input value={form.ansCode} onChange={(e) => setForm({ ...form, ansCode: e.target.value })} className="rounded-xl" placeholder="000-0" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Médico","Odontológico","Multiprofissional","Hospitalar"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Repasse (%)</Label>
              <Input type="number" min="0" max="100" value={form.repasse} onChange={(e) => setForm({ ...form, repasse: e.target.value })} className="rounded-xl" placeholder="60" />
            </div>
            <div>
              <Label className="text-xs">Carência (dias)</Label>
              <Input type="number" min="0" value={form.carencia} onChange={(e) => setForm({ ...form, carencia: e.target.value })} className="rounded-xl" placeholder="30" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Contato</Label>
              <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="rounded-xl" placeholder="0800 000 0000" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Convenio["status"] })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Checkbox id="faturar" checked={form.faturar} onCheckedChange={(v) => setForm({ ...form, faturar: v === true })} />
              <Label htmlFor="faturar" className="cursor-pointer text-sm">Faturar convênio</Label>
            </div>
            {form.faturar && (
              <div className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5">
                <Checkbox
                  id="repasseAoFaturar"
                  checked={form.repasseAoFaturar}
                  onCheckedChange={(v) => setForm({ ...form, repasseAoFaturar: v === true })}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="repasseAoFaturar" className="cursor-pointer text-sm font-semibold text-teal-800">
                    Incluir no Repasse Médico ao faturar
                  </Label>
                  <p className="text-[11px] text-teal-600 mt-0.5">
                    {form.repasseAoFaturar
                      ? "Ativado — ao enviar o agendamento para o lote, o repasse do médico será gerado automaticamente."
                      : "Desativado — o repasse médico não será gerado pelo faturamento."}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl">
              {editingId ? "Salvar alterações" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover convênio?</AlertDialogTitle>
            <AlertDialogDescription>Todos os planos e tabelas serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW 2 — DETALHE DO CONVÊNIO (planos + tabelas)
// ═══════════════════════════════════════════════════════════════════════════
function DetalheConvenio({
  convenio, onPersist, onAbrirTabela,
}: {
  convenio: Convenio;
  onPersist: (c: Convenio) => void;
  onAbrirTabela: (tabId: string) => void;
}) {
  // ── Planos ────────────────────────────────────────────────────────────────
  const [planoOpen, setPlanoOpen]     = useState(false);
  const [planoEdit, setPlanoEdit]     = useState<PlanoConvenio | null>(null);
  const [deletePlanoId, setDeletePlanoId] = useState<string | null>(null);
  const [planoForm, setPlanoForm]     = useState({ nome: "", codigo: "", abrangencia: "Nacional", ativo: true });

  function abrirPlanoNovo() { setPlanoEdit(null); setPlanoForm({ nome: "", codigo: "", abrangencia: "Nacional", ativo: true }); setPlanoOpen(true); }
  function abrirPlanoEdit(p: PlanoConvenio) { setPlanoEdit(p); setPlanoForm({ nome: p.nome, codigo: p.codigo, abrangencia: p.abrangencia, ativo: p.ativo }); setPlanoOpen(true); }

  function salvarPlano() {
    if (!planoForm.nome.trim()) { toast.error("Informe o nome do plano"); return; }
    let planos: PlanoConvenio[];
    if (planoEdit) {
      planos = convenio.planos.map((p) => p.id === planoEdit.id ? { ...p, ...planoForm } : p);
    } else {
      planos = [...convenio.planos, { id: `pl_${uid()}`, ...planoForm }];
    }
    onPersist({ ...convenio, planos });
    setPlanoOpen(false);
    toast.success(planoEdit ? "Plano atualizado" : "Plano criado");
  }

  function excluirPlano() {
    if (!deletePlanoId) return;
    // remove tabelas vinculadas ao plano também
    onPersist({
      ...convenio,
      planos: convenio.planos.filter((p) => p.id !== deletePlanoId),
      tabelas: convenio.tabelas.filter((t) => t.planoId !== deletePlanoId),
    });
    setDeletePlanoId(null);
    toast.success("Plano removido");
  }

  // ── Tabelas ───────────────────────────────────────────────────────────────
  const [tabelaOpen, setTabelaOpen]   = useState(false);
  const [tabelaEdit, setTabelaEdit]   = useState<TabelaPreco | null>(null);
  const [deleteTabelaId, setDeleteTabelaId] = useState<string | null>(null);
  const [tabelaForm, setTabelaForm]   = useState({
    planoId: "", nome: "", vigenciaInicio: "", vigenciaFim: "", ativo: true,
  });

  function abrirTabelaNova() {
    setTabelaEdit(null);
    setTabelaForm({ planoId: convenio.planos[0]?.id ?? "", nome: "", vigenciaInicio: "", vigenciaFim: "", ativo: true });
    setTabelaOpen(true);
  }
  function abrirTabelaEdit(t: TabelaPreco) {
    setTabelaEdit(t);
    setTabelaForm({ planoId: t.planoId, nome: t.nome, vigenciaInicio: t.vigenciaInicio, vigenciaFim: t.vigenciaFim, ativo: t.ativo });
    setTabelaOpen(true);
  }

  function salvarTabela() {
    if (!tabelaForm.nome.trim()) { toast.error("Informe o nome da tabela"); return; }
    if (!tabelaForm.planoId) { toast.error("Selecione um plano"); return; }
    let tabelas: TabelaPreco[];
    if (tabelaEdit) {
      tabelas = convenio.tabelas.map((t) => t.id === tabelaEdit.id ? { ...t, ...tabelaForm } : t);
    } else {
      tabelas = [...convenio.tabelas, { id: `tab_${uid()}`, ...tabelaForm, itens: [] }];
    }
    onPersist({ ...convenio, tabelas });
    setTabelaOpen(false);
    toast.success(tabelaEdit ? "Tabela atualizada" : "Tabela criada");
  }

  function excluirTabela() {
    if (!deleteTabelaId) return;
    onPersist({ ...convenio, tabelas: convenio.tabelas.filter((t) => t.id !== deleteTabelaId) });
    setDeleteTabelaId(null);
    toast.success("Tabela removida");
  }

  function nomePlano(planoId: string) {
    return convenio.planos.find((p) => p.id === planoId)?.nome ?? "—";
  }

  return (
    <div className="space-y-6">
      {/* Header do convênio */}
      <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">{convenio.name}</h2>
            <div className="flex gap-4 mt-1 text-white/80 text-sm">
              <span>ANS: {convenio.ansCode || "—"}</span>
              <span>{convenio.type}</span>
              {convenio.repasse && <span>Repasse: {convenio.repasse}%</span>}
              {convenio.carencia && <span>Carência: {convenio.carencia} dias</span>}
            </div>
          </div>
          <div className="text-right text-sm text-white/70">
            <p>{convenio.planos.length} plano(s)</p>
            <p>{convenio.tabelas.length} tabela(s) de preço</p>
          </div>
        </div>
      </div>

      {/* ── PLANOS ───────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Tag className="w-5 h-5 text-violet-600" /> Planos
          </h3>
          <Button onClick={abrirPlanoNovo} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2" size="sm">
            <Plus className="w-4 h-4" /> Novo plano
          </Button>
        </div>

        {convenio.planos.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">Nenhum plano cadastrado</p>
            <p className="text-sm">Adicione os planos disponíveis neste convênio</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {convenio.planos.map((p) => (
              <div key={p.id} className={`bg-white border rounded-2xl p-4 shadow-sm flex items-start justify-between ${!p.ativo ? "opacity-60" : ""}`}>
                <div>
                  <p className="font-semibold text-slate-800">{p.nome}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Cód: {p.codigo || "—"} · {p.abrangencia}</p>
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${p.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirPlanoEdit(p)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeletePlanoId(p.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TABELAS DE PREÇO ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-cyan-600" /> Tabelas de Preço
          </h3>
          <Button
            onClick={abrirTabelaNova}
            disabled={convenio.planos.length === 0}
            className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-2 disabled:opacity-50"
            size="sm"
            title={convenio.planos.length === 0 ? "Crie um plano primeiro" : ""}
          >
            <Plus className="w-4 h-4" /> Nova tabela
          </Button>
        </div>

        {convenio.planos.length === 0 && (
          <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Crie pelo menos um plano para poder adicionar tabelas de preço.
          </div>
        )}

        {convenio.tabelas.length === 0 && convenio.planos.length > 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="font-medium">Nenhuma tabela de preço</p>
            <p className="text-sm">Crie uma tabela e importe os valores via Excel</p>
          </div>
        ) : (
          <div className="space-y-3">
            {convenio.tabelas.map((t) => (
              <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{t.nome}</p>
                    <div className="flex gap-3 text-xs text-slate-500 mt-0.5">
                      <span>Plano: <strong className="text-violet-700">{nomePlano(t.planoId)}</strong></span>
                      {t.vigenciaInicio && <span>Início: {new Date(t.vigenciaInicio + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                      {t.vigenciaFim && <span>Fim: {new Date(t.vigenciaFim + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                      <span>{t.itens.length} procedimento(s)</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={() => abrirTabelaEdit(t)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteTabelaId(t.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Button
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-1.5"
                      onClick={() => onAbrirTabela(t.id)}
                    >
                      <ListChecks className="w-4 h-4" /> Ver preços
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog plano */}
      <Dialog open={planoOpen} onOpenChange={setPlanoOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{planoEdit ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do plano *</Label>
              <Input value={planoForm.nome} onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })} className="rounded-xl" placeholder="Ex: Unimed Nacional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código</Label>
                <Input value={planoForm.codigo} onChange={(e) => setPlanoForm({ ...planoForm, codigo: e.target.value })} className="rounded-xl" placeholder="UN001" />
              </div>
              <div>
                <Label className="text-xs">Abrangência</Label>
                <Select value={planoForm.abrangencia} onValueChange={(v) => setPlanoForm({ ...planoForm, abrangencia: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ABRANGENCIAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="planoAtivo" checked={planoForm.ativo} onCheckedChange={(v) => setPlanoForm({ ...planoForm, ativo: v === true })} />
              <Label htmlFor="planoAtivo" className="cursor-pointer text-sm">Plano ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPlanoOpen(false)}>Cancelar</Button>
            <Button onClick={salvarPlano} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
              {planoEdit ? "Salvar" : "Criar plano"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog tabela */}
      <Dialog open={tabelaOpen} onOpenChange={setTabelaOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{tabelaEdit ? "Editar tabela" : "Nova tabela de preço"}</DialogTitle>
            <DialogDescription>Os itens/valores são adicionados dentro da tabela.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Plano vinculado *</Label>
              <Select value={tabelaForm.planoId} onValueChange={(v) => setTabelaForm({ ...tabelaForm, planoId: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                <SelectContent>
                  {convenio.planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Nome da tabela *</Label>
              <Input value={tabelaForm.nome} onChange={(e) => setTabelaForm({ ...tabelaForm, nome: e.target.value })} className="rounded-xl" placeholder="Ex: CBHPM 2024" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vigência início</Label>
                <Input type="date" value={tabelaForm.vigenciaInicio} onChange={(e) => setTabelaForm({ ...tabelaForm, vigenciaInicio: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <Label className="text-xs">Vigência fim</Label>
                <Input type="date" value={tabelaForm.vigenciaFim} onChange={(e) => setTabelaForm({ ...tabelaForm, vigenciaFim: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="tabelaAtiva" checked={tabelaForm.ativo} onCheckedChange={(v) => setTabelaForm({ ...tabelaForm, ativo: v === true })} />
              <Label htmlFor="tabelaAtiva" className="cursor-pointer text-sm">Tabela ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTabelaOpen(false)}>Cancelar</Button>
            <Button onClick={salvarTabela} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl">
              {tabelaEdit ? "Salvar" : "Criar tabela"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm excluir plano */}
      <AlertDialog open={!!deletePlanoId} onOpenChange={(o) => !o && setDeletePlanoId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover plano?</AlertDialogTitle>
            <AlertDialogDescription>As tabelas de preço vinculadas a este plano também serão removidas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirPlano} className="bg-destructive text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm excluir tabela */}
      <AlertDialog open={!!deleteTabelaId} onOpenChange={(o) => !o && setDeleteTabelaId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tabela?</AlertDialogTitle>
            <AlertDialogDescription>Todos os itens de preço serão removidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirTabela} className="bg-destructive text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Helper: vincula automaticamente um item da tabela ao procedimento cadastrado ──
// Tenta casar pelo procedimentoId já definido, depois por código TUSS, depois por nome.
// Retorna o item com procedimentoId preenchido (ou inalterado se não encontrou).
function autoVincularProcedimento(
  item: Omit<ItemTabelaPreco, "id"> & { id?: string },
  procs: { id: string; name: string; tussCode: string; category: string }[]
): typeof item {
  try {
    if (!procs.length) return item;

    // 1. Já tem vínculo? valida se ainda existe
    if (item.procedimentoId) {
      const still = procs.find((p) => p.id === item.procedimentoId);
      if (still) return item; // vínculo válido, não mexe
    }

    // 2. Casa por código TUSS (mais confiável)
    if (item.codigoTUSS?.trim()) {
      const byTUSS = procs.find((p) => p.tussCode?.trim() === item.codigoTUSS.trim());
      if (byTUSS) return { ...item, procedimentoId: byTUSS.id };
    }

    // 3. Casa por nome (normalizado, sem acentos/case)
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    const byName = procs.find(
      (p) => normalize(p.name) === normalize(item.procedimento)
    );
    if (byName) return { ...item, procedimentoId: byName.id };
  } catch { /* se falhar, retorna item original */ }

  return item;
}

// VIEW 3 — TABELA DE PREÇO (itens + import/export Excel)
// ═══════════════════════════════════════════════════════════════════════════
function TabelaPrecoView({
  convenio, tabela, onPersist,
}: {
  convenio: Convenio;
  tabela: TabelaPreco;
  onPersist: (t: TabelaPreco) => void;
}) {
  const plano = convenio.planos.find((p) => p.id === tabela.planoId);

  const [itens, setItens] = useState<ItemTabelaPreco[]>(tabela.itens);
  const [q, setQ]         = useState("");
  const [itemOpen, setItemOpen]   = useState(false);
  const [editItem, setEditItem]   = useState<ItemTabelaPreco | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [itemForm, setItemForm]   = useState({ codigoTUSS: "", procedimento: "", procedimentoId: "" as string | undefined, categoria: "Consulta", valor: "" });
  const [procSuggestions, setProcSuggestions] = useState<{ id: string; name: string; tussCode: string; category: string }[]>([]);
  const [showProcSugg, setShowProcSugg] = useState(false);

  const [allProcedimentos, setAllProcedimentos] = useState<{ id: string; name: string; tussCode: string; category: string }[]>([]);

  // Carrega procedimentos do Supabase para autocomplete e vínculo
  useEffect(() => {
    listarProcedimentos().then((lista) => {
      setAllProcedimentos(lista.map((p: any) => ({
        id: p.id,
        name: p.name,
        tussCode: p.tussCode ?? "",
        category: p.category ?? "",
      })));
    }).catch(() => {});
  }, []);
  const [importLog, setImportLog] = useState<{ ok: number; erro: number; msgs: string[] } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Salva automaticamente ao mudar itens
  useEffect(() => {
    onPersist({ ...tabela, itens });
  }, [itens]);

  const filtrados = useMemo(() =>
    itens.filter((i) =>
      [i.procedimento, i.codigoTUSS, i.categoria].some((f) =>
        f.toLowerCase().includes(q.toLowerCase())
      )
    ),
    [itens, q]
  );

  const totalTabela = useMemo(() => itens.reduce((s, i) => s + i.valor, 0), [itens]);

  // ── CRUD itens ──────────────────────────────────────────────────────────
  function abrirNovoItem() {
    setEditItem(null);
    setItemForm({ codigoTUSS: "", procedimento: "", procedimentoId: undefined, categoria: "Consulta", valor: "" });
    setItemOpen(true);
  }

  function abrirEditItem(item: ItemTabelaPreco) {
    setEditItem(item);
    setItemForm({ codigoTUSS: item.codigoTUSS, procedimento: item.procedimento, procedimentoId: item.procedimentoId, categoria: item.categoria, valor: String(item.valor) });
    setItemOpen(true);
  }

  function salvarItem() {
    if (!itemForm.procedimento.trim()) { toast.error("Informe o procedimento"); return; }
    const valor = parseFloat(itemForm.valor.replace(",", "."));
    if (isNaN(valor) || valor < 0) { toast.error("Valor inválido"); return; }

    const formVinculado = autoVincularProcedimento({ ...itemForm, valor }, allProcedimentos);

    if (editItem) {
      setItens((prev) => prev.map((i) => i.id === editItem.id ? { ...i, ...formVinculado } : i));
      toast.success(formVinculado.procedimentoId ? "Item atualizado e vinculado ao cadastro" : "Item atualizado");
    } else {
      setItens((prev) => [...prev, { id: `it_${uid()}`, ...formVinculado }]);
      toast.success(formVinculado.procedimentoId ? "Item adicionado e vinculado ao cadastro" : "Item adicionado");
    }
    setItemOpen(false);
  }

  function excluirItem() {
    if (!deleteItemId) return;
    setItens((prev) => prev.filter((i) => i.id !== deleteItemId));
    setDeleteItemId(null);
    toast.success("Item removido");
  }

  // ── EXPORTAR modelo Excel ───────────────────────────────────────────────
  function exportarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Código TUSS", "Procedimento", "Categoria", "Valor (R$)"],
      ["10101012", "Consulta Clínica", "Consulta", "180.00"],
      ["10101039", "Retorno", "Consulta", "100.00"],
      ["40302361", "Eletrocardiograma", "Exame", "90.00"],
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tabela de Preços");
    XLSX.writeFile(wb, `modelo_tabela_precos_${convenio.name.replace(/\s+/g, "_")}.xlsx`);
    toast.success("Modelo Excel baixado!");
  }

  // ── EXPORTAR tabela atual ───────────────────────────────────────────────
  function exportarTabela() {
    if (itens.length === 0) { toast.error("Nenhum item para exportar"); return; }
    const linhas = [
      ["Convênio", "Plano", "Tabela", "Vigência Início", "Vigência Fim"],
      [convenio.name, plano?.nome ?? "—", tabela.nome, tabela.vigenciaInicio, tabela.vigenciaFim],
      [],
      ["Código TUSS", "Procedimento", "Categoria", "Valor (R$)"],
      ...itens.map((i) => [i.codigoTUSS, i.procedimento, i.categoria, i.valor]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 16 }, { wch: 36 }, { wch: 18 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tabela");
    XLSX.writeFile(wb, `tabela_${convenio.name.replace(/\s+/g,"_")}_${tabela.nome.replace(/\s+/g,"_")}.xlsx`);
    toast.success("Tabela exportada!");
  }

  // ── IMPORTAR Excel ──────────────────────────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1 }) as unknown[][];

        // Detecta linha de cabeçalho (busca "Procedimento" ou "procedimento")
        let headerRow = -1;
        for (let r = 0; r < Math.min(rows.length, 10); r++) {
          const row = rows[r] as string[];
          if (row.some((c) => String(c ?? "").toLowerCase().includes("procedimento"))) {
            headerRow = r;
            break;
          }
        }
        if (headerRow === -1) { toast.error("Cabeçalho não encontrado. Use o modelo Excel."); return; }

        const header = (rows[headerRow] as string[]).map((c) => String(c ?? "").toLowerCase().trim());
        const colTUSS  = header.findIndex((h) => h.includes("tuss") || h.includes("código") || h.includes("codigo"));
        const colProc  = header.findIndex((h) => h.includes("procedimento"));
        const colCat   = header.findIndex((h) => h.includes("categor"));
        const colValor = header.findIndex((h) => h.includes("valor"));

        if (colProc === -1 || colValor === -1) {
          toast.error("Colunas 'Procedimento' e 'Valor' são obrigatórias.");
          return;
        }

        const novos: ItemTabelaPreco[] = [];
        const erros: string[] = [];

        for (let r = headerRow + 1; r < rows.length; r++) {
          const row = rows[r] as (string | number)[];
          const proc  = String(row[colProc] ?? "").trim();
          const valorRaw = row[colValor];
          if (!proc) continue;

          const valor = parseFloat(String(valorRaw).replace(",", "."));
          if (isNaN(valor)) {
            erros.push(`Linha ${r + 1}: valor inválido "${valorRaw}" para "${proc}"`);
            continue;
          }

          novos.push(autoVincularProcedimento({
            id:          `it_${uid()}`,
            codigoTUSS:  colTUSS >= 0 ? String(row[colTUSS] ?? "").trim() : "",
            procedimento: proc,
            categoria:   colCat >= 0 ? String(row[colCat] ?? "").trim() || "Consulta" : "Consulta",
            valor,
          }, allProcedimentos));
        }

        setImportLog({ ok: novos.length, erro: erros.length, msgs: erros });
        setItens((prev) => {
          // merge: atualiza existente pelo nome, adiciona novo
          const mapa = new Map(prev.map((i) => [i.procedimento.toLowerCase(), i]));
          novos.forEach((n) => mapa.set(n.procedimento.toLowerCase(), n));
          return Array.from(mapa.values());
        });
        setImportOpen(true);
      } catch {
        toast.error("Erro ao ler o arquivo. Verifique se é um .xlsx válido.");
      }
      // limpa input para permitir re-importar mesmo arquivo
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  }

  return (
    <div className="space-y-6">
      {/* Header da tabela */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">{tabela.nome}</h2>
        <div className="flex gap-3 text-sm text-slate-500 mt-1 flex-wrap">
          <span><strong className="text-slate-700">{convenio.name}</strong></span>
          <span>·</span>
          <span className="text-violet-700 font-medium">{plano?.nome ?? "—"}</span>
          {tabela.vigenciaInicio && <span>· Início: {new Date(tabela.vigenciaInicio + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
          {tabela.vigenciaFim    && <span>· Fim: {new Date(tabela.vigenciaFim + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Procedimentos",  value: itens.length,      icon: <ListChecks className="w-5 h-5" />, cor: "bg-cyan-100 text-cyan-700" },
          { label: "Soma dos valores", value: fmtBRL(totalTabela), icon: <DollarSign className="w-5 h-5" />, cor: "bg-green-100 text-green-700" },
          { label: "Categorias",     value: new Set(itens.map((i) => i.categoria)).size, icon: <Tag className="w-5 h-5" />, cor: "bg-violet-100 text-violet-700" },
        ].map((s) => (
          <Card key={s.label} className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.cor}`}>{s.icon}</div>
              <div>
                <p className="text-xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar procedimento ou TUSS..." className="pl-9 rounded-xl" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportarModelo} className="rounded-xl gap-1.5">
            <Download className="w-4 h-4" /> Modelo Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportarTabela} className="rounded-xl gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
            <FileSpreadsheet className="w-4 h-4" /> Exportar
          </Button>
          <label className="cursor-pointer">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
            <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5 text-cyan-700 border-cyan-300 hover:bg-cyan-50" onClick={() => fileRef.current?.click()}>
              <span><UploadCloud className="w-4 h-4" /> Importar Excel</span>
            </Button>
          </label>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-violet-700 border-violet-300 hover:bg-violet-50"
            onClick={() => {
              let vinculados = 0;
              setItens((prev) => prev.map((item) => {
                if (item.procedimentoId) return item; // já vinculado
                const novo = autoVincularProcedimento(item, allProcedimentos);
                if (novo.procedimentoId) vinculados++;
                return novo;
              }));
              toast.success(vinculados > 0 ? `${vinculados} item(ns) vinculado(s) ao cadastro` : "Nenhum novo vínculo encontrado");
            }}
          >
            🔗 Vincular todos
          </Button>
          <Button size="sm" onClick={abrirNovoItem} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-1.5">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Info importação */}
      <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          O Excel deve ter as colunas: <strong>Código TUSS, Procedimento, Categoria, Valor (R$)</strong>. 
          Use o botão <em>Modelo Excel</em> para baixar um exemplo preenchido. 
          Ao importar, procedimentos já existentes são atualizados pelo nome.
          O sistema vincula automaticamente os itens ao <strong>cadastro de procedimentos</strong> pelo código TUSS ou nome — itens vinculados têm o valor da tabela usado na agenda.
        </span>
      </div>

      {/* Tabela de itens */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center text-slate-400">
            {itens.length === 0 ? (
              <>
                <DollarSign className="w-12 h-12 opacity-20" />
                <p className="font-medium">Nenhum procedimento na tabela</p>
                <p className="text-sm">Importe um Excel ou adicione manualmente</p>
              </>
            ) : (
              <p className="text-sm">Nenhum resultado para "<strong>{q}</strong>"</p>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Código TUSS</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Vínculo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs text-slate-500">{item.codigoTUSS || "—"}</TableCell>
                  <TableCell className="font-medium text-slate-800">{item.procedimento}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{item.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {item.procedimentoId ? (
                      <span title="Vinculado ao procedimento cadastrado" className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                        ✓ Vinculado
                      </span>
                    ) : (
                      <span title="Não vinculado ao cadastro de procedimentos" className="inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                        ⚠ Não vinculado
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{fmtBRL(item.valor)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrirEditItem(item)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteItemId(item.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog item */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar item" : "Novo procedimento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código TUSS</Label>
                <Input value={itemForm.codigoTUSS} onChange={(e) => setItemForm({ ...itemForm, codigoTUSS: e.target.value })} className="rounded-xl font-mono" placeholder="10101012" />
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={itemForm.categoria} onValueChange={(v) => setItemForm({ ...itemForm, categoria: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="relative">
              <Label className="text-xs">Procedimento *</Label>
              <Input
                value={itemForm.procedimento}
                onChange={(e) => {
                  const v = e.target.value;
                  setItemForm({ ...itemForm, procedimento: v, procedimentoId: undefined });
                  if (v.length >= 2) {
                    const matches = allProcedimentos.filter((p: any) =>
                      p.name.toLowerCase().includes(v.toLowerCase()) ||
                      (p.tussCode && p.tussCode.includes(v))
                    ).slice(0, 6);
                    setProcSuggestions(matches);
                    setShowProcSugg(matches.length > 0);
                  } else {
                    setShowProcSugg(false);
                  }
                }}
                onFocus={() => {
                  if (itemForm.procedimento.length >= 2 && procSuggestions.length > 0) setShowProcSugg(true);
                }}
                onBlur={() => setTimeout(() => setShowProcSugg(false), 150)}
                className="rounded-xl"
                placeholder="Digite para buscar procedimento cadastrado…"
              />
              {showProcSugg && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-popover shadow-lg">
                  {procSuggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition first:rounded-t-lg last:rounded-b-lg"
                      onMouseDown={() => {
                        setItemForm({
                          ...itemForm,
                          procedimento: p.name,
                          procedimentoId: p.id,
                          codigoTUSS: p.tussCode || itemForm.codigoTUSS,
                          categoria: p.category || itemForm.categoria,
                        });
                        setShowProcSugg(false);
                      }}
                    >
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.tussCode ? `TUSS: ${p.tussCode} · ` : ""}{p.category}</p>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border">
                    Não encontrou? Digite livremente e pressione Enter.
                  </div>
                </div>
              )}
              {itemForm.procedimentoId && (
                <p className="mt-1 text-[11px] text-success flex items-center gap-1">
                  ✓ vinculado ao procedimento cadastrado
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Valor (R$) *</Label>
              <Input
                value={itemForm.valor}
                onChange={(e) => setItemForm({ ...itemForm, valor: e.target.value })}
                className="rounded-xl"
                placeholder="0,00"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button onClick={salvarItem} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl">
              {editItem ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm excluir item */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(o) => !o && setDeleteItemId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover procedimento?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={excluirItem} className="bg-destructive text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal resultado da importação */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Resultado da importação</DialogTitle>
          </DialogHeader>
          {importLog && (
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex-1">
                  <Check className="w-5 h-5" />
                  <div>
                    <p className="font-bold text-lg">{importLog.ok}</p>
                    <p className="text-xs">importados</p>
                  </div>
                </div>
                {importLog.erro > 0 && (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex-1">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                      <p className="font-bold text-lg">{importLog.erro}</p>
                      <p className="text-xs">com erro</p>
                    </div>
                  </div>
                )}
              </div>
              {importLog.msgs.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                  {importLog.msgs.map((m, i) => (
                    <p key={i} className="text-xs text-slate-600 py-0.5">{m}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setImportOpen(false)} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl w-full">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// mantém compatibilidade com procedimentos.tsx
export function ComingSoon({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <Card className="border-border/60 shadow-elegant">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">{icon}</div>
          <h2 className="text-xl font-semibold">Em breve</h2>
          <p className="max-w-md text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </div>
  );
}