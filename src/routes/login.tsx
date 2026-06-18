import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Minus, Square, X } from "lucide-react";
import { login, inicializarAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

// ─── Titlebar para tela de login (frameless Electron) ────────────────────────
const isElectron = typeof window !== "undefined" && !!(window as any).api;

function LoginTitleBar() {
  if (!isElectron) return null;
  const minimize = () => (window as any).api?.send("window-minimize");
  const maximize = () => (window as any).api?.send("window-maximize");
  const close    = () => (window as any).api?.send("window-close");

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between"
      style={{ height: 32, background: "rgba(0,0,0,0.35)", WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <span className="px-4 text-[11px] font-semibold tracking-wide text-white/40 select-none">
        NexaClinic
      </span>
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        <button onClick={minimize} title="Minimizar"
          className="flex h-full w-11 items-center justify-center text-white/40 hover:bg-white/10 transition">
          <Minus className="h-3 w-3" />
        </button>
        <button onClick={maximize} title="Maximizar"
          className="flex h-full w-11 items-center justify-center text-white/40 hover:bg-white/10 transition">
          <Square className="h-3 w-3" />
        </button>
        <button onClick={close} title="Fechar"
          className="flex h-full w-11 items-center justify-center text-white/40 hover:bg-red-500 hover:text-white transition">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [loading, setLoading] = useState(false);

  // Lê logo e nome da clínica de Configurações → Empresa
  const empresa = useMemo(() => {
    try {
      const emp = JSON.parse(localStorage.getItem("nexaclinic_empresa") ?? "{}");
      const logo = typeof emp.logo === "string" && emp.logo.startsWith("data:image") ? emp.logo : undefined;
      const nome = (emp.nomeFantasia?.trim() || emp.razaoSocial?.trim()) || undefined;
      const slogan = emp.slogan?.trim() || undefined;
      return { logo, nome, slogan };
    } catch {
      return { logo: undefined, nome: undefined, slogan: undefined };
    }
  }, []);

  const [logoError, setLogoError] = useState(false);
  const nomeExibido   = empresa.nome   ?? "NexaClinic";
  const sloganExibido = empresa.slogan ?? "Gestão Clínica Inteligente";
  const mostrarLogo   = !!empresa.logo && !logoError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha.trim()) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);

    // Garante que o admin padrão existe antes de tentar logar
    inicializarAuth();

    await new Promise((r) => setTimeout(r, 350));

    const user = await login(email.trim(), senha);
    setLoading(false);
if (user) {
  const primeiroNome =
    user.nome?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "Usuário";

  toast.success(`Bem-vindo, ${primeiroNome}!`);

  router.navigate({
    to: "/",
    replace: true,
  });
} else {
  toast.error("E-mail ou senha incorretos.");
}

 

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-teal-950 to-slate-900">
      <LoginTitleBar />
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-teal-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 flex flex-col items-center gap-3">
            {mostrarLogo ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-2 shadow-lg shadow-teal-500/20 overflow-hidden">
                <img
                  src={empresa.logo}
                  alt={nomeExibido}
                  className="max-h-full max-w-full object-contain"
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 shadow-lg shadow-teal-500/30">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
            )}
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">{nomeExibido}</h1>
              <p className="mt-1 text-sm text-white/50">{sloganExibido}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-white/70">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/25"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-white/70">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <Input
                  type={mostrar ? "text" : "password"}
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/25"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  tabIndex={-1}
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 w-full bg-gradient-to-r from-teal-500 to-cyan-500 py-5 text-sm font-semibold text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Autenticando…
                </span>
              ) : (
                "Entrar no sistema"
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-white/25">
            Acesso restrito a usuários autorizados
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-white/20">
          © {new Date().getFullYear()} {nomeExibido}
        </p>
      </div>
    </div>
  );
}
