/**
 * AuthGuard.tsx — NexaClinic
 *
 * CORREÇÕES:
 *  1. ProtectedRoute.tsx foi eliminado (usava `localStorage.getItem('token')`
 *     — token que nunca existia neste sistema, tornando a proteção inútil).
 *  2. AuthGuard agora é a única barreira de rota — use este componente.
 *  3. Não há mais duplicação de lógica de autenticação.
 */
import { useRouterState, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { estaLogado } from "@/lib/auth";

/**
 * AuthGuard — proteção de rotas via renderização condicional.
 *
 * • Na rota /login: não renderiza o layout do sistema.
 * • Em qualquer outra rota sem sessão: redireciona para /login.
 * • Com sessão ativa: renderiza os filhos normalmente.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logado   = estaLogado();

  useEffect(() => {
    if (pathname !== "/login" && !logado) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [pathname, logado, router]);

  if (pathname === "/login") return null;
  if (!logado)               return null;

  return <>{children}</>;
}
