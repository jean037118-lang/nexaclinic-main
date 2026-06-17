import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  CalendarCheck, Clock3, DollarSign, UserPlus, TrendingUp, TrendingDown,
  Activity, Users, ArrowRight, CheckCircle2, AlertCircle, Calendar,
  BellRing, CreditCard, Cake, ChevronRight, Stethoscope, Percent,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Circle,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { getUsuarioAtual } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
const COLORS = ["#06b6d4", "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date)   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }
function inRange(dateStr: string, ini: Date, fim: Date) {
  const d = new Date(dateStr + "T12:00:00"); return d >= ini && d <= fim;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DeltaBadge({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return null;
  if (!prev) return <span className="text-xs text-slate-400">—</span>;
  const d = ((cur - prev) / prev) * 100;
  if (d === 0) return <span className="flex items-center gap-0.5 text-xs text-slate-400"><Minus className="h-3 w-3" />igual</span>;
  const up = d > 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(d).toFixed(1)}% vs mês ant.
    </span>
  );
}

function OcupBar({ used, total, color }: { used: number; total: number; color: string }) {
  const w = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  finalizado:     "bg-emerald-100 text-emerald-700",
  confirmado:     "bg-cyan-100 text-cyan-700",
  aguardando:     "bg-amber-100 text-amber-700",
  agendado:       "bg-blue-100 text-blue-700",
  em_atendimento: "bg-purple-100 text-purple-700",
  cancelado:      "bg-red-100 text-red-700",
  faltou:         "bg-slate-100 text-slate-500",
};

// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const usuario = getUsuarioAtual();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const nomeUsuario = usuario?.nome?.split(" ")[0] ?? "Doutor(a)";

  // ── Dados brutos ─────────────────────────────────────────────────────────
  const allApts: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_appointments_v3") || "[]"); } catch { return []; }
  }, []);
  const patients: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_patients_v3") || "[]"); } catch { return []; }
  }, []);
  const profs: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_professionals") || "[]"); } catch { return []; }
  }, []);
  const conveniosCad: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_convenios_v2") || "[]"); } catch { return []; }
  }, []);
  // Convênios marcados como "Faturar convênio" — não entram como pendentes de pagamento
  const conveniosFaturados = useMemo(() => new Set(conveniosCad.filter((c: any) => c.faturar).map((c: any) => c.name)), [conveniosCad]);

  const hoje      = new Date();
  const todayStr  = hoje.toISOString().split("T")[0];
  const iniMes    = startOfMonth(hoje);
  const fimMes    = endOfMonth(hoje);
  const iniAnt    = startOfMonth(new Date(hoje.getFullYear(), hoje.getMonth() - 1));
  const fimAnt    = endOfMonth(new Date(hoje.getFullYear(), hoje.getMonth() - 1));

  // ── Segmentos de agendamentos ─────────────────────────────────────────────
  const todayApts  = useMemo(() => allApts.filter(a => (a.date || "").startsWith(todayStr)), [allApts, todayStr]);
  const mesApts    = useMemo(() => allApts.filter(a => inRange(a.date, iniMes, fimMes)), [allApts]);
  const mesAntApts = useMemo(() => allApts.filter(a => inRange(a.date, iniAnt, fimAnt)), [allApts]);

  // ── KPIs hoje ────────────────────────────────────────────────────────────
  const finHoje   = todayApts.filter(a => a.status === "finalizado").length;
  const aguHoje   = todayApts.filter(a => ["aguardando", "agendado", "confirmado"].includes(a.status)).length;
  const cancHoje  = todayApts.filter(a => a.status === "cancelado").length;
  const fatHoje   = todayApts.filter(a => a.paid && a.status !== "cancelado").reduce((s: number, a: any) => s + Number(a.amount || a.procedureValue || 0), 0);

  // ── KPIs mês ──────────────────────────────────────────────────────────────
  const totalMes    = mesApts.length;
  const totalAnt    = mesAntApts.length;
  const fatMes      = mesApts.filter(a => a.paid && a.status !== "cancelado").reduce((s: number, a: any) => s + Number(a.amount || a.procedureValue || 0), 0);
  const fatAnt      = mesAntApts.filter(a => a.paid && a.status !== "cancelado").reduce((s: number, a: any) => s + Number(a.amount || a.procedureValue || 0), 0);
  const cancelMes   = mesApts.filter(a => a.status === "cancelado").length;
  const cancelAnt   = mesAntApts.filter(a => a.status === "cancelado").length;
  const novosPacs   = patients.length;

  // ── Gráfico receita 30 dias (por semana) ─────────────────────────────────
  const chartSemanas = useMemo(() => {
    const result: { label: string; atual: number; anterior: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const ini = new Date(hoje); ini.setDate(hoje.getDate() - (w + 1) * 7);
      const fim = new Date(hoje); fim.setDate(hoje.getDate() - w * 7);
      const iniAntW = new Date(ini); iniAntW.setDate(ini.getDate() - 28);
      const fimAntW = new Date(fim); fimAntW.setDate(fim.getDate() - 28);
      const soma  = (list: any[]) => list.filter(a => { const d = new Date(a.date + "T12:00:00"); return d >= ini && d < fim; }).filter(a => a.paid && a.status !== "cancelado").reduce((s, a) => s + Number(a.amount || a.procedureValue || 0), 0);
      const somaA = (list: any[]) => list.filter(a => { const d = new Date(a.date + "T12:00:00"); return d >= iniAntW && d < fimAntW; }).filter(a => a.paid && a.status !== "cancelado").reduce((s, a) => s + Number(a.amount || a.procedureValue || 0), 0);
      result.push({ label: `${ini.getDate()}/${ini.getMonth() + 1}`, atual: soma(allApts), anterior: somaA(allApts) });
    }
    return result;
  }, [allApts]);

  // ── Convênios do mês ──────────────────────────────────────────────────────
  const convData = useMemo(() => {
    const m: Record<string, number> = {};
    mesApts.forEach((a: any) => { const k = a.insurance || "Particular"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [mesApts]);

  // ── Taxa de ocupação por profissional ─────────────────────────────────────
  const ocupacao = useMemo(() => {
    return profs
      .filter(p => p.status !== "inativo" && p.tipo !== "exame")
      .map(prof => {
        const aptsProf    = todayApts.filter(a => a.professionalId === prof.id);
        const realizados  = aptsProf.filter(a => !["cancelado", "faltou"].includes(a.status)).length;
        // Estima slots: duração padrão x horas disponíveis (08h–18h = 10h)
        const durMin      = Number(prof.appointmentDuration || 30);
        const slotsTotal  = Math.floor((10 * 60) / durMin);
        const taxaPct     = pct(realizados, slotsTotal);
        const color       = prof.color || "#06b6d4";
        return { id: prof.id, nome: prof.name, esp: prof.specialty, realizados, slotsTotal, taxaPct, color };
      })
      .sort((a, b) => b.taxaPct - a.taxaPct)
      .slice(0, 5);
  }, [profs, todayApts]);

  // ── Alertas: sem confirmação ───────────────────────────────────────────────
  const semConfirmacao = useMemo(() =>
    allApts
      .filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date + "T12:00:00");
        const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
        const em3 = new Date(hoje); em3.setDate(hoje.getDate() + 3);
        return d >= amanha && d <= em3 && a.status === "agendado";
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5),
    [allApts]
  );

  // ── Pendentes de pagamento ────────────────────────────────────────────────
  const pendPagamento = useMemo(() =>
    allApts
      .filter((a: any) => a.status === "finalizado" && !a.paid && !conveniosFaturados.has(a.insurance || "Particular"))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [allApts, conveniosFaturados]
  );
  const totalPendente = allApts
    .filter((a: any) => a.status === "finalizado" && !a.paid && !conveniosFaturados.has(a.insurance || "Particular"))
    .reduce((s: number, a: any) => s + Number(a.procedureValue || a.amount || 0), 0);

  // ── Aniversariantes ───────────────────────────────────────────────────────
  const aniversariantes = useMemo(() => {
    const mm = String(hoje.getMonth() + 1).padStart(2, "0");
    const dd = String(hoje.getDate()).padStart(2, "0");
    const ddProx = String(hoje.getDate() + 7).padStart(2, "0"); // aprox próx 7 dias

    return patients
      .filter((p: any) => {
        if (!p.birth) return false;
        const [, pMm, pDd] = p.birth.split("-");
        return pMm === mm && pDd >= dd;
      })
      .map((p: any) => {
        const [ano, pMm, pDd] = p.birth.split("-");
        const isHoje = pMm === mm && pDd === dd;
        const idade  = hoje.getFullYear() - Number(ano);
        return { ...p, isHoje, idade, dayNum: Number(pDd) };
      })
      .sort((a: any, b: any) => a.dayNum - b.dayNum)
      .slice(0, 5);
  }, [patients]);

  // ── Próximos agendamentos ─────────────────────────────────────────────────
  const proxApts = useMemo(() =>
    allApts
      .filter(a => {
        if (!a.date) return false;
        const d = new Date(a.date + "T12:00:00");
        return d >= hoje && !["finalizado", "cancelado"].includes(a.status);
      })
      .sort((a, b) => {
        const da = new Date(a.date + "T" + (a.start || "00:00"));
        const db = new Date(b.date + "T" + (b.start || "00:00"));
        return da.getTime() - db.getTime();
      })
      .slice(0, 6),
    [allApts]
  );

  // ── Status do dia ─────────────────────────────────────────────────────────
  const statusDia = useMemo(() => {
    const m: Record<string, number> = {};
    todayApts.forEach((a: any) => { const s = a.status || "agendado"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [todayApts]);

  const totalAlertas = semConfirmacao.length + pendPagamento.length;

  return (
    <div className="p-5 space-y-5 max-w-[1400px] mx-auto">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 font-medium">{saudacao}, {nomeUsuario}! 👋</p>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight mt-0.5">Visão geral da clínica</h1>
          <p className="text-sm text-slate-400 mt-1">
            {hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {finHoje > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {finHoje} finalizado{finHoje > 1 ? "s" : ""}
            </span>
          )}
          {cancHoje > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
              <AlertCircle className="h-3.5 w-3.5" /> {cancHoje} cancelado{cancHoje > 1 ? "s" : ""}
            </span>
          )}
          {totalAlertas > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <BellRing className="h-3.5 w-3.5" /> {totalAlertas} alerta{totalAlertas > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── KPIs HOJE ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            label: "Atendimentos hoje", value: todayApts.length,
            icon: CalendarCheck, grad: "from-cyan-500 to-cyan-600",
            sub: <span className="text-xs text-slate-500">{finHoje} finaliz. · {aguHoje} aguardando</span>,
          },
          {
            label: "Faturamento hoje", value: fmtBRL(fatHoje),
            icon: DollarSign, grad: "from-emerald-500 to-green-500",
            sub: <DeltaBadge cur={fatMes} prev={fatAnt} />,
          },
          {
            label: "Agendamentos mês", value: totalMes,
            icon: Calendar, grad: "from-violet-500 to-purple-600",
            sub: <DeltaBadge cur={totalMes} prev={totalAnt} />,
          },
          {
            label: "Pacientes cadastr.", value: novosPacs,
            icon: UserPlus, grad: "from-blue-500 to-indigo-600",
            sub: <span className="text-xs text-slate-500">total no sistema</span>,
          },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition group">
              <div className="flex items-start justify-between">
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{c.label}</p>
                  <p className="text-3xl font-bold text-slate-800 leading-none">{c.value}</p>
                  <div className="pt-0.5">{c.sub}</div>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${c.grad} shadow-md`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className={`absolute -bottom-5 -right-5 h-20 w-20 rounded-full bg-gradient-to-br ${c.grad} opacity-[0.06] group-hover:opacity-[0.10] transition-opacity`} />
            </div>
          );
        })}
      </div>

      {/* ── ROW 2: GRÁFICO + CONVÊNIOS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

        {/* Receita semanal com comparativo */}
        <div className="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800">Receita semanal</h2>
              <p className="text-xs text-slate-400 mt-0.5">Mês atual vs mês anterior</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="inline-block w-3 h-0.5 rounded bg-cyan-500" />Atual
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="inline-block w-3 h-0.5 rounded bg-slate-300" />Anterior
              </span>
            </div>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartSemanas} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradAtual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#06b6d4" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAnt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} width={60} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
                  formatter={(v: number, name: string) => [fmtBRL(v), name === "atual" ? "Mês atual" : "Mês anterior"]}
                />
                <Area type="monotone" dataKey="anterior" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradAnt)" dot={false} />
                <Area type="monotone" dataKey="atual"    stroke="#06b6d4" strokeWidth={2.5} fill="url(#gradAtual)" dot={{ r: 4, fill: "#06b6d4", strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* mini comparativo */}
          <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
            {[
              { l: "Receita mês",  cur: fatMes,    prev: fatAnt,    fmt: true },
              { l: "Agendamentos", cur: totalMes,   prev: totalAnt,  fmt: false },
              { l: "Cancelamentos",cur: cancelMes,  prev: cancelAnt, fmt: false },
            ].map(x => (
              <div key={x.l} className="text-center">
                <p className="text-[11px] text-slate-400 font-medium mb-0.5">{x.l}</p>
                <p className="text-sm font-bold text-slate-700">{x.fmt ? fmtBRL(x.cur) : x.cur}</p>
                <DeltaBadge cur={x.cur} prev={x.prev} />
              </div>
            ))}
          </div>
        </div>

        {/* Convênios */}
        <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold text-slate-800">Convênios do mês</h2>
            <p className="text-xs text-slate-400 mt-0.5">{mesApts.length} agendamentos no período</p>
          </div>
          {convData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">Nenhum dado</div>
          ) : (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={convData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [v, "atendimentos"]} contentStyle={{ fontSize: 12, borderRadius: 10 }} />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]} maxBarSize={20}>
                    {convData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
            {convData.slice(0, 3).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Circle className="h-2 w-2" fill={COLORS[i]} stroke="none" />
                  <span className="text-slate-600 truncate max-w-[120px]">{c.name}</span>
                </div>
                <span className="font-semibold text-slate-700">{pct(c.total, mesApts.length)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 3: OCUPAÇÃO + ALERTAS + ANIVERSÁRIOS ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Taxa de ocupação por profissional */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-cyan-600" /> Ocupação hoje
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Slots utilizados por profissional</p>
            </div>
            <Link to="/agenda" className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
              Agenda <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {ocupacao.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
              <Stethoscope className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhum profissional ativo</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ocupacao.map(p => (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: p.color }}>
                        {p.nome.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{p.nome}</p>
                        <p className="text-[10px] text-slate-400 truncate">{p.esp}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-bold text-slate-700">{p.taxaPct}%</p>
                      <p className="text-[10px] text-slate-400">{p.realizados}/{p.slotsTotal}</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${p.taxaPct}%`, background: p.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {ocupacao.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1"><Percent className="h-3 w-3" />Média: {Math.round(ocupacao.reduce((s, p) => s + p.taxaPct, 0) / ocupacao.length)}%</span>
              <span>{ocupacao.reduce((s, p) => s + p.realizados, 0)} atend. hoje</span>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-amber-500" /> Alertas
            </h2>
            {totalAlertas > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {totalAlertas}
              </span>
            )}
          </div>

          {/* Sem confirmação */}
          {semConfirmacao.length > 0 && (
            <div className="mb-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" /> Aguardando confirmação
              </p>
              <div className="space-y-2">
                {semConfirmacao.map((a: any) => {
                  const prof = profs.find(p => p.id === a.professionalId);
                  const dt = new Date(a.date + "T12:00:00");
                  const isAmanha = dt.toISOString().split("T")[0] === new Date(Date.now() + 86400000).toISOString().split("T")[0];
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-amber-200 flex items-center justify-center text-[11px] font-bold text-amber-800 shrink-0">
                        {(a.patientName || "P")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{a.patientName}</p>
                        <p className="text-[10px] text-slate-400">{prof?.name ?? "—"} · {a.start}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[10px] font-bold ${isAmanha ? "text-orange-600" : "text-amber-600"}`}>
                          {isAmanha ? "Amanhã" : dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pendentes pagamento */}
          {pendPagamento.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-red-500" /> Pagamentos pendentes
              </p>
              <div className="space-y-2">
                {pendPagamento.map((a: any) => {
                  const v = Number(a.procedureValue || a.amount || 0);
                  return (
                    <div key={a.id} className="flex items-center gap-2.5 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
                      <div className="w-7 h-7 rounded-full bg-red-200 flex items-center justify-center text-[11px] font-bold text-red-800 shrink-0">
                        {(a.patientName || "P")[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{a.patientName}</p>
                        <p className="text-[10px] text-slate-400">{new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className="text-xs font-bold text-red-600 shrink-0">{v > 0 ? fmtBRL(v) : "—"}</p>
                    </div>
                  );
                })}
              </div>
              {totalPendente > 0 && (
                <div className="mt-2 flex justify-between items-center text-xs pt-2 border-t border-slate-100">
                  <span className="text-slate-400">Total em aberto</span>
                  <span className="font-bold text-red-600">{fmtBRL(totalPendente)}</span>
                </div>
              )}
            </div>
          )}

          {totalAlertas === 0 && (
            <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
              <CheckCircle2 className="h-10 w-10 opacity-20 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-600">Tudo em dia!</p>
              <p className="text-xs text-slate-400">Nenhuma pendência no momento</p>
            </div>
          )}
        </div>

        {/* Aniversariantes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" /> Aniversariantes
            </h2>
            <span className="text-xs text-slate-400">Próximos 7 dias</span>
          </div>
          {aniversariantes.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-slate-400 gap-2">
              <Cake className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhum aniversariante</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aniversariantes.map((p: any) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                  p.isHoje
                    ? "bg-pink-50 border-pink-200 ring-1 ring-pink-300"
                    : "bg-slate-50 border-slate-100"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    p.isHoje ? "bg-pink-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}>
                    {p.isHoje ? "🎂" : p.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.idade} anos · {p.phone || "sem telefone"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {p.isHoje
                      ? <span className="text-[10px] font-bold text-pink-600 bg-pink-100 px-1.5 py-0.5 rounded-full">Hoje! 🎉</span>
                      : <span className="text-[10px] text-slate-400">dia {p.dayNum}</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          {aniversariantes.length > 0 && (
            <Link to="/pacientes" className="mt-3 flex items-center justify-center gap-1 text-xs text-cyan-600 hover:underline pt-3 border-t border-slate-100">
              Ver todos os pacientes <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* ── ROW 4: PRÓXIMOS AGENDAMENTOS + STATUS DO DIA ────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Próximos agendamentos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800">Próximos agendamentos</h2>
              <p className="text-xs text-slate-400 mt-0.5">A partir de agora</p>
            </div>
            <Link to="/agenda" className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:underline">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {proxApts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <Calendar className="h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">Nenhum agendamento pendente</p>
              <Link to="/agenda" className="text-xs font-semibold text-cyan-600 hover:underline">Criar agendamento</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {proxApts.map((a: any) => {
                const prof = profs.find(p => p.id === a.professionalId);
                const isToday = (a.date || "").startsWith(todayStr);
                const statusStyle = STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-500";
                return (
                  <div key={a.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:bg-slate-50 transition">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: prof?.color || "#06b6d4" }}
                    >
                      {(a.patientName || "P")[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{a.patientName}</p>
                      <p className="text-xs text-slate-400 truncate">{prof?.name ?? "—"} · {a.procedure || "Consulta"}</p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <p className="text-sm font-bold text-slate-700">{a.start || "--:--"}</p>
                      <p className={`text-[10px] ${isToday ? "text-cyan-600 font-semibold" : "text-slate-400"}`}>
                        {isToday ? "Hoje" : new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle} ml-1`}>
                      {a.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status do dia + atalhos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800">Status de hoje</h2>
              <p className="text-xs text-slate-400 mt-0.5">{todayApts.length} agendamento(s)</p>
            </div>
            <Users className="h-5 w-5 text-slate-300" />
          </div>

          {statusDia.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center flex-1 justify-center">
              <CheckCircle2 className="h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-400">Nenhum atendimento hoje</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {statusDia.map((s: any) => {
                const p = pct(s.total, todayApts.length);
                const barColor: Record<string, string> = {
                  finalizado: "bg-emerald-500", aguardando: "bg-amber-400",
                  confirmado: "bg-cyan-500",    agendado: "bg-blue-400",
                  cancelado:  "bg-red-400",     faltou: "bg-slate-300",
                  em_atendimento: "bg-violet-500",
                };
                return (
                  <div key={s.name}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="font-medium text-slate-700 capitalize">{s.name.replace("_", " ")}</span>
                      <span className="text-slate-500 text-xs">{s.total} <span className="text-slate-400">({p}%)</span></span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${barColor[s.name] ?? "bg-slate-300"}`} style={{ width: `${p}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Atalhos */}
          <div className="mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
            {[
              { to: "/pacientes",  icon: Users,       label: "Pacientes" },
              { to: "/financeiro", icon: DollarSign,  label: "Financeiro" },
              { to: "/relatorios", icon: TrendingUp,  label: "Relatórios" },
            ].map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-xl p-3 hover:bg-slate-50 transition text-slate-500 hover:text-cyan-600">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
