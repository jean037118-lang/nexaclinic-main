
/**
 * permissions.ts
 * Hook e utilitários de controle de acesso para uso nos componentes React.
 * Importar via: import { usePermissoes, RotaProtegida } from "@/lib/permissions"
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  getUsuarioAtual,
  getPermissoes,
  temPermissao,
  type Permissoes,
  type UserRole,
  type AppUser,
} from "@/lib/auth";

// ─── Hook principal ───────────────────────────────────────────────────────────
export function usePermissoes() {
  const usuario = getUsuarioAtual();
  const permissoes: Permissoes = usuario
    ? getPermissoes(usuario.role)
    : ({} as Permissoes);

  return {
    usuario,
    permissoes,
    role: usuario?.role as UserRole | undefined,
    eAdmin:      () => usuario?.role === "admin",
    eMedico:     () => usuario?.role === "medico",
    eRecepcao:   () => usuario?.role === "recepcao",
    eFinanceiro: () => usuario?.role === "financeiro",
    pode: (perm: keyof Permissoes) => !!permissoes[perm],
    /** Para módulo de repasse: filtra lista pelo professionalId do médico logado */
    filtrarPorMedico: <T extends { professionalId?: string; medico?: string }>(
      lista: T[]
    ): T[] => {
      if (!usuario) return [];
      if (usuario.role !== "medico") return lista; // admin/financeiro vê tudo
      return lista.filter(
        (item) =>
          item.professionalId === usuario.professionalId ||
          item.medico === usuario.professionalId
      );
    },
  };
}

// ─── Guard de rota (hook) ─────────────────────────────────────────────────────
/**
 * Redireciona para "/" se o usuário não tiver a permissão indicada.
 * Usar no topo do componente da rota protegida.
 *
 * @example
 *   useGuardPermissao("verFinanceiro");
 */
export function useGuardPermissao(perm: keyof Permissoes) {
  const router = useRouter();
  useEffect(() => {
    if (!temPermissao(perm)) {
      router.navigate({ to: "/", replace: true });
    }
  }, [perm, router]);
  return temPermissao(perm);
}

// ─── Itens de menu filtrados por papel ───────────────────────────────────────
export interface MenuItem {
  icon: unknown;
  label: string;
  to: string;
  permissao?: keyof Permissoes;  // undefined = visível para todos logados
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export function filtrarMenuPorPapel(
  grupos: MenuGroup[],
  usuario: AppUser | null
): MenuGroup[] {
  if (!usuario) return [];
  const perms = getPermissoes(usuario.role);
  return grupos
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (item) => !item.permissao || perms[item.permissao]
      ),
    }))
    .filter((g) => g.items.length > 0);
}

