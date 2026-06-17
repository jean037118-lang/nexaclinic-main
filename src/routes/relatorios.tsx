import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Calendar, DollarSign, TrendingUp, TrendingDown,
  FileDown, FileSpreadsheet, Activity, CheckCircle2, XCircle,
  BarChart3, Stethoscope, ArrowUpRight, ArrowDownRight,
  Minus, AlertTriangle, Filter, X, ChevronDown, Users,
  Target, Zap, Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { drawPdfHeader } from "@/lib/pdfHeader";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Apt {
  id: string; date: string; patientName: string; professionalId: string;
  status: string; insurance: string; procedure?: string;
  procedureValue?: number; amount?: number; paid?: boolean; paymentMethod?: string;
}
interface Prof { id: string; name: string; specialty: string; repasseValue?: number; commissionPercent?: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const R = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number, d: number) => (!d ? 0 : Math.round((n / d) * 100));
const val = (a: Apt) => Number(a.amount || a.procedureValue || 0);

type Periodo = "mes_atual"|"mes_anterior"|"trimestre"|"semestre"|"ano"|"personalizado";
function intervalo(p: Periodo, di?: string, df?: string) {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  switch (p) {
    case "mes_atual":    return { ini: new Date(y,m,1),     fim: new Date(y,m+1,0,23,59,59) };
    case "mes_anterior": return { ini: new Date(y,m-1,1),   fim: new Date(y,m,0,23,59,59) };
    case "trimestre":    return { ini: new Date(y,m-2,1),   fim: new Date(y,m+1,0,23,59,59) };
    case "semestre":     return { ini: new Date(y,m-5,1),   fim: new Date(y,m+1,0,23,59,59) };
    case "ano":          return { ini: new Date(y,0,1),     fim: new Date(y,11,31,23,59,59) };
    default:             return {
      ini: di ? new Date(di+"T00:00:00") : new Date(y,m,1),
      fim: df ? new Date(df+"T23:59:59") : new Date(y,m+1,0,23,59,59),
    };
  }
}

// ─── Micro‑components ─────────────────────────────────────────────────────────
function Bar({ v, max, color="bg-cyan-500" }: { v:number; max:number; color?:string }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width:`${max>0?Math.min(100,Math.round(v/max*100)):0}%` }} />
    </div>
  );
}

function Delta({ cur, prev }: { cur:number; prev:number }) {
  if (!prev) return <span className="text-xs text-slate-400">—</span>;
  const d = ((cur-prev)/prev)*100;
  const Icon = d===0?Minus:d>0?ArrowUpRight:ArrowDownRight;
  return <span className={`flex items-center gap-0.5 text-xs font-semibold ${d===0?"text-slate-400":d>0?"text-emerald-600":"text-red-500"}`}><Icon className="w-3 h-3"/>{Math.abs(d).toFixed(1)}%</span>;
}

