import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import {
  Settings,
  User,
  Shield,
  Building2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  Key,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  Save,
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  Download,
  Upload,
  Clock,
  AlertTriangle,
  Database,
  CheckCircle2,
} from "lucide-react";
import {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
  excluirUsuario,
  eAdmin,
  getUsuarioAtual,
  listarAuditoria,
  ROLE_LABELS,
  type AppUser,
  type UserRole,
  type Permissoes,
  type AuditEntry,
} from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { supabase } from "@/lib/supabase";

// ─── Empresa: funções Supabase ────────────────────────────────────────────────
// A tabela "configuracoes_empresa" deve ter uma única linha com id fixo
const EMPRESA_ROW_ID = "clinica";

async function getEmpresaDb() {
  const { data, error } = await supabase
    .from("configuracoes_empresa")
    .select("*")
    .eq("id", EMPRESA_ROW_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function salvarEmpresaDb(dados: Record<string, unknown>) {
  const { error } = await supabase
    .from("configuracoes_empresa")
    .upsert({ ...dados, id: EMPRESA_ROW_ID }, { onConflict: "id" });
  if (error) throw error;
}

// ─── Route ────────────────────────────────────────────────────────────────────
export const Route = createFileRoute("/configuracoes")({
  beforeLoad: () => {
    if (!eAdmin()) throw redirect({ to: "/" });
  },
  component: ConfiguracoesPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
type Aba = "menu" | "usuarios" | "senha" | "perfis" | "empresa" | "auditoria" | "backup" | "horarios";

// Perfis personalizados salvos no localStorage
interface Perfil {
  id: string;
  nome: string;
  descricao: string;
  permissoes: Record<keyof Permissoes, boolean>;
  criadoEm: string;
}

const PERFIS_KEY = "nexaclinic_perfis";
const EMPRESA_KEY = "nexaclinic_empresa";
const HORARIOS_KEY = "nexaclinic_horarios";

const PERMISSAO_LABELS: Record<keyof Permissoes, string> = {
  verDashboard: "Ver Dashboard",
  verFinanceiro: "Ver Financeiro Completo",
  editarRepasse: "Editar Repasses",
  verRepasseProprioApenas: "Ver Apenas Próprio Repasse",
  gerenciarUsuarios: "Gerenciar Usuários",
  gerenciarProfissionais: "Gerenciar Profissionais",
  editarPacientes: "Editar Pacientes",
  cancelarConsultas: "Cancelar Consultas",
  verRelatorios: "Ver Relatórios",
  acessarConfiguracoes: "Acessar Configurações",
  excluirRegistros: "Excluir Registros (Profissional / Convênio / Procedimento / Paciente)",
  cancelarAgendamento: "Cancelar Agendamentos",
};

const PERMISSOES_GRUPOS = [
  {
    grupo: "Geral",
    chaves: ["verDashboard"] as (keyof Permissoes)[],
  },
  {
    grupo: "Financeiro",
    chaves: ["verFinanceiro", "editarRepasse", "verRepasseProprioApenas"] as (keyof Permissoes)[],
  },
  {
    grupo: "Clínica",
    chaves: ["gerenciarProfissionais", "editarPacientes", "cancelarConsultas", "cancelarAgendamento", "excluirRegistros"] as (keyof Permissoes)[],
  },
  {
    grupo: "Sistema",
    chaves: ["gerenciarUsuarios", "verRelatorios", "acessarConfiguracoes", "excluirRegistros"] as (keyof Permissoes)[],
  },
];

const PERMISSOES_VAZIAS: Record<keyof Permissoes, boolean> = {
  verDashboard: false,
  verFinanceiro: false,
  editarRepasse: false,
  verRepasseProprioApenas: false,
  gerenciarUsuarios: false,
  gerenciarProfissionais: false,
  editarPacientes: false,
  cancelarConsultas: false,
  verRelatorios: false,
  acessarConfiguracoes: false,
  excluirRegistros: false,
  cancelarAgendamento: false,
};

// getPerfis/setPerfis migrados para Supabase — ver listarPerfisDb/salvarPerfilDb/excluirPerfilDb

interface EmpresaData {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cnes: string;
  telefone: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  logo: string;
}

const EMPRESA_VAZIA: EmpresaData = {
  razaoSocial: "", nomeFantasia: "", cnpj: "", cnes: "",
  telefone: "", email: "", endereco: "", numero: "",
  complemento: "", bairro: "", cidade: "", estado: "", cep: "", logo: "",
};

// getEmpresa/setEmpresa migrados para Supabase — ver getEmpresaDb/salvarEmpresaDb

// ─── Helpers visuais ──────────────────────────────────────────────────────────
function roleBadge(role: UserRole) {
  const colors: Record<UserRole, string> = {
    admin: "bg-purple-100 text-purple-700",
    medico: "bg-blue-100 text-blue-700",
    recepcao: "bg-green-100 text-green-700",
    financeiro: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function ConfiguracoesPage() {
  const [aba, setAba] = useState<Aba>("menu");

  const menus = [
    { id: "usuarios" as Aba, icon: Users, label: "Usuários", desc: "Criar, editar e desativar usuários do sistema", cor: "bg-cyan-100 text-cyan-600" },
    { id: "senha" as Aba, icon: Key, label: "Alterar Senha", desc: "Trocar senha do usuário logado ou de outro usuário", cor: "bg-emerald-100 text-emerald-600" },
    { id: "perfis" as Aba, icon: ShieldCheck, label: "Perfis e Permissões", desc: "Configurar perfis customizados de acesso", cor: "bg-violet-100 text-violet-600" },
    { id: "empresa" as Aba, icon: Building2, label: "Empresa", desc: "Dados da clínica, CNPJ, endereço e logotipo", cor: "bg-orange-100 text-orange-600" },
    { id: "horarios" as Aba, icon: Clock, label: "Horários de Funcionamento", desc: "Defina os dias e horários de atendimento da clínica", cor: "bg-sky-100 text-sky-600" },
    { id: "backup" as Aba, icon: Database, label: "Backup e Restauração", desc: "Exportar todos os dados como JSON ou restaurar um backup", cor: "bg-teal-100 text-teal-600" },
    { id: "auditoria" as Aba, icon: ClipboardList, label: "Log de Auditoria", desc: "Histórico de todas as ações realizadas por usuário", cor: "bg-rose-100 text-rose-600" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {aba !== "menu" && (
        <button
          onClick={() => setAba("menu")}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-cyan-600 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar às configurações
        </button>
      )}

      {aba === "menu" && (
        <>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <Settings className="w-8 h-8 text-cyan-600" /> Configurações
            </h1>
            <p className="text-slate-500 mt-1">Gerencie usuários, permissões e dados da clínica</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {menus.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setAba(m.id)}
                  className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-cyan-300 transition text-left group"
                >
                  <div className={`p-3 rounded-xl ${m.cor} shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 group-hover:text-cyan-700">{m.label}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{m.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-cyan-500" />
                </button>
              );
            })}
          </div>
        </>
      )}

      {aba === "usuarios" && <AbaUsuarios />}
      {aba === "senha" && <AbaSenha />}
      {aba === "perfis" && <AbaPerfis />}
      {aba === "empresa" && <AbaEmpresa />}
      {aba === "horarios" && <AbaHorarios />}
      {aba === "backup" && <AbaBackup />}
      {aba === "auditoria" && <AbaAuditoria />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: USUÁRIOS
// ══════════════════════════════════════════════════════════════════════════════
type UserForm = { nome: string; email: string; senha: string; role: UserRole; ativo: boolean };
const USER_FORM_VAZIO: UserForm = { nome: "", email: "", senha: "", role: "recepcao", ativo: true };

function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [busca, setBusca] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<AppUser | null>(null);
  const [excluindo, setExcluindo] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>(USER_FORM_VAZIO);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erros, setErros] = useState<Partial<UserForm>>({});

  function recarregar() { setUsuarios(listarUsuarios()); }
  useEffect(() => { recarregar(); }, []);

  const filtrados = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase())
  );

  function abrirNovo() {
    setEditando(null);
    setForm(USER_FORM_VAZIO);
    setErros({});
    setMostrarSenha(false);
    setModalAberto(true);
  }

  function abrirEditar(u: AppUser) {
    setEditando(u);
    setForm({ nome: u.nome, email: u.email, senha: "", role: u.role, ativo: u.ativo });
    setErros({});
    setMostrarSenha(false);
    setModalAberto(true);
  }

  function validar(): boolean {
    const e: Partial<UserForm> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "E-mail inválido";
    if (!editando && !form.senha.trim()) e.senha = "Senha obrigatória";
    if (form.senha && form.senha.length < 6) e.senha = "Mínimo 6 caracteres";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function salvar() {
    if (!validar()) return;
    try {
      if (editando) {
        const dados: Partial<AppUser> = { nome: form.nome, email: form.email, role: form.role, ativo: form.ativo };
        if (form.senha) dados.senha = form.senha;
        atualizarUsuario(editando.id, dados);
        toast.success("Usuário atualizado!");
      } else {
        criarUsuario({ nome: form.nome, email: form.email, senha: form.senha, role: form.role, ativo: form.ativo });
        toast.success("Usuário criado!");
      }
      setModalAberto(false);
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    }
  }

  function confirmarExcluir() {
    if (!excluindo) return;
    try {
      excluirUsuario(excluindo.id);
      toast.success("Usuário excluído!");
      setExcluindo(null);
      recarregar();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    }
  }

  function toggleAtivo(u: AppUser) {
    try {
      atualizarUsuario(u.id, { ativo: !u.ativo });
      recarregar();
      toast.success(u.ativo ? "Usuário desativado" : "Usuário ativado");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-cyan-600" /> Usuários
          </h2>
          <p className="text-slate-500 text-sm mt-1">{usuarios.length} usuário(s) cadastrado(s)</p>
        </div>
        <Button onClick={abrirNovo} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <input
        placeholder="Buscar por nome ou e-mail..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">E-mail</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Perfil</th>
              <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-slate-400">Nenhum usuário encontrado.</td></tr>
            )}
            {filtrados.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                <td className="px-4 py-3 font-medium text-slate-800">{u.nome}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 text-center">
                  <Switch checked={u.ativo} onCheckedChange={() => toggleAtivo(u)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => abrirEditar(u)} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setExcluindo(u)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal criar/editar */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome completo</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 rounded-xl" />
              {erros.nome && <p className="text-xs text-red-500 mt-1">{erros.nome}</p>}
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 rounded-xl" />
              {erros.email && <p className="text-xs text-red-500 mt-1">{erros.email}</p>}
            </div>
            <div>
              <Label>{editando ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
              <div className="relative mt-1">
                <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  className="rounded-xl pr-10"
                />
                <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {erros.senha && <p className="text-xs text-red-500 mt-1">{erros.senha}</p>}
            </div>
            <div>
              <Label>Perfil de acesso</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as UserRole })}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <span className="text-sm text-slate-700">Usuário ativo</span>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={salvar} className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl">
              <Save className="w-4 h-4 mr-1" /> {editando ? "Salvar" : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{excluindo?.nome}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: ALTERAR SENHA
// ══════════════════════════════════════════════════════════════════════════════
function AbaSenha() {
  const usuarioAtual = getUsuarioAtual();
  const [modo, setModo] = useState<"proprio" | "outro">("proprio");
  const [usuarios, setUsuarios] = useState<AppUser[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState({ atual: false, nova: false, conf: false });
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => { setUsuarios(listarUsuarios().filter((u) => u.id !== usuarioAtual?.id)); }, [usuarioAtual?.id]);

  function validar() {
    const e: Record<string, string> = {};
    if (modo === "proprio" && !senhaAtual) e.senhaAtual = "Informe a senha atual";
    if (!novaSenha || novaSenha.length < 6) e.novaSenha = "Mínimo 6 caracteres";
    if (novaSenha !== confirmar) e.confirmar = "Senhas não conferem";
    if (modo === "outro" && !usuarioSelecionado) e.usuario = "Selecione um usuário";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  function salvar() {
    if (!validar()) return;
    try {
      if (modo === "proprio") {
        if (!usuarioAtual) return;
        if (usuarioAtual.senha !== senhaAtual) {
          setErros({ senhaAtual: "Senha atual incorreta" });
          return;
        }
        atualizarUsuario(usuarioAtual.id, { senha: novaSenha });
        toast.success("Senha alterada com sucesso!");
      } else {
        atualizarUsuario(usuarioSelecionado, { senha: novaSenha });
        toast.success("Senha do usuário alterada!");
      }
      setSenhaAtual(""); setNovaSenha(""); setConfirmar(""); setUsuarioSelecionado("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    }
  }

  const mostraBotao = (k: keyof typeof mostrar) => () => setMostrar((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Key className="w-6 h-6 text-emerald-600" /> Alterar Senha
        </h2>
        <p className="text-slate-500 text-sm mt-1">Altere sua senha ou a de outro usuário</p>
      </div>

      {/* Seletor de modo */}
      <div className="flex gap-3">
        {([["proprio", "Minha senha"], ["outro", "Senha de outro usuário"]] as const).map(([m, label]) => (
          <button
            key={m}
            onClick={() => { setModo(m); setErros({}); setSenhaAtual(""); setNovaSenha(""); setConfirmar(""); }}
            className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition ${
              modo === m
                ? "bg-emerald-600 border-emerald-600 text-white"
                : "border-slate-200 text-slate-600 hover:border-emerald-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        {modo === "outro" && (
          <div>
            <Label>Usuário</Label>
            <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue placeholder="Selecione o usuário..." />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome} — {ROLE_LABELS[u.role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {erros.usuario && <p className="text-xs text-red-500 mt-1">{erros.usuario}</p>}
          </div>
        )}

        {modo === "proprio" && (
          <div>
            <Label>Senha atual</Label>
            <div className="relative mt-1">
              <Input type={mostrar.atual ? "text" : "password"} value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} className="rounded-xl pr-10" />
              <button type="button" onClick={mostraBotao("atual")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                {mostrar.atual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {erros.senhaAtual && <p className="text-xs text-red-500 mt-1">{erros.senhaAtual}</p>}
          </div>
        )}

        <div>
          <Label>Nova senha</Label>
          <div className="relative mt-1">
            <Input type={mostrar.nova ? "text" : "password"} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} className="rounded-xl pr-10" />
            <button type="button" onClick={mostraBotao("nova")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {mostrar.nova ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {erros.novaSenha && <p className="text-xs text-red-500 mt-1">{erros.novaSenha}</p>}
        </div>

        <div>
          <Label>Confirmar nova senha</Label>
          <div className="relative mt-1">
            <Input type={mostrar.conf ? "text" : "password"} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className="rounded-xl pr-10" />
            <button type="button" onClick={mostraBotao("conf")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              {mostrar.conf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {erros.confirmar && <p className="text-xs text-red-500 mt-1">{erros.confirmar}</p>}
        </div>

        {/* Força da senha */}
        {novaSenha && (
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Força da senha</p>
            <div className="flex gap-1.5">
              {[6, 8, 10, 12].map((min, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    novaSenha.length >= min
                      ? ["bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-emerald-500"][i]
                      : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400">
              {novaSenha.length < 6 ? "Muito fraca" : novaSenha.length < 8 ? "Fraca" : novaSenha.length < 10 ? "Média" : novaSenha.length < 12 ? "Boa" : "Forte"}
            </p>
          </div>
        )}

        <Button onClick={salvar} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">
          <Save className="w-4 h-4 mr-2" /> Salvar Nova Senha
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: PERFIS E PERMISSÕES
// ══════════════════════════════════════════════════════════════════════════════
function AbaPerfis() {
  const [perfis, setPerfisState] = useState<Perfil[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Perfil | null>(null);
  const [excluindo, setExcluindo] = useState<Perfil | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", permissoes: { ...PERMISSOES_VAZIAS } });

  async function recarregar() {
    const lista = await listarPerfisDb();
    setPerfisState(lista as Perfil[]);
  }
  useEffect(() => { recarregar(); }, []);

  function abrirNovo() {
    setEditando(null);
    setForm({ nome: "", descricao: "", permissoes: { ...PERMISSOES_VAZIAS } });
    setModalAberto(true);
  }

  function abrirEditar(p: Perfil) {
    setEditando(p);
    setForm({ nome: p.nome, descricao: p.descricao, permissoes: { ...p.permissoes } });
    setModalAberto(true);
  }

  async function salvar() {
    if (!form.nome.trim()) { toast.error("Informe um nome para o perfil"); return; }
    try {
      await salvarPerfilDb(editando ? { ...editando, ...form } : { id: `prf_${Date.now()}`, ...form, criadoEm: new Date().toISOString() });
      await recarregar();
      setModalAberto(false);
      toast.success(editando ? "Perfil atualizado!" : "Perfil criado!");
    } catch { toast.error("Erro ao salvar perfil"); }
  }

  async function confirmarExcluir() {
    if (!excluindo) return;
    try {
      await excluirPerfilDb(excluindo.id);
      await recarregar();
      setExcluindo(null);
      toast.success("Perfil excluído!");
    } catch { toast.error("Erro ao excluir perfil"); }
  }

  function togglePermissao(chave: keyof Permissoes) {
    setForm((f) => ({ ...f, permissoes: { ...f.permissoes, [chave]: !f.permissoes[chave] } }));
  }

  const totalAtivos = (p: Record<keyof Permissoes, boolean>) =>
    Object.values(p).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-violet-600" /> Perfis e Permissões
          </h2>
          <p className="text-slate-500 text-sm mt-1">Configure perfis customizados de acesso ao sistema</p>
        </div>
        <Button onClick={abrirNovo} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2">
          <Plus className="w-4 h-4" /> Novo Perfil
        </Button>
      </div>

      {/* Perfis do sistema (somente leitura) */}
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wide">Perfis padrão do sistema</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
            <div key={role} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <div>
                <p className="font-medium text-slate-700 text-sm">{ROLE_LABELS[role]}</p>
                <p className="text-xs text-slate-400">Perfil fixo do sistema</p>
              </div>
              <span className="ml-auto text-xs text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">Padrão</span>
            </div>
          ))}
        </div>
      </div>

      {/* Perfis customizados */}
      <div>
        <p className="text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wide">Perfis personalizados ({perfis.length})</p>
        {perfis.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum perfil criado ainda</p>
            <p className="text-sm mt-1">Clique em "Novo Perfil" para criar um perfil personalizado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {perfis.map((p) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-slate-800">{p.nome}</p>
                    {p.descricao && <p className="text-xs text-slate-500 mt-0.5">{p.descricao}</p>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => abrirEditar(p)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setExcluindo(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all"
                      style={{ width: `${(totalAtivos(p.permissoes) / Object.keys(PERMISSOES_VAZIAS).length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{totalAtivos(p.permissoes)}/{Object.keys(PERMISSOES_VAZIAS).length}</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Criado em {new Date(p.criadoEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal perfil */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome do perfil</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="mt-1 rounded-xl" placeholder="Ex: Coordenador" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="mt-1 rounded-xl" placeholder="Breve descrição do perfil" />
            </div>
            <div>
              <Label className="mb-2 block">Permissões</Label>
              <div className="space-y-4">
                {PERMISSOES_GRUPOS.map((grupo) => (
                  <div key={grupo.grupo}>
                    <p className="text-xs font-semibold uppercase text-slate-400 mb-2 tracking-wide">{grupo.grupo}</p>
                    <div className="space-y-2">
                      {grupo.chaves.map((chave) => (
                        <div key={chave} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 bg-slate-50">
                          <div className="flex items-center gap-2">
                            {form.permissoes[chave] ? (
                              <Check className="w-3.5 h-3.5 text-violet-600" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-slate-300" />
                            )}
                            <span className="text-sm text-slate-700">{PERMISSAO_LABELS[chave]}</span>
                          </div>
                          <Switch
                            checked={form.permissoes[chave]}
                            onCheckedChange={() => togglePermissao(chave)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={salvar} className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl">
              <Save className="w-4 h-4 mr-1" /> {editando ? "Salvar" : "Criar Perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              O perfil <strong>{excluindo?.nome}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExcluir} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: EMPRESA
// ══════════════════════════════════════════════════════════════════════════════
function AbaEmpresa() {
  const [dados, setDados] = useState<EmpresaData>(EMPRESA_VAZIA);
  useEffect(() => {
    getEmpresaDb().then((d) => { if (d) setDados(d as EmpresaData); }).catch(console.error);
  }, []);
  const [salvando, setSalvando] = useState(false);

  function campo(k: keyof EmpresaData) {
    return {
      value: dados[k],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDados({ ...dados, [k]: e.target.value }),
    };
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarEmpresaDb(dados);
      toast.success("Dados da empresa salvos!");
    } catch { toast.error("Erro ao salvar dados da empresa"); }
    finally { setSalvando(false); }
  }

  function formatarCNPJ(v: string) {
    const num = v.replace(/\D/g, "").slice(0, 14);
    return num
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function formatarTelefone(v: string) {
    const num = v.replace(/\D/g, "").slice(0, 11);
    if (num.length <= 10) return num.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return num.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  function formatarCEP(v: string) {
    return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  }

  const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-orange-600" /> Empresa / Clínica
        </h2>
        <p className="text-slate-500 text-sm mt-1">Dados da clínica exibidos em relatórios e documentos</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        {/* Identificação */}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Identificação</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Razão Social</Label>
              <Input {...campo("razaoSocial")} className="mt-1 rounded-xl" placeholder="Nome empresarial completo" />
            </div>
            <div>
              <Label>Nome Fantasia</Label>
              <Input {...campo("nomeFantasia")} className="mt-1 rounded-xl" placeholder="Nome da clínica" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={dados.cnpj}
                onChange={(e) => setDados({ ...dados, cnpj: formatarCNPJ(e.target.value) })}
                className="mt-1 rounded-xl"
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div>
              <Label>CNES</Label>
              <Input {...campo("cnes")} className="mt-1 rounded-xl" placeholder="Número CNES" />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Contato</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Telefone</Label>
              <Input
                value={dados.telefone}
                onChange={(e) => setDados({ ...dados, telefone: formatarTelefone(e.target.value) })}
                className="mt-1 rounded-xl"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" {...campo("email")} className="mt-1 rounded-xl" placeholder="contato@clinica.com" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Endereço</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>CEP</Label>
              <Input
                value={dados.cep}
                onChange={(e) => setDados({ ...dados, cep: formatarCEP(e.target.value) })}
                className="mt-1 rounded-xl"
                placeholder="00000-000"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Logradouro</Label>
              <Input {...campo("endereco")} className="mt-1 rounded-xl" placeholder="Rua, Avenida..." />
            </div>
            <div>
              <Label>Número</Label>
              <Input {...campo("numero")} className="mt-1 rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <Label>Complemento</Label>
              <Input {...campo("complemento")} className="mt-1 rounded-xl" placeholder="Sala, Andar, etc." />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input {...campo("bairro")} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input {...campo("cidade")} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={dados.estado} onValueChange={(v) => setDados({ ...dados, estado: v })}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Logotipo */}
        <div>
          <p className="text-xs font-semibold uppercase text-slate-400 mb-3 tracking-wide">Logotipo</p>
          <div className="space-y-3">
            {/* Preview */}
            {dados.logo ? (
              <div className="border border-slate-200 rounded-xl p-4 flex items-center justify-between bg-slate-50">
                <img
                  src={dados.logo}
                  alt="Logo da empresa"
                  className="max-h-16 max-w-[180px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setDados((d) => ({ ...d, logo: "" }))}
                  className="text-xs text-red-500 hover:text-red-700 underline ml-4"
                >
                  Remover logo
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                <svg className="w-10 h-10 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                <span className="text-sm">Nenhuma logo cadastrada</span>
              </div>
            )}

            {/* Botão de upload */}
            <div>
              <Label className="text-sm">Fazer upload da logo</Label>
              <p className="text-xs text-slate-400 mb-2">Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2 MB.</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                className="hidden"
                id="logo-upload-input"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    toast.error("Imagem muito grande. Máximo 2 MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const base64 = ev.target?.result as string;
                    setDados((d) => ({ ...d, logo: base64 }));
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <label
                htmlFor="logo-upload-input"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" /></svg>
                Selecionar imagem
              </label>
            </div>
          </div>
        </div>

        <Button
          onClick={salvar}
          disabled={salvando}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-3 font-medium"
        >
          {salvando ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Salvando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Salvar Dados da Empresa
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: HORÁRIOS DE FUNCIONAMENTO
// ══════════════════════════════════════════════════════════════════════════════

const DIAS_SEMANA = [
  { id: 0, label: "Domingo",       short: "Dom" },
  { id: 1, label: "Segunda-feira", short: "Seg" },
  { id: 2, label: "Terça-feira",   short: "Ter" },
  { id: 3, label: "Quarta-feira",  short: "Qua" },
  { id: 4, label: "Quinta-feira",  short: "Qui" },
  { id: 5, label: "Sexta-feira",   short: "Sex" },
  { id: 6, label: "Sábado",        short: "Sáb" },
];

interface HorarioDia {
  aberto: boolean;
  inicio: string;
  fim: string;
  almoco: boolean;
  almocoInicio: string;
  almocoFim: string;
}

type HorariosClinica = Record<number, HorarioDia>;

const HORARIO_DIA_PADRAO: HorarioDia = {
  aberto: false, inicio: "08:00", fim: "18:00",
  almoco: false, almocoInicio: "12:00", almocoFim: "13:00",
};

const HORARIOS_PADRAO: HorariosClinica = {
  0: { ...HORARIO_DIA_PADRAO },
  1: { ...HORARIO_DIA_PADRAO, aberto: true },
  2: { ...HORARIO_DIA_PADRAO, aberto: true },
  3: { ...HORARIO_DIA_PADRAO, aberto: true },
  4: { ...HORARIO_DIA_PADRAO, aberto: true },
  5: { ...HORARIO_DIA_PADRAO, aberto: true },
  6: { ...HORARIO_DIA_PADRAO },
};

// getHorarios migrado para Supabase — ver getHorariosDb em agendaData.ts

function AbaHorarios() {
  const [horarios, setHorarios] = useState<HorariosClinica>(HORARIOS_PADRAO);
  useEffect(() => {
    getHorariosDb().then((h) => { if (h) setHorarios(h as HorariosClinica); }).catch(console.error);
  }, []);
  const [salvando, setSalvando] = useState(false);

  function update(dia: number, campo: keyof HorarioDia, valor: boolean | string) {
    setHorarios((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }));
  }

  function copiarPara(diaOrigem: number) {
    const origem = horarios[diaOrigem];
    const novoHorarios = { ...horarios };
    // copia para todos os dias úteis abertos (1–5)
    for (let d = 1; d <= 5; d++) {
      if (d !== diaOrigem) {
        novoHorarios[d] = { ...origem };
      }
    }
    setHorarios(novoHorarios);
    toast.success("Horário copiado para os dias úteis!");
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarHorariosDb(horarios);
      toast.success("Horários salvos com sucesso!");
    } catch { toast.error("Erro ao salvar horários"); }
    finally { setSalvando(false); }
  }

  const diasAbertos = Object.values(horarios).filter((h) => h.aberto).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-6 h-6 text-sky-600" /> Horários de Funcionamento
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {diasAbertos} dia(s) de atendimento configurado(s)
          </p>
        </div>
        {/* Resumo visual rápido */}
        <div className="flex gap-1">
          {DIAS_SEMANA.map((d) => (
            <div
              key={d.id}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-bold transition ${
                horarios[d.id].aberto
                  ? "bg-sky-100 text-sky-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {d.short}
              <span className={`h-1.5 w-1.5 rounded-full ${horarios[d.id].aberto ? "bg-sky-500" : "bg-slate-300"}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {DIAS_SEMANA.map((d) => {
          const h = horarios[d.id];
          return (
            <div
              key={d.id}
              className={`rounded-2xl border transition ${
                h.aberto
                  ? "border-sky-200 bg-white shadow-sm"
                  : "border-slate-200 bg-slate-50 opacity-70"
              }`}
            >
              {/* Linha principal */}
              <div className="flex items-center gap-4 p-4">
                {/* Toggle aberto/fechado */}
                <div className="flex items-center gap-3 w-40 shrink-0">
                  <Switch
                    checked={h.aberto}
                    onCheckedChange={(v) => update(d.id, "aberto", v)}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${h.aberto ? "text-slate-800" : "text-slate-400"}`}>
                      {d.label}
                    </p>
                    <p className={`text-[10px] font-medium ${h.aberto ? "text-sky-600" : "text-slate-400"}`}>
                      {h.aberto ? "Aberto" : "Fechado"}
                    </p>
                  </div>
                </div>

                {/* Horários */}
                {h.aberto ? (
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">Início</Label>
                      <input
                        type="time"
                        value={h.inicio}
                        onChange={(e) => update(d.id, "inicio", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <span className="text-slate-300 font-bold">—</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">Fim</Label>
                      <input
                        type="time"
                        value={h.fim}
                        onChange={(e) => update(d.id, "fim", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>

                    {/* Toggle almoço */}
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                      <Switch
                        checked={h.almoco}
                        onCheckedChange={(v) => update(d.id, "almoco", v)}
                      />
                      <span className="text-xs text-slate-500">Intervalo de almoço</span>
                    </div>

                    {/* Botão copiar para dias úteis */}
                    {d.id >= 1 && d.id <= 5 && (
                      <button
                        onClick={() => copiarPara(d.id)}
                        className="ml-auto text-xs text-sky-600 hover:text-sky-800 hover:bg-sky-50 px-2 py-1 rounded-lg border border-sky-200 transition"
                      >
                        Copiar para dias úteis
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Sem atendimento neste dia</p>
                )}
              </div>

              {/* Linha do almoço (expansível) */}
              {h.aberto && h.almoco && (
                <div className="flex items-center gap-3 px-4 pb-4 pt-0 border-t border-sky-100 mt-0">
                  <div className="w-40 shrink-0" />
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs text-slate-500 font-medium">Almoço:</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">De</Label>
                      <input
                        type="time"
                        value={h.almocoInicio}
                        onChange={(e) => update(d.id, "almocoInicio", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                    <span className="text-slate-300 font-bold">—</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-500 whitespace-nowrap">Até</Label>
                      <input
                        type="time"
                        value={h.almocoFim}
                        onChange={(e) => update(d.id, "almocoFim", e.target.value)}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        onClick={salvar}
        disabled={salvando}
        className="w-full bg-sky-600 hover:bg-sky-700 text-white rounded-xl py-3 font-medium"
      >
        {salvando ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Salvando...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> Salvar Horários
          </span>
        )}
      </Button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: BACKUP E RESTAURAÇÃO
// ══════════════════════════════════════════════════════════════════════════════

// Todas as chaves do localStorage que pertencem ao NexaClinic
const BACKUP_KEYS = [
  "nexaclinic_users",
  "nexaclinic_appointments",
  "nexaclinic_patients",
  "nexaclinic_professionals",
  "nexaclinic_convenios",
  "nexaclinic_procedimentos",
  "nexaclinic_empresa",
  "nexaclinic_horarios",
  "nexaclinic_perfis",
  "nexaclinic_audit",
  "nexaclinic_financeiro",
  "nexaclinic_contas",
  "nexaclinic_repasses",
  "nexaclinic_tiss",
];

interface BackupManifest {
  versao: string;
  geradoEm: string;
  sistema: string;
  dados: Record<string, unknown>;
}

function AbaBackup() {
  const [importando, setImportando] = useState(false);
  const [confirmandoRestore, setConfirmandoRestore] = useState(false);
  const [backupImportado, setBackupImportado] = useState<BackupManifest | null>(null);
  const [erroImport, setErroImport] = useState("");
  const [sucesso, setSucesso] = useState("");

  function gerarBackup() {
    const dados: Record<string, unknown> = {};
    for (const key of BACKUP_KEYS) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        try { dados[key] = JSON.parse(val); } catch { dados[key] = val; }
      }
    }

    const manifest: BackupManifest = {
      versao: "1.0",
      geradoEm: new Date().toISOString(),
      sistema: "NexaClinic",
      dados,
    };

    const json = JSON.stringify(manifest, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexaclinic-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exportado com sucesso!");
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErroImport("");
    setSucesso("");
    setBackupImportado(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setImportando(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as BackupManifest;
        if (json.sistema !== "NexaClinic" || !json.dados) {
          setErroImport("Arquivo inválido. Este backup não pertence ao NexaClinic.");
          setImportando(false);
          return;
        }
        setBackupImportado(json);
      } catch {
        setErroImport("Não foi possível ler o arquivo. Verifique se é um JSON válido.");
      } finally {
        setImportando(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function restaurar() {
    if (!backupImportado) return;
    try {
      for (const [key, value] of Object.entries(backupImportado.dados)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
      setConfirmandoRestore(false);
      setBackupImportado(null);
      setSucesso("Dados restaurados com sucesso! Recarregue a página para aplicar as alterações.");
      toast.success("Backup restaurado! Recarregue a página.");
    } catch {
      toast.error("Erro ao restaurar o backup.");
    }
  }

  // Tamanho estimado do backup atual
  const tamanhoAtual = (() => {
    let total = 0;
    for (const key of BACKUP_KEYS) {
      total += (localStorage.getItem(key) ?? "").length;
    }
    return (total / 1024).toFixed(1);
  })();

  const chavesNoBackup = backupImportado ? Object.keys(backupImportado.dados).length : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Database className="w-6 h-6 text-teal-600" /> Backup e Restauração
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Exporte todos os dados do sistema como JSON ou restaure um backup anterior
        </p>
      </div>

      {/* Card de exportação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 shrink-0">
            <Download className="w-6 h-6 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Exportar Backup</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Gera um arquivo <code className="bg-slate-100 px-1 rounded text-xs">.json</code> com todos
              os dados: pacientes, agendamentos, profissionais, convênios, configurações e auditoria.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tamanho estimado</p>
            <p className="text-lg font-bold text-slate-800">{tamanhoAtual} KB</p>
          </div>
          <div className="space-y-0.5 text-right">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulos incluídos</p>
            <p className="text-sm font-semibold text-slate-700">{BACKUP_KEYS.length} módulos</p>
          </div>
        </div>

        <Button
          onClick={gerarBackup}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2"
        >
          <Download className="w-4 h-4" /> Exportar Backup Agora
        </Button>
      </div>

      {/* Card de importação */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 shrink-0">
            <Upload className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-slate-800">Restaurar Backup</p>
            <p className="text-sm text-slate-500 mt-0.5">
              Selecione um arquivo de backup gerado pelo NexaClinic. Os dados atuais serão
              substituídos pelos dados do backup.
            </p>
          </div>
        </div>

        {/* Alerta de atenção */}
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium">
            Esta operação substituirá todos os dados atuais. Recomenda-se exportar um backup antes de restaurar.
          </p>
        </div>

        {/* Input de arquivo */}
        <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition">
          <Upload className="w-8 h-8 text-slate-400" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">Clique para selecionar o arquivo</p>
            <p className="text-xs text-slate-400 mt-0.5">nexaclinic-backup-YYYY-MM-DD.json</p>
          </div>
          <input
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleArquivo}
            disabled={importando}
          />
        </label>

        {/* Erro */}
        {erroImport && (
          <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <X className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{erroImport}</p>
          </div>
        )}

        {/* Sucesso da restauração */}
        {sucesso && (
          <div className="flex gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-green-700">{sucesso}</p>
          </div>
        )}

        {/* Preview do backup carregado */}
        {backupImportado && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
              <p className="text-sm font-semibold text-teal-800">Backup carregado — pronto para restaurar</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white border border-teal-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-teal-600 tracking-wide">Gerado em</p>
                <p className="text-sm font-bold text-slate-700">
                  {new Date(backupImportado.geradoEm).toLocaleString("pt-BR")}
                </p>
              </div>
              <div className="rounded-lg bg-white border border-teal-200 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-teal-600 tracking-wide">Módulos</p>
                <p className="text-sm font-bold text-slate-700">{chavesNoBackup} tabelas</p>
              </div>
            </div>
            <Button
              onClick={() => setConfirmandoRestore(true)}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-xl gap-2"
            >
              <Upload className="w-4 h-4" /> Restaurar Este Backup
            </Button>
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmandoRestore} onOpenChange={setConfirmandoRestore}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Confirmar restauração?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Todos os dados atuais serão <strong>substituídos</strong> pelos dados do backup de{" "}
                <strong>{backupImportado && new Date(backupImportado.geradoEm).toLocaleString("pt-BR")}</strong>.
              </span>
              <span className="block text-amber-700 font-medium">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={restaurar}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl"
            >
              Sim, restaurar backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA: LOG DE AUDITORIA
// ══════════════════════════════════════════════════════════════════════════════

const ACAO_LABELS: Record<string, { label: string; cor: string }> = {
  LOGIN:               { label: "Login",                cor: "bg-green-100 text-green-700" },
  LOGOUT:              { label: "Logout",               cor: "bg-slate-100 text-slate-600" },
  CRIAR_USUARIO:       { label: "Criou usuário",        cor: "bg-blue-100 text-blue-700" },
  EDITAR_USUARIO:      { label: "Editou usuário",       cor: "bg-amber-100 text-amber-700" },
  EXCLUIR_USUARIO:     { label: "Excluiu usuário",      cor: "bg-red-100 text-red-700" },
  CRIAR_PROFISSIONAL:  { label: "Criou profissional",   cor: "bg-blue-100 text-blue-700" },
  EDITAR_PROFISSIONAL: { label: "Editou profissional",  cor: "bg-amber-100 text-amber-700" },
  EXCLUIR_PROFISSIONAL:{ label: "Excluiu profissional", cor: "bg-red-100 text-red-700" },
  CRIAR_CONVENIO:      { label: "Criou convênio",       cor: "bg-blue-100 text-blue-700" },
  EDITAR_CONVENIO:     { label: "Editou convênio",      cor: "bg-amber-100 text-amber-700" },
  EXCLUIR_CONVENIO:    { label: "Excluiu convênio",     cor: "bg-red-100 text-red-700" },
  CRIAR_PROCEDIMENTO:  { label: "Criou procedimento",   cor: "bg-blue-100 text-blue-700" },
  EDITAR_PROCEDIMENTO: { label: "Editou procedimento",  cor: "bg-amber-100 text-amber-700" },
  EXCLUIR_PROCEDIMENTO:{ label: "Excluiu procedimento", cor: "bg-red-100 text-red-700" },
  EXCLUIR_PACIENTE:    { label: "Excluiu paciente",     cor: "bg-red-100 text-red-700" },
  CANCELAR_AGENDAMENTO:{ label: "Cancelou agendamento", cor: "bg-orange-100 text-orange-700" },
};

const GRUPO_ACAO: Record<string, string[]> = {
  "Acesso":        ["LOGIN", "LOGOUT"],
  "Usuários":      ["CRIAR_USUARIO", "EDITAR_USUARIO", "EXCLUIR_USUARIO"],
  "Profissionais": ["CRIAR_PROFISSIONAL", "EDITAR_PROFISSIONAL", "EXCLUIR_PROFISSIONAL"],
  "Convênios":     ["CRIAR_CONVENIO", "EDITAR_CONVENIO", "EXCLUIR_CONVENIO"],
  "Procedimentos": ["CRIAR_PROCEDIMENTO", "EDITAR_PROCEDIMENTO", "EXCLUIR_PROCEDIMENTO"],
  "Pacientes":     ["EXCLUIR_PACIENTE"],
  "Agenda":        ["CANCELAR_AGENDAMENTO"],
};

function badgeAcao(acao: string) {
  const info = ACAO_LABELS[acao] ?? { label: acao, cor: "bg-slate-100 text-slate-600" };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${info.cor}`}>
      {info.label}
    </span>
  );
}

function AbaAuditoria() {
  const [log, setLog] = React.useState<AuditEntry[]>([]);
  const [busca, setBusca] = React.useState("");
  const [filtroUsuario, setFiltroUsuario] = React.useState("");
  const [filtroAcao, setFiltroAcao] = React.useState("");
  const [filtroGrupo, setFiltroGrupo] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [pagina, setPagina] = React.useState(1);
  const POR_PAGINA = 25;

  function recarregar() { setLog(listarAuditoria()); }
  React.useEffect(() => { recarregar(); }, []);

  const usuarios = React.useMemo(
    () => Array.from(new Map(log.map(e => [e.usuarioId, e.usuarioNome])).entries()),
    [log]
  );

  const filtrado = React.useMemo(() => {
    return log.filter(e => {
      if (filtroUsuario && e.usuarioId !== filtroUsuario) return false;
      if (filtroAcao && e.acao !== filtroAcao) return false;
      if (filtroGrupo) {
        const acoes = GRUPO_ACAO[filtroGrupo] ?? [];
        if (!acoes.includes(e.acao)) return false;
      }
      if (dateFrom && e.ts < dateFrom) return false;
      if (dateTo && e.ts.slice(0,10) > dateTo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !e.usuarioNome.toLowerCase().includes(q) &&
          !e.acao.toLowerCase().includes(q) &&
          !(e.detalhe ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [log, filtroUsuario, filtroAcao, filtroGrupo, dateFrom, dateTo, busca]);

  const totalPag = Math.ceil(filtrado.length / POR_PAGINA);
  const pagAtual = filtrado.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  // Stats por grupo para resumo
  const stats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    log.forEach(e => {
      for (const [grupo, acoes] of Object.entries(GRUPO_ACAO)) {
        if (acoes.includes(e.acao)) { counts[grupo] = (counts[grupo] ?? 0) + 1; }
      }
    });
    return counts;
  }, [log]);

  // Deletions highlight
  const exclusoes = log.filter(e => e.acao.startsWith("EXCLUIR")).length;

  function limpar() {
    setBusca(""); setFiltroUsuario(""); setFiltroAcao(""); setFiltroGrupo("");
    setDateFrom(""); setDateTo(""); setPagina(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-rose-600" /> Log de Auditoria
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {log.length} registro(s) · {exclusoes} exclusão(ões)
          </p>
        </div>
        <button
          onClick={recarregar}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600 border border-slate-200 rounded-xl px-3 py-1.5 hover:border-rose-300 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(GRUPO_ACAO).map(([grupo]) => (
          <button
            key={grupo}
            onClick={() => { setFiltroGrupo(filtroGrupo === grupo ? "" : grupo); setPagina(1); }}
            className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${
              filtroGrupo === grupo
                ? "border-rose-300 bg-rose-50"
                : "border-slate-200 bg-white hover:border-rose-200"
            }`}
          >
            <p className={`text-xl font-black ${filtroGrupo === grupo ? "text-rose-600" : "text-slate-700"}`}>
              {stats[grupo] ?? 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{grupo}</p>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-semibold text-slate-600">Filtros</p>
          {(busca || filtroUsuario || filtroAcao || filtroGrupo || dateFrom || dateTo) && (
            <button onClick={limpar} className="ml-auto text-xs text-red-500 hover:text-red-700">
              × Limpar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca livre */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setPagina(1); }}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
          {/* Filtro usuário */}
          <select
            value={filtroUsuario}
            onChange={e => { setFiltroUsuario(e.target.value); setPagina(1); }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <option value="">Todos os usuários</option>
            {usuarios.map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          {/* Filtro ação */}
          <select
            value={filtroAcao}
            onChange={e => { setFiltroAcao(e.target.value); setFiltroGrupo(""); setPagina(1); }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            <option value="">Todas as ações</option>
            {Object.entries(ACAO_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {/* Datas */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPagina(1); }}
              className="flex-1 px-2 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
            <input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPagina(1); }}
              className="flex-1 px-2 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">
          {filtrado.length} de {log.length} registro(s) exibidos
        </p>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {filtrado.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400 gap-3">
            <ClipboardList className="w-10 h-10 opacity-30" />
            <p className="font-medium">Nenhum registro encontrado.</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Data / Hora</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Usuário</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Perfil</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {pagAtual.map(e => {
                  const isExclusao = e.acao.startsWith("EXCLUIR");
                  return (
                    <tr
                      key={e.id}
                      className={`border-b border-slate-50 hover:bg-slate-50 transition ${isExclusao ? "bg-red-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                        {new Date(e.ts).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{e.usuarioNome}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {ROLE_LABELS[e.role] ?? e.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">{badgeAcao(e.acao)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate">
                        {e.detalhe ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Paginação */}
            {totalPag > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-500">
                  Página {pagina} de {totalPag}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={pagina === 1}
                    onClick={() => setPagina(p => p - 1)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition"
                  >
                    ← Anterior
                  </button>
                  <button
                    disabled={pagina === totalPag}
                    onClick={() => setPagina(p => p + 1)}
                    className="px-3 py-1 text-xs rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-white transition"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
