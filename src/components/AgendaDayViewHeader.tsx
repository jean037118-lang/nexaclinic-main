/**
 * AgendaDayViewHeader.tsx
 * 
 * Substitua o bloco de "Header" dentro do view === "day" no arquivo
 * nexaclinic-main/src/routes/agenda.tsx
 *
 * Procure este trecho original:
 *   {/* Header *\/}
 *   <div className="border-b border-r border-border bg-muted/30" />
 *   {visibleProfs.map((p) => (
 *     <div key={p.id} className="flex items-center gap-3 border-b ...">
 *       ...
 *     </div>
 *   ))}
 *
 * E substitua pelo componente <ProfessionalColumnHeader /> abaixo.
 * 
 * ─── INSTRUÇÕES DE USO ────────────────────────────────────────────────────
 * 1. Copie este arquivo para src/components/ProfessionalColumnHeader.tsx
 * 2. No agenda.tsx, importe:
 *      import { ProfessionalColumnHeader } from "@/components/ProfessionalColumnHeader";
 * 3. Substitua os dois blocos do Header (célula vazia + mapa de profissionais)
 *    pelo uso abaixo:
 *
 *   <ProfessionalColumnHeader professionals={visibleProfs} dateLabel={dateLabel} />
 *
 * ─── ATENÇÃO: O componente já inclui a célula vazia do canto superior esquerdo ─
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Stethoscope, FlaskConical } from "lucide-react";

// Tipagem flexível compatível com o objeto professionals do mock-data
interface ProfessionalHeaderProps {
  professionals: Array<{
    id: string;
    name: string;
    specialty?: string;
    crm?: string;
    color?: string;
    avatar?: string;
    tipo?: string;
    scheduleStart?: string;
    scheduleEnd?: string;
    active?: boolean;
  }>;
  dateLabel?: string;
}

// ─── Componente de cabeçalho de profissional individual ──────────────────
function ProfCard({
  professional: p,
}: {
  professional: ProfessionalHeaderProps["professionals"][0];
}) {
  const isExame = p.tipo === "exame";
  const initials = p.name
    .split(" ")
    .slice(1, 3)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const shortName = p.name.split(" ").slice(0, 3).join(" ");
  const scheduleLabel =
    p.scheduleStart && p.scheduleEnd
      ? `${p.scheduleStart} – ${p.scheduleEnd}`
      : null;

  return (
    <div
      className="
        relative flex flex-col items-center gap-2
        border-b border-r border-border last:border-r-0
        bg-background px-3 py-4
        transition-colors duration-200
        hover:bg-muted/40
        group
      "
    >
      {/* Barra colorida superior */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-b-none"
        style={{ background: p.color ?? "#888" }}
      />

      {/* Avatar com anel colorido */}
      <div
        className="relative mt-1"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))" }}
      >
        <div
          className="p-[2px] rounded-full"
          style={{
            background: `linear-gradient(135deg, ${p.color ?? "#888"}, ${p.color ?? "#888"}88)`,
          }}
        >
          <Avatar className="h-11 w-11 ring-2 ring-background">
            {p.avatar ? (
              <AvatarImage
                src={p.avatar}
                alt={p.name}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback
              className="text-sm font-bold text-white"
              style={{ background: p.color ?? "#888" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Indicador ativo */}
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-500 shadow-sm" />
      </div>

      {/* Nome */}
      <div className="text-center min-w-0 w-full">
        <p className="truncate text-[13px] font-semibold text-foreground leading-tight">
          {shortName}
        </p>

        {/* Especialidade com ícone */}
        <div className="flex items-center justify-center gap-1 mt-0.5">
          {isExame ? (
            <FlaskConical className="h-3 w-3 shrink-0 text-violet-500" />
          ) : (
            <Stethoscope className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <p className="truncate text-[11px] text-muted-foreground">
            {p.specialty ?? (isExame ? "Sala de Exame" : "Clínica Geral")}
          </p>
        </div>
      </div>

      {/* Linha divisória fina */}
      <div className="w-full border-t border-border/50" />

      {/* Rodapé: CRM + horário */}
      <div className="flex w-full items-center justify-between gap-1 px-0.5">
        {p.crm ? (
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-1.5 text-[10px] font-medium tracking-tight"
          >
            {p.crm.length > 12 ? p.crm.slice(0, 12) + "…" : p.crm}
          </Badge>
        ) : (
          <span />
        )}

        {scheduleLabel && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5 shrink-0" />
            <span className="tabular-nums">{scheduleLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente exportável (substitui os dois blocos do header) ───────────
export function ProfessionalColumnHeader({
  professionals,
  dateLabel,
}: ProfessionalHeaderProps) {
  return (
    <>
      {/* Célula vazia do canto superior esquerdo (coluna de horas) */}
      <div className="border-b border-r border-border bg-muted/30 flex flex-col items-center justify-end pb-2 gap-1">
        <CalendarDays className="h-4 w-4 text-muted-foreground/50" />
        {dateLabel && (
          <span className="text-[9px] text-muted-foreground/40 text-center px-1 leading-tight">
            {dateLabel.split(",")[0]}
          </span>
        )}
      </div>

      {/* Um card por profissional/sala */}
      {professionals.map((p) => (
        <ProfCard key={p.id} professional={p} />
      ))}
    </>
  );
}