const S_COR: Record<string,string> = {
  finalizado:"bg-emerald-100 text-emerald-700",confirmado:"bg-cyan-100 text-cyan-700",
  aguardando:"bg-amber-100 text-amber-700",agendado:"bg-blue-100 text-blue-700",
  em_atendimento:"bg-purple-100 text-purple-700",cancelado:"bg-red-100 text-red-700",faltou:"bg-slate-100 text-slate-600",
};
function SBadge({ s }: { s:string }) {
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${S_COR[s]??"bg-slate-100 text-slate-600"}`}>{s}</span>;
}

function MultiSel({ label, opts, sel, onChange }: { label:string; opts:{v:string;l:string}[]; sel:string[]; onChange:(v:string[])=>void }) {
  const [open,setOpen] = useState(false);
  const tog = (v:string) => onChange(sel.includes(v)?sel.filter(x=>x!==v):[...sel,v]);
  const lbl = sel.length===0?`Todos (${opts.length})`:sel.length===1?(opts.find(o=>o.v===sel[0])?.l??sel[0]):`${sel.length} selecionados`;
  return (
    <div className="relative">
      <button onClick={()=>setOpen(!open)} className="flex items-center gap-2 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:border-cyan-400 text-sm text-slate-700 transition min-w-[170px] justify-between shadow-sm">
        <span className="truncate">{lbl}</span>
        <div className="flex items-center gap-1 shrink-0">
          {sel.length>0&&<span onClick={e=>{e.stopPropagation();onChange([]);}} className="hover:text-red-500"><X className="w-3.5 h-3.5"/></span>}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open?"rotate-180":""}`}/>
        </div>
      </button>
      {open&&(
        <div className="absolute top-full mt-1 left-0 z-50 w-60 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100"><p className="text-xs text-slate-400 font-medium px-1">{label}</p></div>
          <div className="max-h-48 overflow-y-auto p-1">
            {opts.map(o=>(
              <button key={o.v} onClick={()=>tog(o.v)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-left ${sel.includes(o.v)?"bg-cyan-50 text-cyan-700":"text-slate-600 hover:bg-slate-50"}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel.includes(o.v)?"border-cyan-500 bg-cyan-500":"border-slate-300"}`}>
                  {sel.includes(o.v)&&<Check className="w-3 h-3 text-white"/>}
                </span>{o.l}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-slate-100">
            <button onClick={()=>{onChange(opts.map(o=>o.v));setOpen(false);}} className="w-full text-xs text-center text-slate-400 hover:text-cyan-600 transition py-1">Selecionar todos</button>
          </div>
        </div>
      )}
    </div>
  );
}

// tiny Check icon inline
function Check({ className="" }) { return <svg className={className} viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>; }

// ═══════════════════════════════════════════════════════════════════════════
type Aba = "resumo"|"profissionais"|"convenios"|"financeiro"|"agenda"|"pendentes"|"ocupacao";

function RelatoriosPage() {
  const [periodo, setPeriodo]           = useState<Periodo>("mes_atual");
  const [di, setDi]                     = useState("");
  const [df, setDf]                     = useState("");
  const [profSel, setProfSel]           = useState<string[]>([]);
  const [convSel, setConvSel]           = useState<string[]>([]);
  const [stSel, setStSel]               = useState<string[]>([]);
  const [aba, setAba]                   = useState<Aba>("resumo");
  const [filtOpen, setFiltOpen]         = useState(false);

  const allApts: Apt[] = useMemo(()=>{ try{ return JSON.parse(localStorage.getItem("nexaclinic_appointments_v3")||"[]"); }catch{ return []; } },[]);
  const profs: Prof[]  = useMemo(()=>{ try{ return JSON.parse(localStorage.getItem("nexaclinic_professionals")||"[]"); }catch{ return []; } },[]);
  const pats           = useMemo(()=>{ try{ return JSON.parse(localStorage.getItem("nexaclinic_patients_v3")||"[]"); }catch{ return []; } },[]);
  const conveniosCad   = useMemo(()=>{ try{ return JSON.parse(localStorage.getItem("nexaclinic_convenios_v2")||"[]") as {name:string;faturar?:boolean}[]; }catch{ return []; } },[]);
  const conveniosFaturados = useMemo(()=>new Set(conveniosCad.filter(c=>c.faturar).map(c=>c.name)),[conveniosCad]);

  const profOpts = useMemo(()=>profs.map(p=>({v:p.id,l:p.name})),[profs]);
  const convOpts = useMemo(()=>{
    const s=new Set(allApts.map(a=>a.insurance||"Particular"));
    return Array.from(s).map(n=>({v:n,l:n}));
  },[allApts]);
  const stOpts = Object.entries(S_COR).map(([v])=>({v,l:v}));

  const {ini,fim} = useMemo(()=>intervalo(periodo,di,df),[periodo,di,df]);
  const dur = fim.getTime()-ini.getTime();
  const iniA = new Date(ini.getTime()-dur), fimA = new Date(ini.getTime()-1);
  const inR = (d:string,a:Date,b:Date)=>{ const x=new Date(d); return x>=a&&x<=b; };

  const apts = useMemo(()=>allApts.filter(a=>{
    if(!inR(a.date,ini,fim)) return false;
    if(profSel.length>0&&!profSel.includes(a.professionalId)) return false;
    if(convSel.length>0&&!convSel.includes(a.insurance||"Particular")) return false;
    if(stSel.length>0&&!stSel.includes(a.status)) return false;
    return true;
  }),[allApts,ini,fim,profSel,convSel,stSel]);

  const aptsAnt = useMemo(()=>allApts.filter(a=>inR(a.date,iniA,fimA)),[allApts,iniA,fimA]);

  const total  = apts.length;
  const fin    = apts.filter(a=>a.status==="finalizado").length;
  const conf   = apts.filter(a=>a.status==="confirmado").length;
  const canc   = apts.filter(a=>a.status==="cancelado").length;
  const agu    = apts.filter(a=>["aguardando","agendado"].includes(a.status)).length;
  const falt   = apts.filter(a=>a.status==="faltou").length;
  const txFin  = pct(fin,total);
  const txCanc = pct(canc,total);

  const recBruta  = apts.reduce((s,a)=>a.status==="finalizado"&&a.paid?s+val(a):s,0);
  const recAnt    = aptsAnt.reduce((s,a)=>a.status==="finalizado"&&a.paid?s+val(a):s,0);
  const recPrev   = apts.reduce((s,a)=>!["cancelado","faltou"].includes(a.status)?s+Number(a.procedureValue||0):s,0);
  const repTotal  = apts.reduce((s,a)=>{
    if(a.status==="finalizado"&&a.paid){const p=profs.find(p=>p.id===a.professionalId);const r=Number(p?.repasseValue||p?.commissionPercent||0);return s+(val(a)*r)/100;}return s;
  },0);
  const lucro = recBruta-repTotal;
  const ticket = fin>0?recBruta/fin:0;

  const porProf = useMemo(()=>{
    const list = profSel.length>0?profs.filter(p=>profSel.includes(p.id)):profs;
    return list.map(p=>{
      const pa=apts.filter(a=>a.professionalId===p.id);
      const pf=pa.filter(a=>a.status==="finalizado");
      const rc=pf.filter(a=>a.paid).reduce((s,a)=>s+val(a),0);
      const rp=Number(p.repasseValue||p.commissionPercent||0);
      return { id:p.id, nome:p.name, esp:p.specialty, total:pa.length, fin:pf.length, canc:pa.filter(a=>a.status==="cancelado").length, txFin:pct(pf.length,pa.length), rec:rc, rp, rep:(rc*rp)/100, lucro:rc-(rc*rp)/100 };
    }).sort((a,b)=>b.rec-a.rec);
  },[profs,apts,profSel]);

  const porConv = useMemo(()=>{
    const m=new Map<string,{total:number;fin:number;rec:number}>();
    apts.forEach(a=>{ const n=a.insurance||"Particular"; const c=m.get(n)||{total:0,fin:0,rec:0}; c.total++; if(a.status==="finalizado"){c.fin++;if(a.paid)c.rec+=val(a);} m.set(n,c); });
    return Array.from(m.entries()).map(([n,v])=>({n,...v})).sort((a,b)=>b.total-a.total);
  },[apts]);

  const semPag = apts.filter(a=>!a.paid&&a.status!=="cancelado"&&a.status!=="faltou"&&!conveniosFaturados.has(a.insurance||"Particular")).sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());

  const fluxo8 = useMemo(()=>{
    const r=[];const now=new Date();
    for(let i=7;i>=0;i--){
      const a=new Date(now);a.setDate(now.getDate()-(i+1)*7);
      const b=new Date(now);b.setDate(now.getDate()-i*7);
      const w=allApts.filter(x=>{ const d=new Date(x.date);return d>=a&&d<b; });
      r.push({l:`${a.getDate()}/${a.getMonth()+1}`,rec:w.reduce((s,x)=>x.status==="finalizado"&&x.paid?s+val(x):s,0),n:w.length});
    }
    return r;
  },[allApts]);
  const maxRec=Math.max(...fluxo8.map(w=>w.rec),1);
  const maxN=Math.max(...fluxo8.map(w=>w.n),1);

  const porDia = useMemo(()=>{
    const c=[0,0,0,0,0,0,0];
    apts.forEach(a=>{if(a.date)c[new Date(a.date).getDay()]++;});
    return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d,i)=>({d,v:c[i]}));
  },[apts]);
  const maxDia=Math.max(...porDia.map(d=>d.v),1);

  const filtAtivos=profSel.length+convSel.length+stSel.length;
  const periodoStr=`${ini.toLocaleDateString("pt-BR")} a ${fim.toLocaleDateString("pt-BR")}`;

  // ── PDF PROFISSIONAL ──────────────────────────────────────────────────
  async function exportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const azul:   [number,number,number] = [8,145,178];
    const escuro: [number,number,number] = [15,23,42];
    const cinza:  [number,number,number] = [71,85,105];

    // ── Cabeçalho com logo da empresa ─────────────────────────────────
    let yStart = await drawPdfHeader(doc, "RELATÓRIO GERENCIAL", `Período: ${periodoStr}`);
    yStart += 6;

    // ── Seção: KPIs ───────────────────────────────────────────────────
    doc.setTextColor(...escuro); doc.setFontSize(11); doc.setFont("helvetica","bold");
    doc.text("Indicadores Gerais",14, yStart);
    doc.setDrawColor(...azul); doc.setLineWidth(0.8); doc.line(14, yStart+2, 60, yStart+2);

    // 4 cards lado a lado
    const cards = [
      { l:"Total Agendamentos", v:String(total),   cor: azul },
      { l:"Finalizados",        v:String(fin),      cor: [16,185,129] as [number,number,number] },
      { l:"Receita Bruta",      v:R(recBruta),      cor: [16,185,129] as [number,number,number] },
      { l:"Lucro Líquido",      v:R(lucro),         cor: lucro>=0?[15,118,110] as [number,number,number]:[239,68,68] as [number,number,number] },
    ];
    const cardsY = yStart + 6;
    cards.forEach((c,i)=>{
      const x=14+i*47, y=cardsY;
      doc.setFillColor(248,250,252); doc.roundedRect(x,y,44,22,2,2,"F");
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.roundedRect(x,y,44,22,2,2,"S");
      doc.setFillColor(...c.cor); doc.roundedRect(x,y,3,22,1,1,"F");
      doc.setTextColor(...cinza); doc.setFontSize(7); doc.setFont("helvetica","normal");
      doc.text(c.l,x+6,y+8);
      doc.setTextColor(...escuro); doc.setFontSize(11); doc.setFont("helvetica","bold");
      doc.text(c.v,x+6,y+17);
    });

    // ── Grid de métricas ──────────────────────────────────────────────
    autoTable(doc, {
      startY: cardsY + 26,
      head: [["Indicador","Valor","Indicador","Valor"]],
      body: [
        ["Cancelados", canc,                     "Faltou",            falt],
        ["Taxa Finalização",`${txFin}%`,         "Taxa Cancelamento", `${txCanc}%`],
        ["Pacientes cadastrados", pats.length,   "Ticket Médio",      R(ticket)],
        ["Total Repasses",R(repTotal),           "Previsão Receita",  R(recPrev)],
      ],
      headStyles:{ fillColor:escuro, textColor:[148,163,184], fontStyle:"bold", fontSize:8 },
      bodyStyles:{ fontSize:9, textColor:escuro },
      alternateRowStyles:{ fillColor:[248,250,252] },
      columnStyles:{ 0:{fontStyle:"bold",textColor:cinza}, 2:{fontStyle:"bold",textColor:cinza} },
      styles:{ cellPadding:3 },
      margin:{ left:14, right:14 },
    });

    // ── Seção: Profissionais ──────────────────────────────────────────
    if(porProf.length>0){
      const y = (doc as any).lastAutoTable.finalY+12;
      doc.setTextColor(...escuro); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("Desempenho por Profissional",14,y);
      doc.setDrawColor(...azul); doc.setLineWidth(0.8); doc.line(14,y+2,78,y+2);
      autoTable(doc,{
        startY: y+6,
        head:[["Profissional","Especialidade","Agendam.","Finaliz.","Cancela.","Taxa Fin.","Receita","Repasse","Lucro"]],
        body: porProf.map(p=>[p.nome,p.esp,p.total,p.fin,p.canc,`${p.txFin}%`,R(p.rec),R(p.rep),R(p.lucro)]),
        foot:[["TOTAL","",porProf.reduce((s,p)=>s+p.total,0),porProf.reduce((s,p)=>s+p.fin,0),porProf.reduce((s,p)=>s+p.canc,0),"",R(porProf.reduce((s,p)=>s+p.rec,0)),R(porProf.reduce((s,p)=>s+p.rep,0)),R(porProf.reduce((s,p)=>s+p.lucro,0))]],
        headStyles:{ fillColor:escuro, textColor:[148,163,184], fontStyle:"bold", fontSize:7 },
        bodyStyles:{ fontSize:8, textColor:escuro },
        footStyles:{ fillColor:[241,245,249], textColor:escuro, fontStyle:"bold", fontSize:8 },
        alternateRowStyles:{ fillColor:[248,250,252] },
        columnStyles:{ 6:{halign:"right",textColor:[21,128,61]}, 7:{halign:"right",textColor:[124,58,237]}, 8:{halign:"right",fontStyle:"bold"} },
        styles:{ cellPadding:2.5 },
        margin:{ left:14,right:14 },
      });
    }

    // ── Seção: Convênios ──────────────────────────────────────────────
    if(porConv.length>0){
      const y = (doc as any).lastAutoTable.finalY+12;
      // nova página se necessário
      if(y>240){ doc.addPage(); }
      const yy = y>240?20:y;
      doc.setTextColor(...escuro); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("Distribuição por Convênio",14,yy);
      doc.setDrawColor(...azul); doc.line(14,yy+2,68,yy+2);
      autoTable(doc,{
        startY: yy+6,
        head:[["Convênio","Total","Finalizados","Taxa Fin.","Receita"]],
        body: porConv.map(c=>[c.n,c.total,c.fin,`${pct(c.fin,c.total)}%`,R(c.rec)]),
        headStyles:{ fillColor:[88,28,135], textColor:255, fontStyle:"bold", fontSize:8 },
        bodyStyles:{ fontSize:9, textColor:escuro },
        alternateRowStyles:{ fillColor:[253,244,255] },
        columnStyles:{ 4:{halign:"right",textColor:[21,128,61]} },
        styles:{ cellPadding:3 },
        margin:{ left:14,right:14 },
      });
    }

    // ── Seção: Agenda detalhada ───────────────────────────────────────
    if(apts.length>0){
      doc.addPage();
      doc.setFillColor(...escuro); doc.rect(0,0,W,18,"F");
      doc.setFillColor(...azul); doc.rect(0,16,W,2,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(12); doc.setFont("helvetica","bold");
      doc.text("Agenda Detalhada",14,12);
      doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text(`${apts.length} registro(s) · ${periodoStr}`,14,16);

      autoTable(doc,{
        startY:24,
        head:[["Data","Paciente","Profissional","Convênio","Status","Valor","Pago"]],
        body: apts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(a=>{
          const p=profs.find(p=>p.id===a.professionalId);
          return [new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR"),a.patientName,p?.name??"—",a.insurance??"Particular",a.status,val(a)>0?R(val(a)):"—",a.paid?"✓ Pago":"Pendente"];
        }),
        headStyles:{ fillColor:escuro, textColor:[148,163,184], fontStyle:"bold", fontSize:7 },
        bodyStyles:{ fontSize:7.5, textColor:escuro },
        alternateRowStyles:{ fillColor:[248,250,252] },
        columnStyles:{
          5:{halign:"right"},
          6:{halign:"center",fontStyle:"bold",
             textColor:[21,128,61]},
        },
        didParseCell(data){
          if(data.section==="body"&&data.column.index===6&&data.cell.raw==="Pendente"){
            data.cell.styles.textColor=[239,68,68];
          }
          if(data.section==="body"&&data.column.index===4){
            const s=String(data.cell.raw);
            if(s==="finalizado")data.cell.styles.textColor=[21,128,61];
            else if(s==="cancelado")data.cell.styles.textColor=[239,68,68];
            else if(s==="aguardando")data.cell.styles.textColor=[180,83,9];
          }
        },
        styles:{ cellPadding:2.5 },
        margin:{left:14,right:14},
      });
    }

    // ── Rodapé em cada página ─────────────────────────────────────────
    const total_pages = doc.getNumberOfPages();
    for(let i=1;i<=total_pages;i++){
      doc.setPage(i);
      doc.setFillColor(248,250,252); doc.rect(0,285,W,12,"F");
      doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(0,285,W,285);
      doc.setTextColor(...cinza); doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text("NexaClinic — Relatório Confidencial",14,292);
      doc.text(`Página ${i} de ${total_pages}`,W-30,292);
    }

    doc.save(`nexaclinic-relatorio-${new Date().toISOString().slice(0,10)}.pdf`);
  }

  function exportExcel() {
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ["NexaClinic — Relatório Gerencial","","Período:",periodoStr],[],
      ["INDICADOR","VALOR"],["Total Agendamentos",total],["Finalizados",fin],["Cancelados",canc],
      ["Faltou",falt],["Taxa Finalização (%)",txFin],["Taxa Cancelamento (%)",txCanc],
      ["Pacientes",pats.length],["Ticket Médio (R$)",ticket],[],
      ["FINANCEIRO",""],["Receita Bruta (R$)",recBruta],["Total Repasses (R$)",repTotal],["Lucro Líquido (R$)",lucro],
    ]),"Resumo");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ["Profissional","Especialidade","Agendamentos","Finalizados","Cancelados","Taxa Fin. %","Receita","Repasse","Lucro"],
      ...porProf.map(p=>[p.nome,p.esp,p.total,p.fin,p.canc,p.txFin,p.rec,p.rep,p.lucro]),
    ]),"Profissionais");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ["Convênio","Total","Finalizados","Taxa Fin. %","Receita"],
      ...porConv.map(c=>[c.n,c.total,c.fin,pct(c.fin,c.total),c.rec]),
    ]),"Convênios");
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
      ["Data","Paciente","Profissional","Status","Convênio","Valor (R$)","Pago"],
      ...apts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(a=>{ const p=profs.find(p=>p.id===a.professionalId); return [new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR"),a.patientName,p?.name??"—",a.status,a.insurance??"Particular",val(a),a.paid?"Sim":"Não"]; }),
    ]),"Agenda");
    XLSX.writeFile(wb,`nexaclinic-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const abas: {id:Aba;l:string;icon:React.ElementType;cnt?:number}[] = [
    {id:"resumo",        l:"Resumo",       icon:BarChart3},
    {id:"profissionais", l:"Profissionais", icon:Stethoscope, cnt:porProf.length},
    {id:"convenios",     l:"Convênios",     icon:Activity,    cnt:porConv.length},
    {id:"financeiro",    l:"Financeiro",    icon:TrendingUp},
    {id:"agenda",        l:"Agenda",        icon:Calendar,    cnt:apts.length},
    {id:"pendentes",     l:"Pendentes",     icon:AlertTriangle, cnt:semPag.length},
    {id:"ocupacao",      l:"Ocupação",      icon:Target},
  ];

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Relatórios</h1>
          <p className="text-slate-500 text-sm mt-1">
            {periodoStr}
            {filtAtivos>0&&<span className="ml-2 text-cyan-600 font-medium">· {filtAtivos} filtro(s) ativo(s)</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition shadow-sm">
            <FileDown className="w-4 h-4"/> Exportar PDF
          </button>
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition shadow-sm">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600"/> Excel
          </button>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Período</p>
            <div className="flex gap-1 flex-wrap">
              {([["mes_atual","Mês atual"],["mes_anterior","Mês anterior"],["trimestre","3 meses"],["semestre","6 meses"],["ano","Ano"],["personalizado","Personalizado"]] as [Periodo,string][]).map(([v,l])=>(
                <button key={v} onClick={()=>setPeriodo(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${periodo===v?"bg-cyan-600 text-white border-cyan-600 shadow-sm":"border-slate-200 text-slate-500 hover:border-cyan-300 hover:text-cyan-700 bg-white"}`}>{l}</button>
              ))}
            </div>
          </div>
          {periodo==="personalizado"&&(
            <div className="flex gap-2 items-end">
              <div><p className="text-xs text-slate-500 mb-1.5 font-semibold">De</p><input type="date" value={di} onChange={e=>setDi(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"/></div>
              <div><p className="text-xs text-slate-500 mb-1.5 font-semibold">Até</p><input type="date" value={df} onChange={e=>setDf(e.target.value)} className="h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"/></div>
            </div>
          )}
          <button onClick={()=>setFiltOpen(!filtOpen)} className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition ml-auto ${filtAtivos>0?"border-cyan-400 bg-cyan-50 text-cyan-700":"border-slate-200 bg-white text-slate-500 hover:border-slate-300"}`}>
            <Filter className="w-3.5 h-3.5"/>Filtros avançados
            {filtAtivos>0&&<span className="w-5 h-5 rounded-full bg-cyan-600 text-white text-xs flex items-center justify-center">{filtAtivos}</span>}
          </button>
        </div>
        {filtOpen&&(
          <div className="flex flex-wrap gap-4 pt-3 border-t border-slate-100">
            <div><p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Profissional</p><MultiSel label="Profissionais" opts={profOpts} sel={profSel} onChange={setProfSel}/></div>
            <div><p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Convênio</p><MultiSel label="Convênios" opts={convOpts} sel={convSel} onChange={setConvSel}/></div>
            <div><p className="text-xs text-slate-500 mb-1.5 font-semibold uppercase tracking-wide">Status</p><MultiSel label="Status" opts={stOpts} sel={stSel} onChange={setStSel}/></div>
            {filtAtivos>0&&<div className="flex items-end"><button onClick={()=>{setProfSel([]);setConvSel([]);setStSel([]);}} className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm hover:bg-red-100 transition"><X className="w-3.5 h-3.5"/>Limpar</button></div>}
          </div>
        )}
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { l:"Agendamentos",   v:total,       prev:aptsAnt.length,  prevN:total,  icon:Calendar,     grad:"from-cyan-500 to-cyan-600",
            sub:<div className="grid grid-cols-3 gap-1 mt-3 text-center">
              {[{l:"Finaliz.",v:fin,c:"text-emerald-600 bg-emerald-50"},{l:"Aguard.",v:agu,c:"text-amber-600 bg-amber-50"},{l:"Cancel.",v:canc,c:"text-red-600 bg-red-50"}].map(x=>(
                <div key={x.l} className={`rounded-lg py-1.5 ${x.c.split(" ")[1]}`}><p className={`text-sm font-bold ${x.c.split(" ")[0]}`}>{x.v}</p><p className="text-[10px] text-slate-500">{x.l}</p></div>
              ))}</div> },
          { l:"Receita Bruta",  v:R(recBruta), prev:recAnt,          prevN:recBruta, icon:DollarSign,  grad:"from-emerald-500 to-green-500",
            sub:<div className="mt-3 space-y-1.5"><div className="flex justify-between text-xs"><span className="text-slate-500">Previsão</span><span className="text-slate-600 font-medium">{R(recPrev)}</span></div><Bar v={recBruta} max={recPrev} color="bg-emerald-500"/><p className="text-xs text-slate-400">{pct(recBruta,recPrev)}% realizado</p></div> },
          { l:"Total Repasses", v:R(repTotal), prevN:repTotal,       icon:TrendingDown, grad:"from-violet-500 to-purple-600",
            sub:<div className="mt-3 space-y-1.5"><div className="flex justify-between text-xs"><span className="text-slate-500">{pct(repTotal,recBruta)}% da receita</span></div><Bar v={repTotal} max={recBruta} color="bg-violet-500"/></div> },
          { l:"Lucro Líquido",  v:R(lucro),    prevN:lucro,          icon:TrendingUp,   grad:lucro>=0?"from-teal-500 to-cyan-600":"from-red-500 to-red-600",
            sub:<div className="grid grid-cols-2 gap-1 mt-3"><div className="bg-slate-50 rounded-lg py-1.5 text-center"><p className="text-sm font-bold text-slate-700">{txFin}%</p><p className="text-[10px] text-slate-500">Finalização</p></div><div className="bg-slate-50 rounded-lg py-1.5 text-center"><p className="text-sm font-bold text-slate-700">{txCanc}%</p><p className="text-[10px] text-slate-500">Cancelamento</p></div></div> },
        ] as any[]).map(c=>(
          <div key={c.l} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{c.l}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{c.v}</p>
                {"prev" in c?<Delta cur={c.prevN} prev={c.prev}/>:null}
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.grad} flex items-center justify-center shadow-sm`}>
                <c.icon className="w-5 h-5 text-white"/>
              </div>
            </div>
            {c.sub}
          </div>
        ))}
      </div>

      {/* ── Abas ────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {abas.map(a=>{
          const Icon=a.icon; const active=aba===a.id;
          const alert=a.id==="pendentes"&&(a.cnt??0)>0;
          return (
            <button key={a.id} onClick={()=>setAba(a.id)} className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition ${active?"bg-white text-cyan-700 shadow-sm":"text-slate-500 hover:text-slate-700"}`}>
              <Icon className="w-3.5 h-3.5"/>{a.l}
              {a.cnt!==undefined&&<span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${active?"bg-cyan-100 text-cyan-700":alert?"bg-orange-100 text-orange-600":"bg-slate-200 text-slate-500"}`}>{a.cnt}</span>}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* RESUMO                                                        */}
      {aba==="resumo"&&(
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-cyan-600"/>Status dos Agendamentos</p>
            <div className="space-y-3">
              {[{l:"Finalizados",v:fin,c:"bg-emerald-500",t:"text-emerald-700"},{l:"Confirmados",v:conf,c:"bg-cyan-500",t:"text-cyan-700"},{l:"Aguardando",v:agu,c:"bg-amber-400",t:"text-amber-700"},{l:"Cancelados",v:canc,c:"bg-red-400",t:"text-red-700"},{l:"Faltou",v:falt,c:"bg-slate-400",t:"text-slate-600"}].map(s=>(
                <div key={s.l}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{s.l}</span>
                    <span className={`font-bold ${s.t}`}>{s.v} <span className="text-slate-400 font-normal text-xs">({pct(s.v,total)}%)</span></span>
                  </div>
                  <Bar v={s.v} max={total} color={s.c}/>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-600"/>Por Dia da Semana</p>
            <div className="space-y-3">
              {porDia.filter((_,i)=>i>=1&&i<=5).map(d=>(
                <div key={d.d}>
                  <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{d.d}</span><span className="font-bold text-slate-800">{d.v}</span></div>
                  <Bar v={d.v} max={maxDia} color="bg-cyan-500"/>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500"/>Resumo Financeiro</p>
            {[{l:"Receita Bruta",v:R(recBruta),c:"text-emerald-700"},{l:"Total Repasses",v:R(repTotal),c:"text-violet-700"},{l:"Lucro Líquido",v:R(lucro),c:lucro>=0?"text-teal-700":"text-red-600"},{l:"Previsão Receita",v:R(recPrev),c:"text-cyan-700"},{l:"Ticket Médio",v:R(ticket),c:"text-amber-700"}].map(f=>(
              <div key={f.l} className="flex justify-between py-2.5 border-b border-slate-50 last:border-0 text-sm">
                <span className="text-slate-500">{f.l}</span><span className={`font-bold ${f.c}`}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFISSIONAIS */}
      {aba==="profissionais"&&(
        <div className="space-y-4">
          {porProf.length===0?(
            <div className="rounded-2xl border border-dashed border-slate-200 p-16 text-center text-slate-400 bg-white"><Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nenhum dado no período</p></div>
          ):(
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {porProf.map((p,i)=>(
                  <div key={p.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5 hover:shadow-md transition">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${i===0?"bg-gradient-to-br from-amber-400 to-orange-500 text-white":"bg-cyan-50 text-cyan-700 border border-cyan-200"}`}>{p.nome.charAt(0)}</div>
                      <div><p className="font-semibold text-slate-800 text-sm">{p.nome}</p><p className="text-xs text-slate-400">{p.esp}</p></div>
                      {i===0&&<span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold border border-amber-200">★ Top</span>}
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {[{l:"Agendamentos",v:p.total},{l:"Finalizados",v:p.fin,c:"text-emerald-600"},{l:"Cancelados",v:p.canc,c:"text-red-500"},{l:"Taxa Finaliz.",v:`${p.txFin}%`,c:"text-cyan-600"}].map(x=>(
                        <div key={x.l} className="flex justify-between"><span className="text-slate-500">{x.l}</span><span className={`font-medium ${x.c??"text-slate-700"}`}>{x.v}</span></div>
                      ))}
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Receita</span><span className="font-bold text-emerald-700">{R(p.rec)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Repasse ({p.rp}%)</span><span className="text-violet-700">{R(p.rep)}</span></div>
                      <div className="flex justify-between text-sm pt-1.5 border-t border-slate-100"><span className="text-slate-600 font-semibold">Lucro Clínica</span><span className="font-bold text-slate-800">{R(p.lucro)}</span></div>
                    </div>
                    <div className="mt-3"><Bar v={p.rec} max={Math.max(...porProf.map(x=>x.rec),1)} color="bg-cyan-500"/></div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100"><p className="text-sm font-bold text-slate-800">Tabela Comparativa</p></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>{["Profissional","Especialidade","Total","Finaliz.","Cancel.","Taxa Fin.","Rep. %","Receita","Repasse","Lucro"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {porProf.map((p,i)=>(
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">{i===0&&<span className="text-amber-500 mr-1">★</span>}{p.nome}</td>
                          <td className="px-4 py-3 text-slate-500">{p.esp}</td>
                          <td className="px-4 py-3 text-center">{p.total}</td>
                          <td className="px-4 py-3 text-center text-emerald-600 font-medium">{p.fin}</td>
                          <td className="px-4 py-3 text-center text-red-500">{p.canc}</td>
                          <td className="px-4 py-3 text-center text-cyan-600">{p.txFin}%</td>
                          <td className="px-4 py-3 text-center text-violet-600">{p.rp}%</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">{R(p.rec)}</td>
                          <td className="px-4 py-3 text-right text-violet-600">{R(p.rep)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">{R(p.lucro)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                        <td className="px-4 py-3 text-slate-700" colSpan={2}>TOTAL</td>
                        <td className="px-4 py-3 text-center">{porProf.reduce((s,p)=>s+p.total,0)}</td>
                        <td className="px-4 py-3 text-center text-emerald-700">{porProf.reduce((s,p)=>s+p.fin,0)}</td>
                        <td className="px-4 py-3 text-center text-red-500">{porProf.reduce((s,p)=>s+p.canc,0)}</td>
                        <td className="px-4 py-3 text-center">—</td><td className="px-4 py-3 text-center">—</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{R(porProf.reduce((s,p)=>s+p.rec,0))}</td>
                        <td className="px-4 py-3 text-right text-violet-600">{R(porProf.reduce((s,p)=>s+p.rep,0))}</td>
                        <td className="px-4 py-3 text-right text-slate-800">{R(porProf.reduce((s,p)=>s+p.lucro,0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CONVÊNIOS */}
      {aba==="convenios"&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {porConv.length===0?(
            <div className="col-span-3 rounded-2xl border border-dashed border-slate-200 p-16 text-center text-slate-400 bg-white"><Activity className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nenhum dado</p></div>
          ):porConv.map(c=>(
            <div key={c.n} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex justify-between items-start mb-3">
                <div><p className="font-bold text-slate-800">{c.n}</p><p className="text-xs text-slate-400">{pct(c.total,total)}% dos agendamentos</p></div>
                <span className="text-2xl font-black text-slate-700">{c.total}</span>
              </div>
              <Bar v={c.total} max={Math.max(...porConv.map(x=>x.total),1)} color="bg-violet-500"/>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Finalizados</span><span className="text-emerald-600 font-medium">{c.fin}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Taxa finaliz.</span><span className="text-cyan-600">{pct(c.fin,c.total)}%</span></div>
                <div className="flex justify-between pt-1.5 border-t border-slate-100"><span className="text-slate-600 font-medium">Receita</span><span className="font-bold text-emerald-700">{R(c.rec)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FINANCEIRO */}
      {aba==="financeiro"&&(
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-600"/>Receita Semanal — últimas 8 semanas</p>
            <p className="text-xs text-slate-400 mb-5">Independente do filtro de período</p>
            <div className="flex items-end gap-2 h-44">
              {fluxo8.map((w,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <p className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{R(w.rec)}</p>
                  <div style={{height:"100px"}} className="w-full flex items-end">
                    <div className="w-full bg-cyan-500 hover:bg-cyan-600 rounded-t-md transition-all" style={{height:`${maxRec>0?Math.max(4,(w.rec/maxRec)*100):4}px`}}/>
                  </div>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">{w.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-1 flex items-center gap-2"><Calendar className="w-4 h-4 text-cyan-600"/>Volume de Agendamentos — últimas 8 semanas</p>
            <p className="text-xs text-slate-400 mb-5">Total de consultas por semana</p>
            <div className="flex items-end gap-2 h-44">
              {fluxo8.map((w,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <p className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">{w.n}</p>
                  <div style={{height:"100px"}} className="w-full flex items-end">
                    <div className="w-full bg-violet-500 hover:bg-violet-600 rounded-t-md transition-all" style={{height:`${maxN>0?Math.max(4,(w.n/maxN)*100):4}px`}}/>
                  </div>
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">{w.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <p className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-amber-500"/>Métodos de Pagamento</p>
            {(()=>{
              const m:Record<string,number>={};
              apts.forEach(a=>{if(a.paid&&a.paymentMethod)m[a.paymentMethod]=(m[a.paymentMethod]||0)+val(a);});
              const entries=Object.entries(m).sort((a,b)=>b[1]-a[1]);
              const tot=entries.reduce((s,[,v])=>s+v,0);
              const COLS=["bg-cyan-500","bg-violet-500","bg-emerald-500","bg-amber-500","bg-pink-500"];
              return entries.length===0?<p className="text-slate-400 text-sm">Nenhum pagamento no período</p>:(
                <div className="space-y-3">
                  {entries.map(([m2,v],i)=>(
                    <div key={m2}>
                      <div className="flex justify-between text-sm mb-1"><span className="text-slate-600 font-medium">{m2}</span><span className="font-bold text-slate-800">{R(v)} <span className="text-slate-400 text-xs font-normal">({pct(v,tot)}%)</span></span></div>
                      <Bar v={v} max={tot} color={COLS[i%COLS.length]}/>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AGENDA */}
      {aba==="agenda"&&(
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">Agenda Detalhada · <span className="text-cyan-600">{apts.length} registro(s)</span></p>
          </div>
          {apts.length===0?(
            <div className="p-16 text-center text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-3 opacity-20"/><p>Nenhum agendamento no período/filtro</p></div>
          ):(
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{["Data","Paciente","Profissional","Convênio","Procedimento","Status","Valor","Pago"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {apts.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map((a,i)=>{
                    const p=profs.find(p=>p.id===a.professionalId);
                    return (
                      <tr key={a.id??i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{a.patientName}</td>
                        <td className="px-4 py-3 text-slate-600">{p?.name??"—"}</td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{a.insurance||"Particular"}</span></td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-[130px] truncate">{a.procedure||"—"}</td>
                        <td className="px-4 py-3"><SBadge s={a.status}/></td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{val(a)>0?R(val(a)):"—"}</td>
                        <td className="px-4 py-3 text-center">{a.paid?<CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto"/>:<XCircle className="w-4 h-4 text-slate-300 mx-auto"/>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PENDENTES */}
      {aba==="pendentes"&&(
        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-orange-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-orange-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500"/>Sem Pagamento · {semPag.length} registro(s)</p>
              <p className="text-xs text-orange-600 mt-0.5">Atendimentos sem pagamento no período selecionado</p>
            </div>
            {semPag.length>0&&<div className="text-right"><p className="text-xs text-orange-500">Total em aberto</p><p className="text-xl font-bold text-orange-700">{R(semPag.reduce((s,a)=>s+(a.procedureValue??a.amount??0),0))}</p></div>}
          </div>
          {semPag.length===0?(
            <div className="p-16 text-center"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-emerald-400 opacity-60"/><p className="font-semibold text-slate-600">Tudo em dia!</p></div>
          ):(
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-orange-50 border-b border-orange-100">
                  <tr>{["Data","Paciente","Profissional","Convênio","Status","Valor"].map(h=><th key={h} className="px-4 py-3 text-left text-xs font-semibold text-orange-700 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {semPag.map((a,i)=>{
                    const p=profs.find(p=>p.id===a.professionalId);
                    return (
                      <tr key={a.id??i} className="border-b border-orange-50 hover:bg-orange-50 transition">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(a.date+"T12:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{a.patientName}</td>
                        <td className="px-4 py-3 text-slate-600">{p?.name??"—"}</td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{a.insurance||"Particular"}</span></td>
                        <td className="px-4 py-3"><SBadge s={a.status}/></td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-700">{(a.procedureValue??a.amount??0)>0?R(a.procedureValue??a.amount??0):"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* OCUPAÇÃO */}
      {aba==="ocupacao"&&(
        <OcupacaoTab apts={apts} profs={profs} ini={ini} fim={fim} />
      )}

    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABA OCUPAÇÃO — Taxa de aproveitamento por profissional
// ══════════════════════════════════════════════════════════════════════════════

function OcupacaoTab({ apts, profs, ini, fim }: {
  apts: Apt[];
  profs: Prof[];
  ini: Date;
  fim: Date;
}) {
  // Carrega horários configurados e bloqueios
  const horarios: Record<number, { aberto: boolean; inicio: string; fim: string; almoco: boolean; almocoInicio: string; almocoFim: string }> = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_horarios") ?? "{}"); } catch { return {}; }
  }, []);
  const bloqueios: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_agenda_blocks") ?? "[]"); } catch { return []; }
  }, []);
  const profissionaisRaw: any[] = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]"); } catch { return []; }
  }, []);

  // Duração padrão de slot em minutos
  const SLOT_MIN = 30;

  // ── Calcula dias úteis no período e slots por dia ────────────────────────
  function calcSlotsDisponiveis(profId: string): number {
    const profRaw = profissionaisRaw.find((p: any) => p.id === profId);
    const schedStart = profRaw?.scheduleStart ? parseInt(profRaw.scheduleStart.split(":")[0]) : 8;
    const schedEnd   = profRaw?.scheduleEnd   ? parseInt(profRaw.scheduleEnd.split(":")[0])   : 18;
    const horasTrab  = schedEnd - schedStart;
    if (horasTrab <= 0) return 0;

    let totalSlots = 0;
    const cur = new Date(ini);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(fim);
    end.setHours(23, 59, 59, 999);

    while (cur <= end) {
      const dow = cur.getDay();
      const dateStr = cur.toISOString().split("T")[0];
      const hrConf = horarios[dow];
      const aberto = hrConf ? hrConf.aberto : (dow >= 1 && dow <= 5); // seg-sex padrão

      if (aberto) {
        let slotsDia = (horasTrab * 60) / SLOT_MIN;

        // Desconta intervalo de almoço se configurado
        if (hrConf?.almoco && hrConf.almocoInicio && hrConf.almocoFim) {
          const almMin = parseInt(hrConf.almocoFim.split(":")[0]) * 60 + parseInt(hrConf.almocoFim.split(":")[1])
                       - parseInt(hrConf.almocoInicio.split(":")[0]) * 60 - parseInt(hrConf.almocoInicio.split(":")[1]);
          slotsDia -= almMin / SLOT_MIN;
        }

        // Desconta bloqueios do dia deste profissional
        const blqDia = bloqueios.filter((b: any) => b.professionalId === profId && b.date === dateStr);
        for (const b of blqDia) {
          const [sh, sm] = b.start.split(":").map(Number);
          const [eh, em] = b.end.split(":").map(Number);
          slotsDia -= ((eh * 60 + em) - (sh * 60 + sm)) / SLOT_MIN;
        }

        totalSlots += Math.max(slotsDia, 0);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return Math.round(totalSlots);
  }

  // ── Dados por profissional ───────────────────────────────────────────────
  const dadosProf = useMemo(() => {
    return profs.map((prof) => {
      const aptsProf = apts.filter((a) => a.professionalId === prof.id);
      const realizados  = aptsProf.filter((a) => a.status === "finalizado" || a.status === "em_atendimento").length;
      const agendados   = aptsProf.filter((a) => !["cancelado","faltou"].includes(a.status)).length;
      const cancelados  = aptsProf.filter((a) => a.status === "cancelado").length;
      const faltaram    = aptsProf.filter((a) => a.status === "faltou").length;
      const slotsDisp   = calcSlotsDisponiveis(prof.id);
      const taxaOcup    = slotsDisp > 0 ? Math.min(Math.round((agendados / slotsDisp) * 100), 100) : 0;
      const taxaRealizados = slotsDisp > 0 ? Math.min(Math.round((realizados / slotsDisp) * 100), 100) : 0;
      const receita     = aptsProf.reduce((s, a) => s + Number(a.amount || a.procedureValue || 0), 0);

      return { prof, slotsDisp, agendados, realizados, cancelados, faltaram, taxaOcup, taxaRealizados, receita };
    }).sort((a, b) => b.taxaOcup - a.taxaOcup);
  }, [apts, profs, ini, fim]);

  // Totais globais
  const totalDisp     = dadosProf.reduce((s, d) => s + d.slotsDisp, 0);
  const totalAgend    = dadosProf.reduce((s, d) => s + d.agendados, 0);
  const totalRealiz   = dadosProf.reduce((s, d) => s + d.realizados, 0);
  const taxaGlobalOcup   = totalDisp > 0 ? Math.round((totalAgend  / totalDisp) * 100) : 0;
  const taxaGlobalRealiz = totalDisp > 0 ? Math.round((totalRealiz / totalDisp) * 100) : 0;

  function corTaxa(t: number) {
    if (t >= 80) return { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" };
    if (t >= 50) return { bar: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50 border-amber-200" };
    return            { bar: "bg-red-400",        text: "text-red-700",     bg: "bg-red-50 border-red-200" };
  }

  function GaugeMini({ value, color }: { value: number; color: string }) {
    const circ = 2 * Math.PI * 18;
    return (
      <svg width="48" height="48" viewBox="0 0 48 48" className="rotate-[-90deg]">
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
        <circle
          cx="24" cy="24" r="18" fill="none"
          stroke="currentColor" strokeWidth="5"
          className={color}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - value / 100)}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const periodoStr = `${ini.toLocaleDateString("pt-BR")} – ${fim.toLocaleDateString("pt-BR")}`;

  return (
    <div className="space-y-5">

      {/* Resumo global */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Slots disponíveis", value: totalDisp, sub: "no período", color: "text-slate-700" },
          { label: "Agendados",         value: totalAgend, sub: `${taxaGlobalOcup}% dos slots`, color: "text-blue-700" },
          { label: "Realizados",        value: totalRealiz, sub: `${taxaGlobalRealiz}% dos slots`, color: "text-emerald-700" },
          { label: "Taxa de ocupação",  value: `${taxaGlobalOcup}%`, sub: "agendados / slots", color: taxaGlobalOcup >= 70 ? "text-emerald-700" : taxaGlobalOcup >= 40 ? "text-amber-700" : "text-red-700" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color}`} style={{ fontFamily: "'Sora', system-ui" }}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Info do período */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Período: <strong>{periodoStr}</strong> · Slot base de {SLOT_MIN} min · Considera horários de funcionamento e bloqueios configurados</span>
      </div>

      {/* Cards por profissional */}
      {dadosProf.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <Target className="h-12 w-12 opacity-20" />
          <p className="text-sm">Nenhum profissional com agendamentos no período</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dadosProf.map(({ prof, slotsDisp, agendados, realizados, cancelados, faltaram, taxaOcup, taxaRealizados, receita }) => {
            const cor = corTaxa(taxaOcup);
            return (
              <div key={prof.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-4 p-4">

                  {/* Gauge circular */}
                  <div className="relative shrink-0">
                    <GaugeMini value={taxaOcup} color={cor.text} />
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color: "hsl(var(--foreground))" }}>
                      {taxaOcup}%
                    </span>
                  </div>

                  {/* Info do profissional */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-foreground">{prof.name}</p>
                        <p className="text-xs text-muted-foreground">{prof.specialty}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cor.bg} ${cor.text}`}>
                        {taxaOcup >= 80 ? "Alta ocupação" : taxaOcup >= 50 ? "Ocupação média" : "Baixa ocupação"}
                      </span>
                    </div>

                    {/* Barra dupla: agendados vs realizados */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground shrink-0">Agendados</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${taxaOcup}%` }} />
                        </div>
                        <span className="w-24 text-right font-semibold text-foreground shrink-0">
                          {agendados}/{slotsDisp} slots
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground shrink-0">Realizados</span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${cor.bar}`} style={{ width: `${taxaRealizados}%` }} />
                        </div>
                        <span className="w-24 text-right font-semibold text-foreground shrink-0">
                          {realizados}/{slotsDisp} slots
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Métricas detalhadas */}
                <div className="grid grid-cols-5 divide-x divide-border border-t border-border bg-muted/20">
                  {[
                    { l: "Slots livres", v: Math.max(slotsDisp - agendados, 0), color: "text-slate-600" },
                    { l: "Agendados",    v: agendados,  color: "text-blue-700" },
                    { l: "Realizados",   v: realizados, color: "text-emerald-700" },
                    { l: "Cancelados",   v: cancelados, color: "text-red-600" },
                    { l: "Faltaram",     v: faltaram,   color: "text-orange-600" },
                  ].map(({ l, v, color }) => (
                    <div key={l} className="flex flex-col items-center py-2.5 px-1">
                      <span className={`text-base font-bold ${color}`} style={{ fontFamily: "'Sora', system-ui" }}>{v}</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota metodológica */}
      <p className="text-[11px] text-muted-foreground/60 text-center">
        Slots calculados com base nos horários de funcionamento configurados em Configurações → Horários, descontando bloqueios registrados na agenda.
        Profissionais sem horário configurado usam 08h–18h seg–sex como padrão.
      </p>
    </div>
  );
}
