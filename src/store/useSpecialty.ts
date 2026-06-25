import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Specialty {
  id: string;
  name: string;
}

// Evento local para forçar re-render entre componentes na mesma aba
const EV = "nexaclinic:specialties-changed";
function emit() { window.dispatchEvent(new CustomEvent(EV)); }

// ─── CRUD no Supabase ──────────────────────────────────────────────────────

export const specialtyStore = {
  /** Busca todas as especialidades ativas */
  getAll: async (): Promise<Specialty[]> => {
    const { data, error } = await supabase
      .from("especialidades")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    if (error) { console.error("[specialtyStore] getAll:", error.message); return []; }
    return (data ?? []).map((r) => ({ id: r.id, name: r.nome }));
  },

  /** Insere nova especialidade */
  add: async (s: Specialty): Promise<boolean> => {
    const { error } = await supabase
      .from("especialidades")
      .insert({ id: s.id, nome: s.name, ativo: true });
    if (error) { console.error("[specialtyStore] add:", error.message); return false; }
    emit();
    return true;
  },

  /** Atualiza o nome de uma especialidade */
  update: async (id: string, name: string): Promise<boolean> => {
    const { error } = await supabase
      .from("especialidades")
      .update({ nome: name, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("[specialtyStore] update:", error.message); return false; }
    emit();
    return true;
  },

  /** Soft-delete: marca como inativo */
  remove: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("especialidades")
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) { console.error("[specialtyStore] remove:", error.message); return false; }
    emit();
    return true;
  },
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSpecialty() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading]         = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await specialtyStore.getAll();
    setSpecialties(data);
    setLoading(false);
  }, []);

  // Carrega ao montar e escuta eventos de outras abas/componentes
  useEffect(() => {
    refresh();
    window.addEventListener(EV, refresh);
    return () => window.removeEventListener(EV, refresh);
  }, [refresh]);

  const addSpecialty = async (s: Specialty): Promise<boolean> => {
    const ok = await specialtyStore.add(s);
    if (ok) await refresh();
    return ok;
  };

  return { specialties, loading, addSpecialty, refresh };
}
