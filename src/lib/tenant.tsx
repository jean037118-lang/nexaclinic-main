
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Configuração Supabase ────────────────────────────────────────────────────
// Coloque no .env:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface Clinica {
  id:           string;
  slug:         string;
  nome:         string;
  razao_social: string | null;
  logo_url:     string | null;
  plano:        string;
  email:        string | null;
  telefone:     string | null;
  endereco:     Record<string, string> | null;
}

interface TenantCtx {
  clinicaId:   string | null;
  clinicaSlug: string | null;
  clinica:     Clinica | null;
  supabase:    SupabaseClient;
  loading:     boolean;
  erro:        string | null;
}

// ─── Cliente base (sem JWT de clínica) ───────────────────────────────────────
// Usado apenas para buscar os dados públicos da clínica antes do login.
const supabaseBase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Helpers de slug ─────────────────────────────────────────────────────────

/**
 * Extrai o slug da clínica a partir do hostname atual.
 *
 * Exemplos:
 *   clinica-abc.nexaclinic.com  → "clinica-abc"
 *   app.nexaclinic.com          → null   (painel admin / landing)
 *   localhost:8080              → lê ?clinica=demo da query string (desenvolvimento)
 */
export function getSlugFromHostname(): string | null {
  const host = window.location.hostname;

  // Desenvolvimento: ?clinica=slug na URL
  if (host === "localhost" || host === "127.0.0.1") {
    return new URLSearchParams(window.location.search).get("clinica");
  }

  // Produção: primeiro segmento do subdomínio
  const partes = host.split(".");
  if (partes.length >= 3) {
    const sub = partes[0];
    // Ignora subdomínios reservados
    if (["www", "app", "admin", "api"].includes(sub)) return null;
    return sub;
  }

  return null;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────
const TenantContext = createContext<TenantCtx | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [clinica, setClinica]     = useState<Clinica | null>(null);
  const [loading, setLoading]     = useState(true);
  const [erro, setErro]           = useState<string | null>(null);
  const [supabase, setSupabase]   = useState<SupabaseClient>(supabaseBase);

  const slug = getSlugFromHostname();

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setErro(null);

      // 1. Busca dados públicos da clínica pelo slug
      const { data, error } = await supabaseBase
        .from("clinicas")
        .select("id,slug,nome,razao_social,logo_url,plano,email,telefone,endereco")
        .eq("slug", slug)
        .eq("ativo", true)
        .single();

      if (error || !data) {
        setErro(`Clínica "${slug}" não encontrada ou inativa.`);
        setLoading(false);
        return;
      }

      setClinica(data as Clinica);

      // 2. Cria cliente Supabase dedicado com storage key isolada por clínica.
      //    O JWT com clinica_id é injetado após o login (ver auth.tsx).
      const clienteClinica = createClient(SUPABASE_URL, SUPABASE_ANON, {
        auth: {
          storageKey: `nexaclinic_auth_${data.id}`,  // sessão isolada por clínica
          autoRefreshToken: true,
          persistSession: true,
        },
      });

      setSupabase(clienteClinica);
      setLoading(false);
    })();
  }, [slug]);

  const ctx: TenantCtx = {
    clinicaId:   clinica?.id   ?? null,
    clinicaSlug: clinica?.slug ?? null,
    clinica,
    supabase,
    loading,
    erro,
  };

  return (
    <TenantContext.Provider value={ctx}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTenant(): TenantCtx {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant: envolva o app com <TenantProvider>");
  return ctx;
}
