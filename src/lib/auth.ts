export type UserRole = "admin" | "medico" | "recepcao" | "financeiro";

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: UserRole;
  ativo: boolean;
  criadoEm: string;
  professionalId?: string;
  maxDesconto?: number; // percentual máximo de desconto que o usuário pode conceder (0-100)
}

export interface Permissoes {
  verFinanceiro: boolean;
  editarRepasse: boolean;
  verRepasseProprioApenas: boolean;
  gerenciarUsuarios: boolean;
  gerenciarProfissionais: boolean;
  editarPacientes: boolean;
  cancelarConsultas: boolean;
  verRelatorios: boolean;
  verDashboard: boolean;
  acessarConfiguracoes: boolean;
  excluirRegistros: boolean;
  cancelarAgendamento: boolean;
}

const PERMISSOES_POR_ROLE: Record<UserRole, Permissoes> = {
  admin: { verFinanceiro: true, editarRepasse: true, verRepasseProprioApenas: false, gerenciarUsuarios: true, gerenciarProfissionais: true, editarPacientes: true, cancelarConsultas: true, verRelatorios: true, verDashboard: true, acessarConfiguracoes: true, excluirRegistros: true, cancelarAgendamento: true },
  financeiro: { verFinanceiro: true, editarRepasse: true, verRepasseProprioApenas: false, gerenciarUsuarios: false, gerenciarProfissionais: false, editarPacientes: false, cancelarConsultas: false, verRelatorios: true, verDashboard: true, acessarConfiguracoes: false, excluirRegistros: false, cancelarAgendamento: false },
  medico: { verFinanceiro: false, editarRepasse: false, verRepasseProprioApenas: true, gerenciarUsuarios: false, gerenciarProfissionais: false, editarPacientes: true, cancelarConsultas: true, verRelatorios: true, verDashboard: true, acessarConfiguracoes: false, excluirRegistros: false, cancelarAgendamento: false },
  recepcao: { verFinanceiro: false, editarRepasse: false, verRepasseProprioApenas: false, gerenciarUsuarios: false, gerenciarProfissionais: false, editarPacientes: true, cancelarConsultas: true, verRelatorios: false, verDashboard: true, acessarConfiguracoes: false, excluirRegistros: false, cancelarAgendamento: false },
};

export function getPermissoes(role: UserRole): Permissoes { return PERMISSOES_POR_ROLE[role]; }

const USERS_KEY   = "nexaclinic_usuarios";
const SESSION_KEY = "nexaclinic_sessao_v2";
const AUDIT_KEY   = "nexaclinic_auditoria";

const ADMIN: AppUser = { id: "usr_admin_001", nome: "Jean Markys", email: "jeanmarkys@hotmail.com", senha: "Nnatann123", role: "admin", ativo: true, criadoEm: new Date().toISOString() };

function getUsers(): AppUser[] { try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]"); } catch { return []; } }
function setUsers(u: AppUser[]) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function getSessao(): AppUser | null { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; } }
function setSessao(u: AppUser | null) { u ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(u)) : sessionStorage.removeItem(SESSION_KEY); }

export interface AuditEntry { id: string; ts: string; usuarioId: string; usuarioNome: string; role: UserRole; acao: string; detalhe?: string; }

export function registrarAuditoria(acao: string, detalhe?: string) {
  const usuario = getSessao(); if (!usuario) return;
  const entry: AuditEntry = { id: `aud_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ts: new Date().toISOString(), usuarioId: usuario.id, usuarioNome: usuario.nome, role: usuario.role, acao, detalhe };
  try { const log: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]"); log.unshift(entry); if (log.length > 500) log.splice(500); localStorage.setItem(AUDIT_KEY, JSON.stringify(log)); } catch {}
}

export function listarAuditoria(filtros?: { usuarioId?: string; acao?: string }): AuditEntry[] {
  try { let log: AuditEntry[] = JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]"); if (filtros?.usuarioId) log = log.filter(e => e.usuarioId === filtros.usuarioId); if (filtros?.acao) log = log.filter(e => e.acao.includes(filtros.acao!)); return log; } catch { return []; }
}

export function inicializarAuth() { const u = getUsers(); if (!u.some(x => x.id === ADMIN.id)) setUsers([...u, ADMIN]); }
export function login(email: string, senha: string): AppUser | null { inicializarAuth(); const user = getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.senha === senha && u.ativo); if (user) { setSessao(user); registrarAuditoria("LOGIN", `Acesso via e-mail ${email}`); return user; } return null; }
export function logout() { registrarAuditoria("LOGOUT"); setSessao(null); }
export function getUsuarioAtual() { return getSessao(); }
export function estaLogado() { return getSessao() !== null; }
export function eAdmin() { return getSessao()?.role === "admin"; }
export function temPermissao(perm: keyof Permissoes): boolean { const u = getSessao(); if (!u) return false; return getPermissoes(u.role)[perm]; }
export function listarUsuarios(): AppUser[] { inicializarAuth(); return getUsers(); }
export function criarUsuario(d: Omit<AppUser, "id" | "criadoEm">): AppUser { const u = getUsers(); if (u.some(x => x.email.toLowerCase() === d.email.toLowerCase())) throw new Error("E-mail já cadastrado."); const n: AppUser = { ...d, id: `usr_${Date.now()}`, criadoEm: new Date().toISOString() }; setUsers([...u, n]); registrarAuditoria("CRIAR_USUARIO", `Usuário ${n.nome} (${n.role}) criado`); return n; }
export function atualizarUsuario(id: string, d: Partial<AppUser>): AppUser { const u = getUsers(); const i = u.findIndex(x => x.id === id); if (i === -1) throw new Error("Não encontrado."); u[i] = { ...u[i], ...d }; setUsers(u); const s = getSessao(); if (s?.id === id) setSessao(u[i]); registrarAuditoria("EDITAR_USUARIO", `Usuário ${u[i].nome} atualizado`); return u[i]; }
export function excluirUsuario(id: string) { const u = getUsers(); const user = u.find(x => x.id === id); if (!user) throw new Error("Não encontrado."); if (user.id === ADMIN.id) throw new Error("Não é possível excluir o admin padrão."); setUsers(u.filter(x => x.id !== id)); registrarAuditoria("EXCLUIR_USUARIO", `Usuário ${user.nome} excluído`); }
export const ROLE_LABELS: Record<UserRole, string> = { admin: "Administrador", medico: "Médico / Profissional", recepcao: "Recepção", financeiro: "Financeiro" };