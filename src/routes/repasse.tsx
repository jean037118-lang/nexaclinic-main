import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback, useEffect } from "react";
import { financialStorage } from "@/lib/financial/storage";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "@/lib/pdfHeader";
import {
  Calendar, Download, FileText, Filter, Search,
  TrendingUp, TrendingDown, Users, DollarSign, Percent,
  ChevronDown, ChevronUp, Printer, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { professionals } from "@/lib/mock-data";
import type { AppointmentExt } from "./agenda";
import {
  listarProfissionais,
  listarProcedimentos,
  listarAgendamentos,
} from "@/lib/agendaData";

export const Route = createFileRoute("/repasse")({
  head: () => ({ meta: [{ title: "Repasse Médico — NexaClinic" }] }),
  component: RepassePage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────
interface Procedimento {
  id: string;
  name: string;
  tussCode: string;
  category: string;
  durationMin: number;
  valorParticular: string;
  convenioValores: { convenio: string; valor: string }[];
  status: "ativo" | "inativo";
}

interface Professional {
  id: string;
  name: string;
  specialty: string;
  crm: string;
  color: string;
  active: boolean;
  appointmentDuration: number;
  workDays: string;
  repasseType?: "percentual" | "fixo";
  repasseValue?: number;
  repasseRegras?: { convenio: string; procedimento?: string; tipo: "percentual" | "fixo"; valor: number }[];
}

interface RepasseRow {
  appointmentId: string;
  data: string;
  paciente: string;
  profissional: string;
  profissionalId: string;
  procedimento: string;
  convenio: string;
  horario: string;
  valorProcedimento: number;
  percentualRepasse: number;
  valorRepasse: number;
  status: string;
  pago: boolean;
  formaPagamento?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const APT_KEY = "nexaclinic_appointments_v3";
const PROC_KEY = "nexaclinic_procedimentos";
const PROF_KEY = "nexaclinic_professionals";
const REPASSE_PERC_KEY = "nexaclinic_repasse_percentuais";

function fmtBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Storage helpers ──────────────────────────────────────────────────────
function loadAppointments(): AppointmentExt[] {
  try { return JSON.parse(localStorage.getItem(APT_KEY) ?? "[]"); } catch { return []; }
}
function loadProcedimentos(): Procedimento[] {
  try { return JSON.parse(localStorage.getItem(PROC_KEY) ?? "[]"); } catch { return []; }
}
function loadProfessionals(): Professional[] {
  try {
    const saved = localStorage.getItem(PROF_KEY);
    const base: Professional[] = saved ? JSON.parse(saved) : professionals;
    // Mescla percentuais legados (chave separada) apenas se o profissional não tiver repasseValue definido
    const percs: Record<string, number> = JSON.parse(
      localStorage.getItem(REPASSE_PERC_KEY) ?? "{}"
    );
    return base.map((p) => ({
      ...p,
      repasseType:   p.repasseType  ?? "percentual",
      repasseValue:  p.repasseValue ?? percs[p.id] ?? 50,
      repasseRegras: p.repasseRegras ?? [],
    }));
  } catch { return professionals.map((p) => ({ ...p, repasseType: "percentual" as const, repasseValue: 50, repasseRegras: [] })); }
}

// Calcula o valor de repasse de acordo com as regras do profissional
// Prioridade: procedimento+convênio > só procedimento > só convênio > padrão global
function calcularRepasse(
  prof: Professional,
  convenio: string,
  valorProcedimento: number,
  procedimento?: string,
): { percentualRepasse: number; valorRepasse: number } {
  const regras: RepasseRegra[] = (prof.repasseRegras ?? []) as RepasseRegra[];
  const convLow  = (convenio    ?? "").toLowerCase().trim();
  const procLow  = (procedimento ?? "").toLowerCase().trim();

  const match = (r: RepasseRegra) => {
    const rConv = (r.convenio    ?? "*").toLowerCase().trim();
    const rProc = (r.procedimento ?? "*").toLowerCase().trim();
    const convOk = rConv === "*" || rConv === convLow;
    const procOk = !r.procedimento || rProc === "*" || rProc === procLow;
    return convOk && procOk;
  };

  let regra: { tipo: "percentual" | "fixo"; valor: number } | undefined;

  if (procLow) {
    // 1. Mais específico: procedimento exato + convênio exato
    regra = regras.find((r) => {
      const rConv = (r.convenio    ?? "*").toLowerCase().trim();
      const rProc = (r.procedimento ?? "").toLowerCase().trim();
      return rProc === procLow && rConv === convLow;
    });
    // 2. Procedimento exato + qualquer convênio
    if (!regra) regra = regras.find((r) => {
      const rConv = (r.convenio    ?? "*").toLowerCase().trim();
      const rProc = (r.procedimento ?? "").toLowerCase().trim();
      return rProc === procLow && (rConv === "*" || !r.convenio || rConv === "");
    });
  }
  // 3. Só convênio (regra sem procedimento específico)
  if (!regra) regra = regras.find((r) => {
    const rConv = (r.convenio    ?? "*").toLowerCase().trim();
    const rProc = (r.procedimento ?? "*").toLowerCase().trim();
    return rConv === convLow && (rProc === "*" || rProc === "");
  });
  // 4. Padrão global do profissional
  if (!regra) regra = { tipo: prof.repasseType ?? "percentual", valor: prof.repasseValue ?? 50 };

  if (regra.tipo === "fixo") {
    return {
      percentualRepasse: valorProcedimento > 0 ? Math.round((regra.valor / valorProcedimento) * 100) : 0,
      valorRepasse: regra.valor,
    };
  }
  const perc = regra.valor;
  return { percentualRepasse: perc, valorRepasse: (valorProcedimento * perc) / 100 };
}

// Busca valor do procedimento pelo cadastro conforme convênio
function getProcedureValue(
  procedureName: string,
  insurance: string,
  procs: Procedimento[]
): number {
  const found = procs.find(
    (p) => p.name.toLowerCase() === procedureName.toLowerCase() && p.status === "ativo"
  );
  if (!found) return 0;
  if (insurance === "Particular") return parseFloat(found.valorParticular) || 0;
  const cv = found.convenioValores?.find((c) => c.convenio === insurance);
  return parseFloat(cv?.valor ?? found.valorParticular) || 0;
}

// ─── Componente principal ─────────────────────────────────────────────────
function RepassePage() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo, setDateTo] = useState(todayStr());
  const [filterProf, setFilterProf] = useState("todos");
  const [filterConvenio, setFilterConvenio] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof RepasseRow>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ─── Dialog: Criar Conta a Pagar ─────────────────────────────────────────
  const [contaDialogOpen, setContaDialogOpen] = useState(false);
  const [contaForm, setContaForm] = useState({
    profissionalId: "",
    profissionalNome: "",
    valorRepasse: 0,
    description: "",
    dueDate: "",
    notes: "",
  });

  function abrirCriarConta(profId: string, profNome: string, valorRepasse: number) {
    // Vencimento padrão: último dia do mês do período filtrado
    const ref = dateTo || todayStr();
    const [y, m] = ref.split("-");
    const lastDay = new Date(Number(y), Number(m), 0).toISOString().split("T")[0];
    setContaForm({
      profissionalId: profId,
      profissionalNome: profNome,
      valorRepasse,
      description: `Repasse médico — ${profNome} (${dateFrom} a ${dateTo})`,
      dueDate: lastDay,
      notes: `Gerado automaticamente pelo módulo de Repasse Médico.
Período: ${dateFrom} a ${dateTo}`,
    });
    setContaDialogOpen(true);
  }

  async function salvarContaPagar() {
    if (!contaForm.dueDate) { toast.error("Informe a data de vencimento"); return; }
    if (!contaForm.description.trim()) { toast.error("Informe a descrição"); return; }
    const now = new Date().toISOString();
    try {
      await financialStorage.saveAccount({
        id: "",
        type: "pagar",
        description: contaForm.description,
        value: contaForm.valorRepasse,
        dueDate: contaForm.dueDate,
        category: "repasse_medico",
        status: "pendente",
        notes: contaForm.notes,
        createdAt: now,
        updatedAt: now,
      });
      toast.success(`Conta a pagar criada — ${fmtBRL(contaForm.valorRepasse)}`, {
        description: contaForm.description,
      });
      setContaDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar conta a pagar");
    }
  }

  // Carrega dados do Supabase
  const [appointments, setAppointments] = useState<AppointmentExt[]>([]);
  const [procedimentos, setProcedimentos] = useState<Procedimento[]>([]);
  const [profs, setProfs] = useState<Professional[]>([]);
  const [loadingDados, setLoadingDados] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const [apts, procs, profissionaisDb] = await Promise.all([
          listarAgendamentos(),
          listarProcedimentos(),
          listarProfissionais(),
        ]);
        setAppointments(apts as AppointmentExt[]);
        setProcedimentos(procs as Procedimento[]);
        // Mescla percentual legado salvo em localStorage apenas se o profissional
        // não tiver repasseValue definido no banco (compatibilidade).
        const percs: Record<string, number> = (() => {
          try { return JSON.parse(localStorage.getItem(REPASSE_PERC_KEY) ?? "{}"); }
          catch { return {}; }
        })();
        setProfs((profissionaisDb as Professional[]).map((p) => ({
          ...p,
          repasseType: p.repasseType ?? "percentual",
          repasseValue: p.repasseValue ?? percs[p.id] ?? 50,
          repasseRegras: (p as any).repasseRegras ?? [],
        })));
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar dados de repasse");
      } finally {
        setLoadingDados(false);
      }
    }
    carregar();
  }, []);

  // ─── Monta linhas de repasse ──────────────────────────────────────────
  const allRows = useMemo<RepasseRow[]>(() => {
    // IDs de agendamentos que já têm repasse gerado via faturamento (repasseAoFaturar)
    const REPASSE_ITENS_KEY = "nexaclinic_repasse_itens";
    let repasseItens: any[] = [];
    try { repasseItens = JSON.parse(localStorage.getItem(REPASSE_ITENS_KEY) ?? "[]"); } catch { repasseItens = []; }
    const idsNoFaturamento = new Set(repasseItens.map((r: any) => r.appointmentId));

    // Linhas geradas automaticamente pelo faturamento (convênios com repasseAoFaturar)
    const rowsFaturamento: RepasseRow[] = repasseItens.map((r: any) => {
      const apt = appointments.find((a) => a.id === r.appointmentId);
      return {
        appointmentId: r.appointmentId,
        data: r.data,
        paciente: r.paciente,
        profissional: r.profissional,
        profissionalId: r.profissionalId,
        procedimento: r.procedimento,
        convenio: r.convenio,
        horario: apt?.start ?? "",
        valorProcedimento: r.valorProcedimento,
        percentualRepasse: r.percentualRepasse,
        valorRepasse: r.valorRepasse,
        status: apt?.status ?? "finalizado",
        pago: apt?.paid ?? false,
        formaPagamento: apt?.paymentMethod,
      } as RepasseRow;
    });

    // ── helper para detectar retorno (mesmo critério da agenda) ──
    function isRetornoProc(procedure: string): boolean {
      const p = (procedure ?? "").toLowerCase();
      return p.includes("retorno") || p.includes("revisão") || p.includes("revisao");
    }

    // Linhas dos agendamentos normais (excluindo os já tratados pelo faturamento)
    const rowsAgenda: RepasseRow[] = appointments
      .filter((a) => {
        if (a.status === "cancelado" || a.status === "faltou") return false;
        // Já foi processado via faturamento — evita duplicata
        if (idsNoFaturamento.has(a.id)) return false;
        // Retornos entram sempre (sem exigir pagamento) — para controle
        if (isRetornoProc(a.procedure ?? "")) return true;
        const prof = profs.find((p) => p.id === a.professionalId);
        const exigePagamento = (prof as any)?.repasseSomenteComPagamento !== false;
        if (exigePagamento && !a.paid) return false;
        return true;
      })
      .map((a) => {
        const prof = profs.find((p) => p.id === a.professionalId);
        const retorno = isRetornoProc(a.procedure ?? "");
        // Retorno: valor zero, repasse zero (sem cobrança)
        const valorCadastro = retorno ? 0 : getProcedureValue(a.procedure, a.insurance, procedimentos);
        const valorProcedimento = retorno ? 0 : (valorCadastro > 0 ? valorCadastro : (a.procedureValue ?? 0));
        const { percentualRepasse, valorRepasse } = (retorno || valorProcedimento === 0)
          ? { percentualRepasse: 0, valorRepasse: 0 }
          : prof
            ? calcularRepasse(prof, a.insurance, valorProcedimento, a.procedure)
            : { percentualRepasse: 50, valorRepasse: (valorProcedimento * 50) / 100 };
        return {
          appointmentId: a.id,
          data: a.date,
          paciente: a.patientName,
          profissional: prof?.name ?? "Desconhecido",
          profissionalId: a.professionalId,
          procedimento: a.procedure,
          convenio: a.insurance,
          horario: a.start,
          valorProcedimento,
          percentualRepasse,
          valorRepasse,
          status: a.status,
          pago: a.paid ?? false,
          formaPagamento: a.paymentMethod,
          isRetorno: retorno,
        } as RepasseRow & { isRetorno?: boolean };
      });

    return [...rowsFaturamento, ...rowsAgenda];
  }, [appointments, procedimentos, profs]);

  // ─── Filtros ──────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = allRows.filter((r) => {
      if (r.data < dateFrom || r.data > dateTo) return false;
      if (filterProf !== "todos" && r.profissionalId !== filterProf) return false;
      if (filterConvenio !== "todos" && r.convenio !== filterConvenio) return false;
      if (filterStatus === "pago" && !r.pago) return false;
      if (filterStatus === "pendente" && r.pago) return false;
      if (filterStatus === "finalizado" && r.status !== "finalizado") return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (
          !r.paciente.toLowerCase().includes(q) &&
          !r.procedimento.toLowerCase().includes(q) &&
          !r.profissional.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });

    // Ordenação
    rows = [...rows].sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      return sortDir === "asc"
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });

    return rows;
  }, [allRows, dateFrom, dateTo, filterProf, filterConvenio, filterStatus, searchTerm, sortField, sortDir]);

  // ─── Totalizadores ────────────────────────────────────────────────────
  const totais = useMemo(() => {
    const totalProcedimentos = filteredRows.reduce((s, r) => s + r.valorProcedimento, 0);
    const totalRepasse = filteredRows.reduce((s, r) => s + r.valorRepasse, 0);
    const totalClinica = totalProcedimentos - totalRepasse;
    const atendimentos = filteredRows.length;
    const pagos = filteredRows.filter((r) => r.pago).length;
    return { totalProcedimentos, totalRepasse, totalClinica, atendimentos, pagos };
  }, [filteredRows]);

  // Totais por profissional
  const totalsPorProf = useMemo(() => {
    const map: Record<string, { nome: string; color: string; atend: number; bruto: number; repasse: number; clinica: number }> = {};
    for (const r of filteredRows) {
      if (!map[r.profissionalId]) {
        const p = profs.find((x) => x.id === r.profissionalId);
        map[r.profissionalId] = {
          nome: r.profissional,
          color: p?.color ?? "#888",
          atend: 0, bruto: 0, repasse: 0, clinica: 0,
        };
      }
      map[r.profissionalId].atend += 1;
      map[r.profissionalId].bruto += r.valorProcedimento;
      map[r.profissionalId].repasse += r.valorRepasse;
      map[r.profissionalId].clinica += r.valorProcedimento - r.valorRepasse;
    }
    return Object.values(map).sort((a, b) => b.repasse - a.repasse);
  }, [filteredRows, profs]);

  const convenios = useMemo(() => {
    const set = new Set(allRows.map((r) => r.convenio));
    return Array.from(set).sort();
  }, [allRows]);

  function toggleSort(field: keyof RepasseRow) {
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: keyof RepasseRow }) {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-primary" />
      : <ChevronDown className="h-3 w-3 text-primary" />;
  }



  // ─── Exportação CSV ───────────────────────────────────────────────────
  function exportCSV() {
    const headers = [
      "Data", "Horário", "Paciente", "Profissional", "Procedimento",
      "Convênio", "Valor Procedimento", "% Repasse", "Valor Repasse",
      "Valor Clínica", "Status", "Pago", "Forma Pagamento",
    ];
    const rows = filteredRows.map((r) => [
      fmtDate(r.data), r.horario, r.paciente, r.profissional, r.procedimento,
      r.convenio,
      r.valorProcedimento.toFixed(2),
      r.percentualRepasse.toFixed(0) + "%",
      r.valorRepasse.toFixed(2),
      (r.valorProcedimento - r.valorRepasse).toFixed(2),
      r.status, r.pago ? "Sim" : "Não", r.formaPagamento ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `repasse_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Intercepta Ctrl+P para usar o PDF profissional ──────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        printReport();
      }
    };
    const beforePrint = (e: Event) => { e.preventDefault(); printReport(); };
    window.addEventListener('keydown', handler);
    window.addEventListener('beforeprint', beforePrint);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('beforeprint', beforePrint);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, totalsPorProf, totais, dateFrom, dateTo]);

  // ─── Geração de PDF profissional ─────────────────────────────────────
  async function printReport() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const primary = [14, 116, 144] as [number, number, number];
    const dark    = [15,  23,  42] as [number, number, number];
    const gray    = [100, 116, 139] as [number, number, number];
    const green   = [22,  163,  74] as [number, number, number];
    const blue    = [37,  99,  235] as [number, number, number];
    const white   = [255, 255, 255] as [number, number, number];

    // ── CABEÇALHO com logo da empresa ─────────────────────────────────────
    let y = await drawPdfHeader(
      doc,
      "RELATÓRIO DE REPASSE MÉDICO",
      `Período: ${fmtDate(dateFrom)} a ${fmtDate(dateTo)}`,
      "landscape"
    );

    // ── CARDS DE RESUMO ───────────────────────────────────────────────────
    const cardW = (pageW - 24) / 4;
    const cards = [
      { label: "Atendimentos", value: String(totais.atendimentos), sub: `${totais.pagos} pagos`, color: primary },
      { label: "Total Faturado", value: fmtBRL(totais.totalProcedimentos), sub: "valor dos procedimentos", color: green },
      { label: "Total Repasse", value: fmtBRL(totais.totalRepasse), sub: "a pagar aos médicos", color: blue },
      { label: "Receita Clínica", value: fmtBRL(totais.totalClinica), sub: "após repasse", color: [139, 92, 246] as [number, number, number] },
    ];

    cards.forEach((card, i) => {
      const x = 12 + i * (cardW + 2);
      // fundo do card
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
      // barra lateral colorida
      doc.setFillColor(...card.color);
      doc.roundedRect(x, y, 3, 18, 1, 1, "F");
      // textos
      doc.setTextColor(...gray);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label.toUpperCase(), x + 6, y + 6);
      doc.setTextColor(...dark);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + 6, y + 12);
      doc.setTextColor(...gray);
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text(card.sub, x + 6, y + 17);
    });

    y += 24;

    // ── RESUMO POR PROFISSIONAL ───────────────────────────────────────────
    if (totalsPorProf.length > 0) {
      doc.setTextColor(...dark);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMO POR PROFISSIONAL", 12, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        margin: { left: 12, right: 12 },
        head: [["Profissional", "Especialidade", "Atend.", "Valor Bruto", "% Repasse", "Repasse Médico", "Receita Clínica"]],
        body: totalsPorProf.map((p) => {
          const prof = profs.find((x) => x.name === p.nome);
          const regrasDesc = (() => {
            const regras = prof?.repasseRegras ?? [];
            if (regras.length === 0) {
              return prof?.repasseType === "fixo"
                ? `R$ ${(prof.repasseValue ?? 0).toFixed(2)} fixo`
                : `${prof?.repasseValue ?? 50}% (padrão)`;
            }
            return regras.map((r: any) => {
              const proc = r.procedimento && r.procedimento !== "*" ? r.procedimento : null;
              const conv = r.convenio && r.convenio !== "*" ? r.convenio : null;
              const scope = [proc, conv].filter(Boolean).join("/") || "Padrão";
              const taxa = r.tipo === "fixo" ? `R$${r.valor}` : `${r.valor}%`;
              return `${scope}: ${taxa}`;
            }).join(", ") + ` | padrão: ${prof?.repasseValue ?? 50}%`;
          })();
          return [
            p.nome,
            prof?.specialty ?? "—",
            String(p.atend),
            fmtBRL(p.bruto),
            regrasDesc,
            fmtBRL(p.repasse),
            fmtBRL(p.clinica),
          ];
        }),
        foot: [[
          { content: `TOTAL (${totais.atendimentos} atendimentos)`, colSpan: 2 },
          String(totais.atendimentos),
          fmtBRL(totais.totalProcedimentos),
          "",
          fmtBRL(totais.totalRepasse),
          fmtBRL(totais.totalClinica),
        ]],
        headStyles: {
          fillColor: dark,
          textColor: white,
          fontSize: 7,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: { fontSize: 7.5, textColor: dark },
        footStyles: {
          fillColor: [241, 245, 249] as [number,number,number],
          textColor: dark,
          fontSize: 7.5,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 36 },
          2: { halign: "center", cellWidth: 18 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "center", cellWidth: 22 },
          5: { halign: "right", cellWidth: 30, textColor: blue },
          6: { halign: "right", cellWidth: 30 },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] as [number,number,number] },
        showFoot: "lastPage",
      });

      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // ── ATENDIMENTOS DETALHADOS ───────────────────────────────────────────
    doc.setTextColor(...dark);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    // Se passou de página
    if (y > pageH - 60) {
      doc.addPage();
      y = 15;
    }

    doc.text(`ATENDIMENTOS DETALHADOS  (${filteredRows.length} registros)`, 12, y);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [["Data", "Horário", "Paciente", "Profissional", "Procedimento", "Convênio", "Valor", "%", "Repasse", "Clínica", "Pago"]],
      body: filteredRows.map((r) => [
        fmtDate(r.data),
        r.horario,
        r.paciente,
        r.profissional,
        (r as any).isRetorno ? `${r.procedimento} [RETORNO]` : r.procedimento,
        r.convenio,
        r.valorProcedimento > 0 ? fmtBRL(r.valorProcedimento) : "—",
        (r as any).isRetorno ? "—" : `${r.percentualRepasse}%`,
        r.valorRepasse > 0 ? fmtBRL(r.valorRepasse) : "—",
        r.valorProcedimento - r.valorRepasse > 0 ? fmtBRL(r.valorProcedimento - r.valorRepasse) : "—",
        (r as any).isRetorno ? "Retorno s/ cobrança" : (r.pago ? "✓ Pago" : "Pendente"),
      ]),
      foot: [[
        { content: `Total: ${totais.atendimentos} atend.`, colSpan: 6 },
        fmtBRL(totais.totalProcedimentos),
        "",
        fmtBRL(totais.totalRepasse),
        fmtBRL(totais.totalClinica),
        `${totais.pagos} pagos`,
      ]],
      headStyles: {
        fillColor: primary,
        textColor: white,
        fontSize: 6.5,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: { fontSize: 7, textColor: dark },
      footStyles: {
        fillColor: [241, 245, 249] as [number,number,number],
        textColor: dark,
        fontSize: 7,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 36 },
        3: { cellWidth: 36 },
        4: { cellWidth: 28 },
        5: { cellWidth: 20 },
        6: { halign: "right", cellWidth: 22 },
        7: { halign: "center", cellWidth: 10 },
        8: { halign: "right", cellWidth: 22, textColor: blue },
        9: { halign: "right", cellWidth: 22 },
        10: { halign: "center", cellWidth: 16 },
      },
      alternateRowStyles: { fillColor: [248, 250, 252] as [number,number,number] },
      showFoot: "lastPage",
      didParseCell: (data) => {
        // Destaca "✓ Pago" em verde e "Pendente" em cinza
        if (data.column.index === 10 && data.section === "body") {
          const cell = data.cell;
          if (String(data.cell.raw).includes("Pago")) {
            cell.styles.textColor = green;
            cell.styles.fontStyle = "bold";
          } else {
            cell.styles.textColor = gray;
          }
        }
        // Repasse em azul
        if (data.column.index === 8 && data.section === "body") {
          data.cell.styles.textColor = blue;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // ── RODAPÉ EM TODAS AS PÁGINAS ────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...dark);
      doc.rect(0, pageH - 8, pageW, 8, "F");
      doc.setTextColor(...white);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("NexaClinic — Gestão Clínica Inteligente  |  Documento gerado automaticamente", 12, pageH - 3);
      doc.text(`Página ${i} de ${totalPages}`, pageW - 12, pageH - 3, { align: "right" });
    }

    doc.save(`repasse_${dateFrom}_${dateTo}.pdf`);
  }

  // Profissionais com regra de "somente com pagamento" ativa
  const profsComRestricao = profs.filter((p) => (p as any).repasseSomenteComPagamento !== false);

  return (
    <div className="space-y-6">
      {/* Banner informativo */}
      {profsComRestricao.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 print:hidden">
          <span className="mt-0.5 text-amber-500">⚠️</span>
          <div className="text-xs text-amber-800">
            <span className="font-semibold">Repasse condicionado ao pagamento:</span>{" "}
            {profsComRestricao.map((p) => p.name).join(", ")}{" "}
            — atendimentos sem pagamento do paciente <strong>não aparecem nesta lista</strong>.
            Para alterar, acesse{" "}
            <a href="/profissionais" className="underline hover:text-amber-900">Cadastro de Profissionais</a>.
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Repasse Médico</h1>
          <p className="text-sm text-muted-foreground">
            Cálculo de repasse por profissional com base nos procedimentos e convênios.{" "}
            <a href="/profissionais" className="text-primary hover:underline">
              Configurar regras de repasse →
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printReport} className="gap-1.5">
            <Printer className="h-4 w-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      {/* Título para impressão — removido: use o botão "Gerar PDF" */}

      {/* ─── Filtros ─────────────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-elegant print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-muted-foreground mt-6" />
            <div>
              <Label className="text-xs">Data início</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Data fim</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={filterProf} onValueChange={setFilterProf}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {profs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Convênio</Label>
              <Select value={filterConvenio} onValueChange={setFilterConvenio}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {convenios.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status pagamento</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Paciente, procedimento..."
                  className="pl-8 w-48"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 mt-0.5"
              onClick={() => {
                setDateFrom(firstOfMonth());
                setDateTo(todayStr());
                setFilterProf("todos");
                setFilterConvenio("todos");
                setFilterStatus("todos");
                setSearchTerm("");
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Cards de resumo ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="border-border/60 shadow-elegant">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atendimentos</p>
                <p className="text-2xl font-bold">{totais.atendimentos}</p>
                <p className="text-[10px] text-muted-foreground">{totais.pagos} pagos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-elegant">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total faturado</p>
                <p className="text-xl font-bold text-success">{fmtBRL(totais.totalProcedimentos)}</p>
                <p className="text-[10px] text-muted-foreground">valor dos procedimentos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-elegant">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
                <TrendingUp className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total repasse</p>
                <p className="text-xl font-bold text-info">{fmtBRL(totais.totalRepasse)}</p>
                <p className="text-[10px] text-muted-foreground">a pagar aos médicos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-elegant">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                <Percent className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita clínica</p>
                <p className="text-xl font-bold">{fmtBRL(totais.totalClinica)}</p>
                <p className="text-[10px] text-muted-foreground">após repasse</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Resumo por profissional ──────────────────────────────────── */}
      {totalsPorProf.length > 0 && (
        <Card className="border-border/60 shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Resumo por Profissional</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-center">Atend.</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-center">% Repasse</TableHead>
                    <TableHead className="text-right text-info">Repasse Médico</TableHead>
                    <TableHead className="text-right">Receita Clínica</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {totalsPorProf.map((p) => {
                    const prof = profs.find((x) => x.name === p.nome);
                    const profId = prof?.id ?? "";
                    return (
                      <TableRow key={p.nome} className="hover:bg-muted/30 transition">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ background: p.color }}
                            />
                            <div>
                              <p className="font-medium text-sm">{p.nome}</p>
                              <p className="text-[10px] text-muted-foreground">{prof?.specialty}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">{p.atend}</TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(p.bruto)}</TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const regras = prof?.repasseRegras ?? [];
                            if (regras.length === 0) {
                              return (
                                <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-xs font-medium">
                                  <Percent className="h-3 w-3" />
                                  {prof?.repasseType === "fixo"
                                    ? `R$ ${(prof.repasseValue ?? 0).toFixed(2)}`
                                    : `${prof?.repasseValue ?? 50}%`}
                                </span>
                              );
                            }
                            return (
                              <div className="flex flex-col gap-0.5 items-center">
                                {regras.map((r: any, i: number) => {
                                  const proc = r.procedimento && r.procedimento !== "*" ? r.procedimento : null;
                                  const conv = r.convenio && r.convenio !== "*" ? r.convenio : null;
                                  const scope = [proc, conv].filter(Boolean).join(" / ") || "Padrão";
                                  const taxa = r.tipo === "fixo" ? `R$ ${r.valor.toFixed(2)}` : `${r.valor}%`;
                                  return (
                                    <span key={i} className="text-[10px] bg-muted rounded-full px-2 py-0.5 whitespace-nowrap" title={scope}>
                                      {scope}: {taxa}
                                    </span>
                                  );
                                })}
                                <span className="text-[10px] text-muted-foreground">
                                  padrão: {prof?.repasseType === "fixo" ? `R$${prof.repasseValue}` : `${prof?.repasseValue ?? 50}%`}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-info">
                          {fmtBRL(p.repasse)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtBRL(p.clinica)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs border-red-200 text-red-700 hover:bg-red-50 whitespace-nowrap"
                            onClick={() => {
                              const profObj = profs.find((x) => x.name === p.nome);
                              abrirCriarConta(profObj?.id ?? p.nome, p.nome, p.repasse);
                            }}
                          >
                            <TrendingDown className="h-3 w-3" /> Criar Conta
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Totais */}
                  <TableRow className="bg-muted/50 font-bold border-t-2 border-border">
                    <TableCell colSpan={3}>
                      <span className="text-sm">TOTAL</span>
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({totais.atendimentos} atendimentos)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(totais.totalProcedimentos)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-info">{fmtBRL(totais.totalRepasse)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(totais.totalClinica)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Tabela detalhada de atendimentos ────────────────────────── */}
      <Card className="border-border/60 shadow-elegant">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Atendimentos Detalhados
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {filteredRows.length} registro{filteredRows.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum atendimento encontrado para o período e filtros selecionados.</p>
              <p className="text-xs">Ajuste os filtros acima para visualizar os dados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("data")}
                    >
                      <span className="flex items-center gap-1">
                        Data <SortIcon field="data" />
                      </span>
                    </TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("paciente")}
                    >
                      <span className="flex items-center gap-1">
                        Paciente <SortIcon field="paciente" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => toggleSort("profissional")}
                    >
                      <span className="flex items-center gap-1">
                        Profissional <SortIcon field="profissional" />
                      </span>
                    </TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Convênio</TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => toggleSort("valorProcedimento")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Valor <SortIcon field="valorProcedimento" />
                      </span>
                    </TableHead>
                    <TableHead className="text-center">%</TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none text-info"
                      onClick={() => toggleSort("valorRepasse")}
                    >
                      <span className="flex items-center justify-end gap-1">
                        Repasse <SortIcon field="valorRepasse" />
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Clínica</TableHead>
                    <TableHead className="text-center">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => {
                    const prof = profs.find((p) => p.id === r.profissionalId);
                    const clinicaVal = r.valorProcedimento - r.valorRepasse;
                    return (
                      <TableRow key={r.appointmentId} className="hover:bg-muted/20 transition">
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {fmtDate(r.data)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.horario}</TableCell>
                        <TableCell className="text-sm">{r.paciente}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ background: prof?.color ?? "#888" }}
                            />
                            <span className="text-sm truncate max-w-[140px]">{r.profissional}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {r.procedimento}
                            {(r as any).isRetorno && (
                              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                                Retorno
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] px-1.5 whitespace-nowrap">
                            {r.convenio}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {r.valorProcedimento > 0 ? fmtBRL(r.valorProcedimento) : (
                            <span className="text-muted-foreground text-xs italic">sem valor</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {r.percentualRepasse}%
                        </TableCell>
                        <TableCell className="text-right font-semibold text-info">
                          {r.valorRepasse > 0 ? fmtBRL(r.valorRepasse) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {clinicaVal > 0 ? fmtBRL(clinicaVal) : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.pago ? (
                            <Badge className="bg-success/15 text-success border-success/30 text-[10px] px-1.5">
                              Pago
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Rodapé com totais */}
              <div className="border-t border-border bg-muted/30 px-4 py-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Atendimentos: </span>
                    <span className="font-semibold">{totais.atendimentos}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Faturamento: </span>
                    <span className="font-semibold">{fmtBRL(totais.totalProcedimentos)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Repasse total: </span>
                    <span className="font-semibold text-info">{fmtBRL(totais.totalRepasse)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Receita clínica: </span>
                    <span className="font-semibold">{fmtBRL(totais.totalClinica)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

{/* ─── Dialog: Criar Conta a Pagar ─────────────────────────────────── */}
      <Dialog open={contaDialogOpen} onOpenChange={(o) => !o && setContaDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Criar Conta a Pagar — Repasse Médico
            </DialogTitle>
            <DialogDescription>
              Gera uma conta a pagar no Financeiro para o repasse de <strong>{contaForm.profissionalNome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Descrição *</Label>
              <Input
                value={contaForm.description}
                onChange={(e) => setContaForm({ ...contaForm, description: e.target.value })}
                placeholder="Ex: Repasse médico — Dr. João"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={contaForm.valorRepasse}
                  onChange={(e) => setContaForm({ ...contaForm, valorRepasse: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Vencimento *</Label>
                <Input
                  type="date"
                  value={contaForm.dueDate}
                  onChange={(e) => setContaForm({ ...contaForm, dueDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={3}
                value={contaForm.notes}
                onChange={(e) => setContaForm({ ...contaForm, notes: e.target.value })}
                placeholder="Informações adicionais..."
              />
            </div>
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              Esta conta aparecerá em <strong>Financeiro → Contas a Pagar</strong> com status <em>Pendente</em>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={salvarContaPagar} className="bg-red-600 text-white hover:bg-red-700 gap-1.5">
              <TrendingDown className="h-4 w-4" /> Criar Conta a Pagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
