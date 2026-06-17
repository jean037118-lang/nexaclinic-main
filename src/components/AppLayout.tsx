import { Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, User, Stethoscope, Activity, X,
  DollarSign, RefreshCw, Cake, AlertTriangle, CheckCheck, Clock,
  ChevronRight, Minus, Square,
} from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUsuarioAtual, logout, ROLE_LABELS } from "@/lib/auth";
import { toast } from "sonner";
import { useState, useRef, useEffect, useMemo } from "react";

function iniciais(nome: string) {
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ─── hook: gera notificações reais do sistema ────────────────────────────────
interface SysNotification {
  id: string;
  type: "pagamento" | "retorno" | "aniversario";
  title: string;
  body: string;
  href: string;
  at: Date;
}

function useNotifications(): SysNotification[] {
  return useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const todayMD = todayStr.slice(5);
    const notifs: SysNotification[] = [];

    try {
      const apts: any[] = JSON.parse(localStorage.getItem("nexaclinic_appointments_v3") ?? "[]");
      const semPag = apts.filter(
        (a) =>
          (a.status === "finalizado" || a.status === "em_atendimento") &&
          !a.paid &&
          !(a as any).sentToBilling
      );
      if (semPag.length > 0) {
        notifs.push({
          id: "pag_pendente",
          type: "pagamento",
          title: `${semPag.length} pagamento${semPag.length > 1 ? "s" : ""} pendente${semPag.length > 1 ? "s" : ""}`,
          body: semPag.slice(0, 2).map((a) => a.patientName).join(", ") + (semPag.length > 2 ? ` e mais ${semPag.length - 2}` : ""),
          href: "/relatorios",
          at: new Date(),
        });
      }

      type ProntuarioMap = Record<string, { evolucoes?: { retorno?: string; data: string }[] }>;
      const prontuarios: ProntuarioMap = JSON.parse(localStorage.getItem("nexaclinic_prontuarios_v2") ?? "{}");
      const pacientes: any[] = JSON.parse(localStorage.getItem("nexaclinic_patients_v3") ?? "[]");
      const retornosVencidos: string[] = [];

      Object.values(prontuarios).forEach((pront) => {
        (pront.evolucoes ?? []).forEach((ev) => {
          if (!ev.retorno) return;
          if (ev.retorno < todayStr) {
            const pacId = Object.keys(prontuarios).find((k) => prontuarios[k] === pront);
            const pac = pacientes.find((p) => p.id === pacId);
            if (!pac) return;
            const jaAgendado = apts.some(
              (a) =>
                a.patientName?.toLowerCase() === pac.name?.toLowerCase() &&
                a.date >= ev.retorno! &&
                a.status !== "cancelado" &&
                a.status !== "faltou"
            );
            if (!jaAgendado) retornosVencidos.push(pac.name);
          }
        });
      });

      if (retornosVencidos.length > 0) {
        const uniq = [...new Set(retornosVencidos)];
        notifs.push({
          id: "retornos_vencidos",
          type: "retorno",
          title: `${uniq.length} retorno${uniq.length > 1 ? "s" : ""} vencido${uniq.length > 1 ? "s" : ""}`,
          body: uniq.slice(0, 2).join(", ") + (uniq.length > 2 ? ` e mais ${uniq.length - 2}` : ""),
          href: "/prontuario",
          at: new Date(),
        });
      }

      const aniversariantes = pacientes.filter((p) => {
        if (!p.birth) return false;
        return p.birth.slice(5) === todayMD;
      });
      if (aniversariantes.length > 0) {
        notifs.push({
          id: "aniversarios_hoje",
          type: "aniversario",
          title: `🎂 ${aniversariantes.length} aniversário${aniversariantes.length > 1 ? "s" : ""} hoje`,
          body: aniversariantes.slice(0, 3).map((p) => p.name.split(" ")[0]).join(", ") + (aniversariantes.length > 3 ? ` e mais ${aniversariantes.length - 3}` : ""),
          href: "/pacientes",
          at: new Date(),
        });
      }
    } catch { /* silencioso */ }

    return notifs;
  }, []);
}

