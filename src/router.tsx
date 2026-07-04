import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory, createBrowserHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// ─── Estratégia de histórico por ambiente ───────────────────────────────────
// Electron carrega o app a partir de um arquivo local (file://), onde não
// existe servidor para resolver rotas do tipo "/agenda" — por isso precisa
// de hash routing ("/#/agenda").
// No build web (Vercel), o TanStack Start já roda um servidor de verdade
// capaz de resolver rotas normais, então usamos browser history para
// aproveitar SSR, evitar o flash de hidratação e ter URLs limpas.
const isElectron =
  typeof window !== "undefined" && !!(window as any).api;

export const getRouter = () => {
  const queryClient = new QueryClient();

  return createRouter({
    routeTree,
    context: { queryClient },
    history: isElectron ? createHashHistory() : createBrowserHistory(),
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};