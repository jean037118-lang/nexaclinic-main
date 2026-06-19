import { supabase } from "./supabase";

export interface AppUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: string;
  ativo: boolean;
  criadoEm: string;
}

const SESSION_KEY = "nexaclinic_session";

/* =========================================
   PERFIS
========================================= */

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  Administrador: "Administrador",

  recepcao: "Recepção",
  Recepção: "Recepção",

  medico: "Médico",
  Médico: "Médico",

  financeiro: "Financeiro",
  Financeiro: "Financeiro",
};

/* =========================================
   SESSÃO
========================================= */

export function inicializarAuth(): void {
  // compatibilidade
}

export function getUsuarioAtual(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);

    if (!raw) return null;

    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function estaLogado(): boolean {
  return !!getUsuarioAtual();
}

export function eAdmin(): boolean {
  const user = getUsuarioAtual();

  return (
    user?.role === "Administrador" ||
    user?.role === "admin"
  );
}

export function temPermissao(
  _permissao?: string
): boolean {
  return true;
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

/* =========================================
   AUDITORIA
========================================= */

export async function registrarAuditoria(
  acao: string,
  detalhe?: string
): Promise<void> {
  try {
    const usuario = getUsuarioAtual();

    if (import.meta.env.DEV) {
      console.log("AUDITORIA", {
        usuario: usuario?.nome,
        acao,
        detalhe,
        data: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(err);
  }
}

export async function listarAuditoria() {
  return [];
}

/* =========================================
   LOGIN
========================================= */

export async function login(
  email: string,
  senha: string
): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .eq("ativo", true)
    .single();

  if (error || !data) {
    console.error(error);
    return null;
  }

  const usuario: AppUser = {
    id: data.id,
    nome: data.nome,
    email: data.email,
    senha: data.senha,
    role: data.role,
    ativo: data.ativo,
    criadoEm: data.criado_em,
  };

  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify(usuario)
  );

  return usuario;
}

/* =========================================
   USUÁRIOS
========================================= */

export async function listarUsuarios(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("nome");

  if (error) {
    console.error(error);
    return [];
  }

  return (data || []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    senha: u.senha,
    role: u.role,
    ativo: u.ativo,
    criadoEm: u.criado_em,
  }));
}

export async function criarUsuario(
  usuario: Omit<AppUser, "id" | "criadoEm">
): Promise<AppUser> {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      nome: usuario.nome,
      email: usuario.email,
      senha: usuario.senha,
      role: usuario.role,
      ativo: usuario.ativo,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw error;
  }

  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    senha: data.senha,
    role: data.role,
    ativo: data.ativo,
    criadoEm: data.criado_em,
  };
}

export async function atualizarUsuario(
  id: string,
  dados: Partial<AppUser>
): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({
      nome: dados.nome,
      email: dados.email,
      senha: dados.senha,
      role: dados.role,
      ativo: dados.ativo,
    })
    .eq("id", id);

  if (error) {
    console.error(error);
    throw error;
  }
}

export async function excluirUsuario(
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    throw error;
  }
}