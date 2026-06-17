import { createFileRoute, useRouter, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, ShieldCheck, UserCheck, Users, X, Check, Stethoscope } from "lucide-react";

interface Professional { id: string; name: string; specialty?: string; }
function getProfissionais(): Professional[] {
  try { const s = localStorage.getItem("nexaclinic_professionals"); if (s) return JSON.parse(s); } catch {}
  return [];
}
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario,
  eAdmin,
  getUsuarioAtual,
  ROLE_LABELS,
  type AppUser,
  type UserRole,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/usuarios")({
  beforeLoad: () => {
    if (!eAdmin()) {
      throw redirect({ to: "/" });
    }
  },
  component: UsuariosPage,
});

type FormData = {
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  ativo: boolean;
  professionalId?: string;
  maxDesconto: number;
};

const FORM_VAZIO: FormData = { nome: "", email: "", senha: "", role: "recepcao", ativo: true, professionalId: "", maxDesconto: 0 };

function roleBadge(role: UserRole) {
  const colors: Record<UserRole, string> = {
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    medico: "bg-blue-100 text-blue-700 border-blue-200",
    recepcao: "bg-green-100 text-green-700 border-green-200",
    financeiro: "bg-amber-100 text-amber-700 border-amber-200",
  };
  return (
    <span className={"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " + colors[role]}>
      {role === "admin" && <ShieldCheck className="h-3 w-3" />}
      {ROLE_LABELS[role]}
    </span>
  );
}

function UsuariosPage() {
  const router = useRouter();
  const atual = getUsuarioAtual();
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [profissionais, setProfissionais] = useState<Professional[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<AppUser | null>(null);
  const [excluindo, setExcluindo] = useState<AppUser | null>(null);
  const [form, setForm] = useState<FormData>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  function recarregar() {
    setUsuarios(listarUsuarios());
    setProfissionais(getProfissionais());
  }

  useEffect(() => {
    recarregar();
  }, []);

  function abrirCriar() {
    setEditando(null);
    setForm(FORM_VAZIO);
    setModalAberto(true);
  }

  function abrirEditar(u: AppUser) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, senha: "", role: u.role, ativo: u.ativo, professionalId: u.professionalId ?? "", maxDesconto: u.maxDesconto ?? 0 });
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.nome || !form.email) {
      toast.error("Nome e e-mail são obrigatórios.");
      return;
    }
    if (!editando && !form.senha) {
      toast.error("Informe uma senha para o novo usuário.");
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        const dados: Partial<AppUser> = { nome: form.nome, email: form.email, role: form.role, ativo: form.ativo, professionalId: form.professionalId || undefined, maxDesconto: form.maxDesconto ?? 0 };
        if (form.senha) dados.senha = form.senha;
        atualizarUsuario(editando.id, dados);
        toast.success("Usuário atualizado com sucesso.");
      } else {
        criarUsuario({ nome: form.nome, email: form.email, senha: form.senha, role: form.role, ativo: form.ativo, professionalId: form.professionalId || undefined, maxDesconto: form.maxDesconto ?? 0 });
        toast.success("Usuário criado com sucesso.");
      }
      setModalAberto(false);
      recarregar();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExcluir() {
    if (!excluindo) return;
    try {
      excluirUsuario(excluindo.id);
      toast.success("Usuário removido.");
      setExcluindo(null);
      recarregar();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao excluir.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gerenciar Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie e gerencie os acessos ao sistema. Somente administradores têm acesso a esta tela.
          </p>
        </div>
        <Button onClick={abrirCriar} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["admin", "medico", "recepcao", "financeiro"] as UserRole[]).map((role) => {
          const count = usuarios.filter((u) => u.role === role).length;
          return (
            <div key={role} className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <UserCheck className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                <p className="text-xl font-bold text-foreground">{count}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border/60 bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">E-mail</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Perfil</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profissional vinculado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  {u.nome}
                  {u.id === atual?.id && (
                    <span className="ml-2 text-[10px] text-muted-foreground">(você)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {u.professionalId
                    ? (() => { const p = profissionais.find(x => x.id === u.professionalId); return p ? (<span className="flex items-center gap-1 text-teal-700 font-medium"><Stethoscope className="h-3 w-3" />{p.name}</span>) : <span className="text-slate-400 italic">ID não encontrado</span>; })()
                    : <span className="text-slate-400">—</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <span className={
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                    (u.ativo ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-600 border-red-200")
                  }>
                    {u.ativo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {u.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEditar(u)} title="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExcluindo(u)}
                      title="Excluir"
                      disabled={u.email === "jeanmarkys@hotmail.com"}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria Silva" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>{editando ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
              <Input
                type="password"
                value={form.senha}
                onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.role === "medico" || form.role === "admin") && profissionais.length > 0 && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Stethoscope className="h-3.5 w-3.5 text-teal-600" />
                  Vincular ao profissional (Consultório)
                </Label>
                <Select
                  value={form.professionalId ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, professionalId: v === "__none__" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sem vínculo —</SelectItem>
                    {profissionais.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}{p.specialty ? ` — ${p.specialty}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O consultório exibirá apenas os agendamentos deste profissional.
                </p>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">Desconto máximo permitido (%)</Label>
              <div className="flex items-center gap-3 mt-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={form.maxDesconto}
                  onChange={(e) => setForm((f) => ({ ...f, maxDesconto: Number(e.target.value) }))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="w-14 text-right text-sm font-semibold text-cyan-600">
                  {form.maxDesconto}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Percentual máximo que este usuário pode conceder de desconto ao registrar um pagamento.
                {form.maxDesconto === 0 && " (0% = sem permissão para descontos)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="ativo"
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
                className="rounded border-border"
              />
              <Label htmlFor="ativo" className="cursor-pointer font-normal">
                Usuário ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{excluindo?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
