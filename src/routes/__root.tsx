import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { inicializarAuth, estaLogado } from "@/lib/auth";

inicializarAuth();

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: ({ location }) => {
    const logado = estaLogado();
    const naLogin = location.pathname === "/login";
    if (!logado && !naLogin) throw redirect({ to: "/login", replace: true });
    if (logado && naLogin) throw redirect({ to: "/", replace: true });
  },
  component: RootComponent,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="mt-4 inline-block underline">Voltar ao início</Link>
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    const router = useRouter(); console.error(error);
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Algo deu errado</h1>
          <button onClick={() => { router.invalidate(); reset(); }} className="mt-4 underline">Tentar novamente</button>
        </div>
      </div>
    );
  },
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout />
      <Toaster />
    </QueryClientProvider>
  );
}
