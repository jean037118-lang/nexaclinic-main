import { useEffect, useState } from "react";
import { listarAuditoria, type AuditEntry, ROLE_LABELS } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ClipboardList } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-purple-100 text-purple-800",
  medico:     "bg-blue-100 text-blue-800",
  recepcao:   "bg-green-100 text-green-800",
  financeiro: "bg-amber-100 text-amber-800",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export function AuditoriaLog() {
  const [busca, setBusca] = useState("");
  const [log, setLog] = useState<AuditEntry[]>([]);

  useEffect(() => {
    listarAuditoria().then((dados) => setLog(dados));
  }, []);

  const entries: AuditEntry[] = log.filter((e) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      e.usuarioNome.toLowerCase().includes(q) ||
      e.acao.toLowerCase().includes(q) ||
      (e.detalhe ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Auditoria do Sistema</h2>
          <p className="text-xs text-muted-foreground">
            {entries.length} registro{entries.length !== 1 ? "s" : ""} encontrado{entries.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por usuário, ação ou detalhe…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <ScrollArea className="h-[500px] rounded-xl border bg-white">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground py-16">
            Nenhum registro encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Data/Hora</th>
                <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Usuário</th>
                <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Papel</th>
                <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Ação</th>
                <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground font-mono">
                    {fmt(e.ts)}
                  </td>
                  <td className="px-4 py-2 font-medium">{e.usuarioNome}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[e.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {ROLE_LABELS[e.role] ?? e.role}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.acao}</code>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={e.detalhe}>
                    {e.detalhe ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ScrollArea>
    </div>
  );
}