// ─── sino com dropdown ───────────────────────────────────────────────────────
function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lidas, setLidas] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("nexaclinic_notif_lidas") ?? "[]")); }
    catch { return new Set(); }
  });
  const notifs = useNotifications();
  const naoLidas = notifs.filter((n) => !lidas.has(n.id));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function marcarLida(id: string) {
    const novo = new Set(lidas).add(id);
    setLidas(novo);
    localStorage.setItem("nexaclinic_notif_lidas", JSON.stringify([...novo]));
  }
  function marcarTodasLidas() {
    const novo = new Set(notifs.map((n) => n.id));
    setLidas(novo);
    localStorage.setItem("nexaclinic_notif_lidas", JSON.stringify([...novo]));
  }

  const iconePorTipo = {
    pagamento:   <DollarSign className="h-3.5 w-3.5 text-orange-500" />,
    retorno:     <RefreshCw className="h-3.5 w-3.5 text-violet-500" />,
    aniversario: <Cake className="h-3.5 w-3.5 text-pink-500" />,
  };
  const corPorTipo = {
    pagamento:   "bg-orange-50 border-orange-200",
    retorno:     "bg-violet-50 border-violet-200",
    aniversario: "bg-pink-50 border-pink-200",
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition"
      >
        <Bell className="h-4 w-4" />
        {naoLidas.length > 0 && (
          <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
            {naoLidas.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-2xl border border-border bg-popover shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Notificações</span>
              {naoLidas.length > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {naoLidas.length}
                </span>
              )}
            </div>
            {naoLidas.length > 0 && (
              <button
                onClick={marcarTodasLidas}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Bell className="h-5 w-5 text-muted-foreground/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tudo em ordem!</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Nenhuma notificação pendente</p>
                </div>
              </div>
            ) : (
              notifs.map((n) => {
                const isNaoLida = !lidas.has(n.id);
                return (
                  <button
                    key={n.id}
                    className={`w-full text-left px-4 py-3 hover:bg-accent transition flex items-start gap-3 ${isNaoLida ? "bg-accent/30" : ""}`}
                    onClick={() => { marcarLida(n.id); setOpen(false); router.navigate({ to: n.href }); }}
                  >
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${corPorTipo[n.type]}`}>
                      {iconePorTipo[n.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs leading-tight ${isNaoLida ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>
                          {n.title}
                        </p>
                        {isNaoLida && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.body}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  </button>
                );
              })
            )}
          </div>

          {notifs.length > 0 && (
            <div className="border-t border-border px-4 py-2.5 text-center">
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition"
                onClick={() => { setOpen(false); router.navigate({ to: "/relatorios" }); }}
              >
                Ver relatórios completos →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── barra de título customizada (Electron frameless) ───────────────────────
const isElectron = typeof window !== "undefined" && !!(window as any).api;

function TitleBar() {
  if (!isElectron) return null;

  function minimize() { (window as any).api?.send("window-minimize"); }
  function maximize() { (window as any).api?.send("window-maximize"); }
  function close()    { (window as any).api?.send("window-close"); }

  return (
    <div
      className="flex items-center justify-between select-none"
      style={{
        height: "32px",
        background: "hsl(var(--sidebar-background, 220 20% 10%))",
        WebkitAppRegion: "drag",
      } as React.CSSProperties}
    >
      <span
        className="px-4 text-[11px] font-semibold tracking-wide text-white/60"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        NexaClinic
      </span>
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button onClick={minimize} title="Minimizar" className="flex h-full w-11 items-center justify-center text-white/50 hover:bg-white/10 transition">
          <Minus className="h-3 w-3" />
        </button>
        <button onClick={maximize} title="Maximizar / Restaurar" className="flex h-full w-11 items-center justify-center text-white/50 hover:bg-white/10 transition">
          <Square className="h-3 w-3" />
        </button>
        <button onClick={close} title="Fechar" className="flex h-full w-11 items-center justify-center text-white/50 hover:bg-red-500 hover:text-white transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── layout principal ────────────────────────────────────────────────────────
export function AppLayout() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname === "/login") return <Outlet />;
  const usuario = getUsuarioAtual();

  function handleLogout() {
    logout();
    toast.info("Sessão encerrada.");
    router.navigate({ to: "/login", replace: true });
  }

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full">
        <TitleBar />
        <div className="flex flex-1 w-full bg-gradient-subtle">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            {/* Header compacto — sem busca */}
            <header className="sticky top-0 z-30 flex h-10 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
              <SidebarTrigger />
              <div className="ml-auto flex items-center gap-1.5">
                <NotificationBell />
                {usuario && (
                  <div className="flex items-center gap-2 rounded-full bg-muted/50 py-0.5 pl-1 pr-3">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="bg-gradient-primary text-[10px] text-primary-foreground">
                        {iniciais(usuario.nome)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden text-left sm:block">
                      <p className="text-xs font-medium leading-tight">{usuario.nome.split(" ")[0]}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[usuario.role]}</p>
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost" size="icon"
                  onClick={handleLogout}
                  title="Sair"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </header>
            <main className="flex-1 p-4 md:p-5">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
