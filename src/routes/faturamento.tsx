'use client';
import { createFileRoute, Link, useRouterState, Outlet, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, ChevronRight, Layers, SendHorizonal,
  CheckCircle2, AlertCircle, Clock, DollarSign, Pencil, Trash2,
  X, Save, ClipboardList, PackageCheck, ArrowDownToLine,
  Building2, CalendarDays, Hash, BadgePercent, Receipt, Download, Printer, FileCog, RotateCcw,
  ClipboardCheck, Filter, Stethoscope, UserCheck, Eye, ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useBilling } from '@/hooks/useBilling';
import { useTISS } from '@/hooks/useTISS';
import type { GuiaTISS } from '@/lib/tiss/tiss-types';
import { billingStorage } from '@/lib/financial/billing-storage';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { drawPdfHeader } from "@/lib/pdfHeader";
import type {
  LoteFaturamento, FaturaConvenio, ItemFaturamento, LoteStatus, FaturaStatus,
} from '@/lib/financial/billing-types';

export const Route = createFileRoute('/faturamento')({
  head: () => ({ meta: [{ title: 'Faturamento — NexaClinic' }] }),
  component: FaturamentoPage,
});

// ─── helpers visuais ──────────────────────────────────────────────────────────
const loteStatusCfg: Record<LoteStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  aberto:   { label: 'Aberto',   cls: 'border-blue-200 bg-blue-50 text-blue-700',      icon: <Clock className="h-3 w-3" /> },
  fechado:  { label: 'Fechado',  cls: 'border-amber-200 bg-amber-50 text-amber-700',   icon: <PackageCheck className="h-3 w-3" /> },
  enviado:  { label: 'Enviado',  cls: 'border-purple-200 bg-purple-50 text-purple-700',icon: <SendHorizonal className="h-3 w-3" /> },
  pago:     { label: 'Pago',     cls: 'border-green-200 bg-green-50 text-green-700',   icon: <CheckCircle2 className="h-3 w-3" /> },
  glosado:  { label: 'Glosado',  cls: 'border-red-200 bg-red-50 text-red-700',         icon: <AlertCircle className="h-3 w-3" /> },
};

const faturaStatusCfg: Record<FaturaStatus, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  enviada:  { label: 'Enviada',  cls: 'border-purple-200 bg-purple-50 text-purple-700' },
  paga:     { label: 'Paga',     cls: 'border-green-200 bg-green-50 text-green-700' },
  glosada:  { label: 'Glosada',  cls: 'border-red-200 bg-red-50 text-red-700' },
  recurso:  { label: 'Recurso',  cls: 'border-orange-200 bg-orange-50 text-orange-700' },
};

// Convênios disponíveis — busca real no Supabase (cache compartilhado,
// auto-invalidado ao criar/editar/excluir — ver @/lib/agendaData).
// Antes lia a chave "nexaclinic_convenios" do localStorage, que nenhuma
// tela grava (o cadastro é 100% Supabase), então sempre caía no fallback
// com convênios fictícios ("Unimed", "Bradesco Saúde" etc.).
async function fetchConveniosReal(): Promise<{ id: string; name: string; ansCode?: string; faturar?: boolean }[]> {
  try {
    const { listarConvenios } = await import("@/lib/agendaData");
    const list = await listarConvenios();
    return (list as any[])
      .filter((c) => c.status === "ativo")
      .map((c) => ({ id: c.id, name: c.name, ansCode: c.ansCode, faturar: c.faturar === true }));
  } catch { return []; }
}

// competências dos últimos 12 meses
function getCompetencias() {
  const list: string[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
}

function formatCompetencia(c: string) {
  const [y, m] = c.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// ─── componente principal ─────────────────────────────────────────────────────
function FaturamentoPage() {
  const {
    lotes, faturas, loading, summaryLotes, summaryFaturas,
    createLote, updateLote, fecharLote, reabrirLote, enviarLote, marcarLotePago, deleteLote,
    addItemToLote, removeItemFromLote,
    createFatura, updateFatura, enviarFatura, registrarPagamentoFatura, deleteFatura,
    formatCurrency,
  } = useBilling();

  const navigate = useNavigate();
  const { criarLoteDoFaturamento, enviarLote: enviarLoteTISS } = useTISS();

  const [tab, setTab] = useState<'lotes' | 'faturas'>('lotes');
  const [q, setQ] = useState('');
  const [convenios, setConvenios] = useState<{ id: string; name: string; ansCode?: string; faturar?: boolean }[]>([]);
  useEffect(() => { fetchConveniosReal().then(setConvenios); }, []);

  // ─── Controle de Guias ────────────────────────────────────────────────────
  // Guias = atendimentos vindos da agenda (nexaclinic_appointments_v3)
  const [guias, setGuias] = useState<any[]>([]);
  const [guiaEdit, setGuiaEdit] = useState<any | null>(null);
  const [gerarFaturaOpen, setGerarFaturaOpen] = useState(false);
  const [gfConvenioId, setGfConvenioId] = useState('');
  const [gfConvenioNome, setGfConvenioNome] = useState('');
  const [gfProfissional, setGfProfissional] = useState('');
  const [gfPeriodoInicio, setGfPeriodoInicio] = useState('');
  const [gfPeriodoFim, setGfPeriodoFim] = useState('');
  const [gfStatus, setGfStatus] = useState('todos');
  const [gfGuiaCompleta, setGfGuiaCompleta] = useState(false);
  const [gfTipoGuia, setGfTipoGuia] = useState('todos');
  const [gfSelecionadas, setGfSelecionadas] = useState<string[]>([]);
  const [gfResultados, setGfResultados] = useState<any[]>([]);
  const [gfBuscou, setGfBuscou] = useState(false);
  const [profissionais, setProfissionais] = useState<any[]>([]);

  useEffect(() => {
    async function carregarGuias() {
      try {
        const raw = localStorage.getItem('nexaclinic_appointments_v3') ?? '[]';
        const apts = JSON.parse(raw) as any[];

        // Lê convênios cadastrados (Supabase) para checar flag "faturar"
        const { listarConvenios } = await import('@/lib/agendaData');
        const convsCad: any[] = await listarConvenios();

        // Monta set com nome E id dos convênios marcados como faturar:true
        const convenioFaturaSet = new Set<string>();
        convsCad.filter((c: any) => c.faturar === true).forEach((c: any) => {
          if (c.name)  convenioFaturaSet.add(c.name.trim().toLowerCase());
          if (c.id)    convenioFaturaSet.add(c.id.trim().toLowerCase());
        });

        // Se nenhum convênio tem faturar:true, mostra todos de convênio (comportamento original)
        const temFaturarConfigurado = convsCad.some((c: any) => c.faturar === true);

        const guiasFilt = apts.filter((a) => {
          if (!a.insurance || a.insurance === 'Particular') return false;
          if (a.status === 'cancelado') return false;
          if (a.sentToBilling) return false;
          // Se nenhum convênio foi configurado com faturar:true, mostra todos
          if (!temFaturarConfigurado) return true;
          // Caso contrário, filtra apenas os marcados
          const ins = (a.insurance ?? '').trim().toLowerCase();
          return convenioFaturaSet.has(ins);
        });
        setGuias(guiasFilt);
      } catch { setGuias([]); }
    }
    function carregarProfs() {
      try {
        const raw = localStorage.getItem('nexaclinic_professionals') ?? '[]';
        setProfissionais(JSON.parse(raw));
      } catch { setProfissionais([]); }
    }
    carregarGuias();
    carregarProfs();
  }, [tab]);

  function salvarGuia(guia: any) {
    try {
      const raw = localStorage.getItem('nexaclinic_appointments_v3') ?? '[]';
      const apts = JSON.parse(raw) as any[];
      const idx = apts.findIndex((a) => a.id === guia.id);
      if (idx !== -1) {
        apts[idx] = { ...apts[idx], ...guia };
        localStorage.setItem('nexaclinic_appointments_v3', JSON.stringify(apts));
        setGuias((prev) => prev.map((g) => g.id === guia.id ? { ...g, ...guia } : g));
        toast.success('Guia atualizada');
      }
    } catch { toast.error('Erro ao salvar guia'); }
    setGuiaEdit(null);
  }

  function pesquisarGuias() {
    let resultado = guias;
    if (gfConvenioNome && gfConvenioNome !== 'todos_convenios') resultado = resultado.filter((g) => g.insurance === gfConvenioNome);
    if (gfProfissional) resultado = resultado.filter((g) => g.professionalId === gfProfissional);
    if (gfPeriodoInicio) resultado = resultado.filter((g) => g.date >= gfPeriodoInicio);
    if (gfPeriodoFim)    resultado = resultado.filter((g) => g.date <= gfPeriodoFim);
    if (gfStatus !== 'todos') resultado = resultado.filter((g) => g.status === gfStatus);
    if (gfTipoGuia !== 'todos') resultado = resultado.filter((g) => (g.tipoGuia ?? 'consulta') === gfTipoGuia);
    if (gfGuiaCompleta) resultado = resultado.filter((g) => g.guiaCompleta);
    setGfResultados(resultado);
    setGfBuscou(true);
    setGfSelecionadas([]);
  }

  function gerarFaturaDosFiltros() {
    const guiasParaLote = gfResultados.filter((g) => gfSelecionadas.includes(g.id));
    if (guiasParaLote.length === 0) { toast.error('Selecione ao menos uma guia'); return; }
    const conv = convenios.find((c: any) => c.id === gfConvenioId || c.name === gfConvenioNome)
      ?? (gfConvenioNome ? { id: gfConvenioNome, name: gfConvenioNome, ansCode: '' } : null);
    if (!conv) { toast.error('Selecione um convênio antes de gerar o lote'); return; }

    // Determina competência (mês mais frequente entre as guias)
    const competencia = guiasParaLote[0]?.date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

    // Cria ou reusa lote aberto
    const lotesExistentes = billingStorage.getLotes();
    let lote = lotesExistentes.find(
      (l) => l.convenioId === (conv as any).id && l.status === 'aberto' && l.competencia === competencia
    );
    if (!lote) {
      lote = billingStorage.createLote({
        convenioId: (conv as any).id,
        convenioName: (conv as any).name,
        ansCode: (conv as any).ansCode ?? '',
        competencia,
        numero: '',
        status: 'aberto',
        observacoes: `Gerado pelo Controle de Guias`,
      });
    }

    // Adiciona cada guia ao lote — bloqueia duplicidade por appointmentId
    let adicionadas = 0;
    let jaFaturadas = 0;
    let duplicadas = 0;

    // IDs já presentes no lote para evitar duplicidade
    const loteAtual = billingStorage.getLotes().find((l: any) => l.id === lote!.id);
    const idsNoLote = new Set<string>((loteAtual?.items ?? []).map((i: any) => i.appointmentId).filter(Boolean));

    for (const g of guiasParaLote) {
      if (g.sentToBilling) { jaFaturadas++; continue; } // já faturado → pula
      if (idsNoLote.has(g.id)) { duplicadas++; continue; } // já no lote → pula

      billingStorage.addItemToLote(lote!.id, {
        appointmentId: g.id,
        patientName: g.patientName,
        patientCpf: g.cpf,
        carteirinha: g.carteirinha ?? undefined,
        convenioName: g.insurance,         // ← plano gravado no item
        procedure: g.procedure ?? '',
        procedureCode: g.procedureCode ?? undefined,
        date: g.date,
        quantity: 1,
        unitValue: g.procedureValue ?? 0,
        totalValue: g.procedureValue ?? 0,
        professionalName: profissionais.find((p) => p.id === g.professionalId)?.name ?? '',
        professionalCrm: profissionais.find((p) => p.id === g.professionalId)?.crm ?? undefined,
        authorizationCode: g.authorizationCode ?? undefined,
        status: 'incluido',
      });
      idsNoLote.add(g.id);

      // Marca guia como faturada no storage da agenda
      try {
        const raw = localStorage.getItem('nexaclinic_appointments_v3') ?? '[]';
        const apts = JSON.parse(raw) as any[];
        const idx2 = apts.findIndex((a) => a.id === g.id);
        if (idx2 !== -1) { apts[idx2].sentToBilling = true; localStorage.setItem('nexaclinic_appointments_v3', JSON.stringify(apts)); }
      } catch { /* ignore */ }
      adicionadas++;
    }

    if (adicionadas === 0) {
      const motivo = jaFaturadas > 0
        ? `${jaFaturadas} guia(s) já foram faturadas anteriormente.`
        : duplicadas > 0
        ? `${duplicadas} guia(s) já estão neste lote.`
        : 'Verifique a seleção.';
      toast.error(`Nenhuma guia adicionada. ${motivo}`);
      return;
    }
    if (jaFaturadas > 0) toast.warning(`${jaFaturadas} guia(s) ignorada(s) — já faturadas.`);
    if (duplicadas > 0) toast.warning(`${duplicadas} guia(s) ignorada(s) — já estão no lote.`);
    toast.success(`${adicionadas} guia(s) adicionada(s) ao Lote ${lote!.numero}`);
    setGerarFaturaOpen(false);
    setGfSelecionadas([]);
    setGfResultados([]);
    setGfBuscou(false);
    setTab('lotes');
  }
  const competencias = getCompetencias();

  // ─── Diálogo TISS opcional ───────────────────────────────────────────────
  const [tissDialog, setTissDialog] = useState<{ lote: LoteFaturamento; acao: 'fechar' | 'enviar' } | null>(null);
  const [tissLoading, setTissLoading] = useState(false);

  // ─── Lote dialogs ────────────────────────────────────────────────────────
  const [loteForm, setLoteForm] = useState(false);
  const [loteEdit, setLoteEdit] = useState<LoteFaturamento | null>(null);
  const [loteDelete, setLoteDelete] = useState<string | null>(null);
  const [loteDetail, setLoteDetail] = useState<LoteFaturamento | null>(null);
  const [pagamentoLote, setPagamentoLote] = useState<LoteFaturamento | null>(null);

  const emptyLote = { convenioId: '', competencia: competencias[0], observacoes: '' };
  const [loteData, setLoteData] = useState(emptyLote);

  // ─── Item dialog ─────────────────────────────────────────────────────────
  const [itemForm, setItemForm] = useState(false);
  const emptyItem = {
    patientName: '', patientCpf: '', carteirinha: '',
    procedure: '', procedureCode: '', date: new Date().toISOString().split('T')[0],
    quantity: 1, unitValue: 0, authorizationCode: '',
    professionalName: '', professionalCrm: '',
  };
  const [itemData, setItemData] = useState(emptyItem);

  // ─── Fatura dialogs ──────────────────────────────────────────────────────
  const [faturaForm, setFaturaForm] = useState(false);
  const [faturaDelete, setFaturaDelete] = useState<string | null>(null);
  const [faturaDetail, setFaturaDetail] = useState<FaturaConvenio | null>(null);
  const [pagamentoFatura, setPagamentoFatura] = useState<FaturaConvenio | null>(null);

  // Recarrega convênios sempre que um dos diálogos que usam a lista abre —
  // garante que convênios recém-cadastrados apareçam sem precisar recarregar a página.
  useEffect(() => {
    if (loteForm || faturaForm) fetchConveniosReal().then(setConvenios);
  }, [loteForm, faturaForm]);

  const [envioFatura, setEnvioFatura] = useState<FaturaConvenio | null>(null);

  const emptyFatura = {
    convenioId: '', competencia: competencias[0], loteIds: [] as string[],
    dataVencimento: '', observacoes: '', protocolo: '',
  };
  const [faturaData, setFaturaData] = useState(emptyFatura);

  // pagamento
  const [pagValor, setPagValor] = useState('');
  const [pagGlosa, setPagGlosa] = useState('');
  const [protocolo, setProtocolo] = useState('');

  // ─── Lotes filtrados ──────────────────────────────────────────────────────
  const filteredLotes = lotes.filter(l =>
    [l.numero, l.convenioName, l.competencia, l.status].some(f =>
      f?.toLowerCase().includes(q.toLowerCase())
    )
  );
  const filteredFaturas = faturas.filter(f =>
    [f.numero, f.convenioName, f.competencia, f.status].some(s =>
      s?.toLowerCase().includes(q.toLowerCase())
    )
  );

  // ─── Handlers TISS ────────────────────────────────────────────────────────
  function handleFecharLote(lote: LoteFaturamento) {
    fecharLote(lote.id);
    setTissDialog({ lote: { ...lote, status: 'fechado' }, acao: 'fechar' });
  }

  function handleEnviarLote(lote: LoteFaturamento) {
    enviarLote(lote.id);
    setTissDialog({ lote: { ...lote, status: 'enviado' }, acao: 'enviar' });
  }

  async function gerarTISS() {
    if (!tissDialog) return;
    setTissLoading(true);
    try {
      const { lote } = tissDialog;

      // Montar configuração da prestadora salva (ou fallback)
      const cfgRaw = localStorage.getItem('nexaclinic_tiss_config');
      const cfg = cfgRaw ? JSON.parse(cfgRaw) : {};
      const prestadora = {
        cnpj: cfg.prestadora?.cnpj ?? '',
        codigoNaOperadora: cfg.prestadora?.codigoNaOperadora ?? '',
        nomeFantasia: cfg.prestadora?.nomeFantasia ?? 'NexaClinic',
        razaoSocial: cfg.prestadora?.razaoSocial ?? 'NexaClinic',
        cnes: cfg.prestadora?.cnes,
      };

      const guias: GuiaTISS[] = lote.items.map((item): GuiaTISS => ({
        tipo: 'guiaConsulta',
        numeroGuia: item.id,
        dataAtendimento: item.date,
        numeroAutorizacao: item.authorizationCode,
        beneficiario: {
          numeroCarteirinha: item.carteirinha ?? '',
          nome: item.patientName,
          dataNascimento: '',
          cpf: item.patientCpf,
        },
        profissionalExecutante: {
          nome: item.professionalName ?? '',
          cpf: '',
          crm: item.professionalCrm,
          conselho: 'CRM',
          uf: '',
        },
        procedimento: {
          codigoTUSS: item.procedureCode ?? '',
          descricao: item.procedure,
          quantidade: item.quantity,
          valorUnitario: item.unitValue,
          valorTotal: item.totalValue,
        },
      }));

      const loteTISS = criarLoteDoFaturamento({
        loteId: lote.id,
        competencia: lote.competencia,
        convenioId: lote.convenioId,
        convenioNome: lote.convenioName,
        convenioANS: lote.ansCode ?? '',
        prestadora,
        guias,
        totalProcedimentos: lote.items.length,
        valorTotal: lote.totalValue,
        dataGeracao: new Date().toISOString(),
      });

      const resultado = await enviarLoteTISS(loteTISS.id);
      if (resultado.ok) {
        toast.success('XML TISS gerado com sucesso!');
        setTissDialog(null);
        // Navegar para a tela TISS para visualizar o lote criado
        navigate({ to: '/tiss' });
      } else {
        toast.error(resultado.mensagem);
        setTissLoading(false);
      }
    } catch (e: any) {
      toast.error('Erro ao gerar TISS: ' + (e?.message ?? 'desconhecido'));
      setTissLoading(false);
    }
  }

  // ─── Handlers Lote ───────────────────────────────────────────────────────
  function submitLote() {
    if (!loteData.convenioId) { toast.error('Selecione um convênio'); return; }
    const conv = convenios.find((c: any) => c.id === loteData.convenioId);
    if (loteEdit) {
      updateLote(loteEdit.id, { observacoes: loteData.observacoes, competencia: loteData.competencia });
      toast.success('Lote atualizado');
    } else {
      createLote({
        convenioId: conv!.id,
        convenioName: conv!.name,
        ansCode: conv!.ansCode,
        competencia: loteData.competencia,
        numero: '',
        status: 'aberto',
        observacoes: loteData.observacoes,
      });
    }
    setLoteForm(false);
    setLoteEdit(null);
    setLoteData(emptyLote);
  }

  function openEditLote(l: LoteFaturamento) {
    setLoteEdit(l);
    setLoteData({ convenioId: l.convenioId, competencia: l.competencia, observacoes: l.observacoes ?? '' });
    setLoteForm(true);
  }

  // ─── Handlers Item ───────────────────────────────────────────────────────
  function submitItem() {
    if (!loteDetail) return;
    if (!itemData.patientName.trim()) { toast.error('Informe o paciente'); return; }
    if (!itemData.procedure.trim()) { toast.error('Informe o procedimento'); return; }
    addItemToLote(loteDetail.id, {
      appointmentId: undefined,
      patientName: itemData.patientName,
      patientCpf: itemData.patientCpf,
      carteirinha: itemData.carteirinha,
      procedure: itemData.procedure,
      procedureCode: itemData.procedureCode,
      date: itemData.date,
      quantity: Number(itemData.quantity),
      unitValue: Number(itemData.unitValue),
      totalValue: Number(itemData.quantity) * Number(itemData.unitValue),
      professionalName: itemData.professionalName,
      professionalCrm: itemData.professionalCrm,
      authorizationCode: itemData.authorizationCode,
      status: 'incluido',
    });
    // refresh detail
    const updated = billingStorage_getLote(loteDetail.id);
    if (updated) setLoteDetail(updated);
    setItemForm(false);
    setItemData(emptyItem);
  }

  // ─── Handlers Fatura ─────────────────────────────────────────────────────
  function submitFatura() {
    if (!faturaData.convenioId) { toast.error('Selecione um convênio'); return; }
    if (faturaData.loteIds.length === 0) { toast.error('Selecione ao menos um lote'); return; }
    const conv = convenios.find((c: any) => c.id === faturaData.convenioId);
    createFatura({
      convenioId: conv!.id,
      convenioName: conv!.name,
      ansCode: conv!.ansCode,
      competencia: faturaData.competencia,
      loteIds: faturaData.loteIds,
      status: 'pendente',
      dataVencimento: faturaData.dataVencimento || undefined,
      observacoes: faturaData.observacoes || undefined,
    });
    setFaturaForm(false);
    setFaturaData(emptyFatura);
  }

  function submitPagamentoLote() {
    if (!pagamentoLote) return;
    marcarLotePago(pagamentoLote.id, Number(pagValor), Number(pagGlosa || '0'));
    setPagamentoLote(null); setPagValor(''); setPagGlosa('');
  }

  function submitPagamentoFatura() {
    if (!pagamentoFatura) return;
    registrarPagamentoFatura(pagamentoFatura.id, Number(pagValor), Number(pagGlosa || '0'));
    setPagamentoFatura(null); setPagValor(''); setPagGlosa('');
  }

  function submitEnvioFatura() {
    if (!envioFatura) return;
    enviarFatura(envioFatura.id, protocolo || undefined);
    setEnvioFatura(null); setProtocolo('');
  }

  // lotes disponíveis para incluir em fatura (fechados do convênio selecionado)
  const lotesDisponiveisParaFatura = lotes.filter(l =>
    l.convenioId === faturaData.convenioId &&
    (l.status === 'fechado' || l.status === 'aberto') &&
    !faturas.some(f => f.loteIds.includes(l.id))
  );

  // hack para refresh do detalhe
  function billingStorage_getLote(id: string) {
    try {
      const data = localStorage.getItem('nexaclinic_lotes_faturamento');
      const all: LoteFaturamento[] = data ? JSON.parse(data) : [];
      return all.find(l => l.id === id);
    } catch { return undefined; }
  }

  // ─── Impressão de Lote em PDF ─────────────────────────────────────────
  async function printLote(lote: LoteFaturamento) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Paleta
    const primary = [14, 116, 144] as [number, number, number];
    const dark    = [15,  23,  42] as [number, number, number];
    const gray    = [100, 116, 139] as [number, number, number];
    const green   = [22,  163,  74] as [number, number, number];
    const blue    = [37,  99,  235] as [number, number, number];
    const amber   = [180, 120,  10] as [number, number, number];
    const white   = [255, 255, 255] as [number, number, number];
    const light   = [248, 250, 252] as [number, number, number];

    const statusColor: Record<string, [number,number,number]> = {
      aberto:  blue,
      fechado: amber,
      enviado: [139, 92, 246],
      pago:    green,
      glosado: [220, 38, 38],
    };

    // ── CABEÇALHO com logo da empresa ─────────────────────────────────
    let y = await drawPdfHeader(doc, 'LOTE DE FATURAMENTO', `Lote Nº ${lote.numero}`);

    // ── CAIXA DE IDENTIFICAÇÃO DO LOTE ───────────────────────────────────
    doc.setFillColor(...light);
    doc.roundedRect(12, y, pageW - 24, 34, 2, 2, 'F');
    doc.setDrawColor(220, 230, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(12, y, pageW - 24, 34, 2, 2, 'S');

    // Barra lateral de status
    const sc = statusColor[lote.status] ?? primary;
    doc.setFillColor(...sc);
    doc.roundedRect(12, y, 4, 34, 1, 1, 'F');

    const statusLabel: Record<string, string> = {
      aberto: 'ABERTO', fechado: 'FECHADO', enviado: 'ENVIADO', pago: 'PAGO', glosado: 'GLOSADO',
    };

    // Coluna 1 — Convênio
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('CONVÊNIO', 20, y + 7);
    doc.setTextColor(...dark);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(lote.convenioName, 20, y + 13);
    if (lote.ansCode) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(`Código ANS: ${lote.ansCode}`, 20, y + 19);
    }

    // Coluna 2 — Competência
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('COMPETÊNCIA', 90, y + 7);
    doc.setTextColor(...dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCompetencia(lote.competencia), 90, y + 13);

    // Coluna 3 — Status
    doc.setTextColor(...gray);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('STATUS', 145, y + 7);
    doc.setTextColor(...sc);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(statusLabel[lote.status] ?? lote.status.toUpperCase(), 145, y + 13);

    // Linha divisória horizontal
    doc.setDrawColor(220, 230, 240);
    doc.setLineWidth(0.2);
    doc.line(20, y + 22, pageW - 12, y + 22);

    // Segunda linha — datas
    const datas: { label: string; value: string }[] = [
      { label: 'CRIADO EM', value: new Date(lote.createdAt).toLocaleDateString('pt-BR') },
    ];
    if (lote.fechadoAt) datas.push({ label: 'FECHADO EM', value: new Date(lote.fechadoAt).toLocaleDateString('pt-BR') });
    if (lote.enviadoAt) datas.push({ label: 'ENVIADO EM', value: new Date(lote.enviadoAt).toLocaleDateString('pt-BR') });
    if (lote.pagoAt) datas.push({ label: 'PAGO EM', value: new Date(lote.pagoAt).toLocaleDateString('pt-BR') });
    datas.forEach((d, i) => {
      const x = 20 + i * 46;
      doc.setTextColor(...gray);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(d.label, x, y + 27);
      doc.setTextColor(...dark);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(d.value, x, y + 32);
    });

    y += 42;

    // ── CARDS DE RESUMO ───────────────────────────────────────────────────
    const totalItems = lote.items.length;
    const totalValue = lote.totalValue;
    const totalPago  = lote.valorPago ?? 0;
    const totalGlosa = lote.valorGlosado ?? 0;

    const summaryCards = [
      { label: 'ITENS NO LOTE', value: String(totalItems), color: primary },
      { label: 'VALOR TOTAL', value: fmt(totalValue), color: blue },
      { label: 'VALOR PAGO', value: fmt(totalPago), color: green },
      { label: 'GLOSAS', value: fmt(totalGlosa), color: totalGlosa > 0 ? [220, 38, 38] as [number,number,number] : gray },
    ];

    const cardW = (pageW - 28) / 4;
    summaryCards.forEach((card, i) => {
      const x = 12 + i * (cardW + 2);
      doc.setFillColor(...light);
      doc.roundedRect(x, y, cardW, 16, 2, 2, 'F');
      doc.setFillColor(...card.color);
      doc.roundedRect(x, y, 3, 16, 1, 1, 'F');
      doc.setTextColor(...gray);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(card.label, x + 6, y + 6);
      doc.setTextColor(...dark);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(card.value, x + 6, y + 12);
    });

    y += 22;

    // ── OBSERVAÇÕES ───────────────────────────────────────────────────────
    if (lote.observacoes) {
      doc.setFillColor(255, 251, 235);
      doc.roundedRect(12, y, pageW - 24, 10, 2, 2, 'F');
      doc.setTextColor(146, 64, 14);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('OBS:', 16, y + 4);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(lote.observacoes, pageW - 42);
      doc.text(obsLines[0] ?? '', 26, y + 4);
      if (obsLines.length > 1) doc.text(obsLines[1], 16, y + 8);
      y += 14;
    }

    // ── TABELA DE ITENS ───────────────────────────────────────────────────
    doc.setTextColor(...dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`ITENS DO LOTE  (${totalItems} atendimento${totalItems !== 1 ? 's' : ''})`, 12, y);
    y += 3;

    if (lote.items.length === 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text('Nenhum item adicionado a este lote.', 12, y + 8);
    } else {
      autoTable(doc, {
        startY: y,
        margin: { left: 12, right: 12 },
        head: [['#', 'Paciente', 'Carteirinha', 'Procedimento', 'Data', 'Qtd', 'Vlr Unit.', 'Total', 'Autorização', 'Situação']],
        body: lote.items.map((item, idx) => [
          String(idx + 1),
          item.patientName + (item.patientCpf ? `\nCPF: ${item.patientCpf}` : ''),
          item.carteirinha || '—',
          item.procedure + (item.procedureCode ? `\nTUSS: ${item.procedureCode}` : ''),
          new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR'),
          String(item.quantity),
          fmt(item.unitValue),
          fmt(item.totalValue),
          item.authorizationCode || '—',
          item.status === 'aprovado' ? 'Aprovado'
            : item.status === 'glosado' ? 'Glosado'
            : 'Incluído',
        ]),
        foot: [[
          { content: `Total: ${totalItems} item(s)`, colSpan: 7 },
          fmt(totalValue),
          '',
          '',
        ]],
        headStyles: {
          fillColor: primary,
          textColor: white,
          fontSize: 6.5,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { fontSize: 7, textColor: dark },
        footStyles: {
          fillColor: [241, 245, 249] as [number,number,number],
          textColor: dark,
          fontSize: 7.5,
          fontStyle: 'bold',
        },
        columnStyles: {
          0:  { cellWidth: 8,  halign: 'center' },
          1:  { cellWidth: 38 },
          2:  { cellWidth: 22, halign: 'center' },
          3:  { cellWidth: 30 },
          4:  { cellWidth: 18, halign: 'center' },
          5:  { cellWidth: 10, halign: 'center' },
          6:  { cellWidth: 20, halign: 'right' },
          7:  { cellWidth: 20, halign: 'right' },
          8:  { cellWidth: 18, halign: 'center' },
          9:  { cellWidth: 16, halign: 'center' },
        },
        alternateRowStyles: { fillColor: light },
        showFoot: 'lastPage',
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 9) {
            const raw = String(data.cell.raw);
            if (raw === 'Aprovado') data.cell.styles.textColor = green;
            else if (raw === 'Glosado') data.cell.styles.textColor = [220, 38, 38];
            else data.cell.styles.textColor = blue;
          }
          if (data.section === 'body' && data.column.index === 7) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      // Totalizador financeiro após tabela
      const finalY = (doc as any).lastAutoTable.finalY + 6;
      if (lote.status === 'pago') {
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(pageW - 80, finalY, 68, 22, 2, 2, 'F');
        doc.setDrawColor(...green);
        doc.setLineWidth(0.3);
        doc.roundedRect(pageW - 80, finalY, 68, 22, 2, 2, 'S');

        doc.setTextColor(...gray);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.text('VALOR FATURADO',   pageW - 76, finalY + 5);
        doc.text('VALOR PAGO',       pageW - 76, finalY + 11);
        doc.text('GLOSAS',           pageW - 76, finalY + 17);

        doc.setTextColor(...dark);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(fmt(totalValue), pageW - 14, finalY + 5,  { align: 'right' });
        doc.setTextColor(...green);
        doc.text(fmt(totalPago),  pageW - 14, finalY + 11, { align: 'right' });
        doc.setTextColor(totalGlosa > 0 ? 220 : 100, totalGlosa > 0 ? 38 : 116, totalGlosa > 0 ? 38 : 139);
        doc.text(fmt(totalGlosa), pageW - 14, finalY + 17, { align: 'right' });
      }
    }

    // ── RODAPÉ EM TODAS AS PÁGINAS ────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...dark);
      doc.rect(0, pageH - 8, pageW, 8, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('NexaClinic — Gestão Clínica Inteligente  |  Documento gerado automaticamente', 12, pageH - 3);
      doc.text(`Página ${i} de ${totalPages}`, pageW - 12, pageH - 3, { align: 'right' });
    }

    doc.save(`lote_${lote.numero.replace('/', '-')}_${lote.convenioName.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF gerado com sucesso');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Receipt className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Faturamento de Convênios</h1>
            <p className="text-sm text-muted-foreground">Gerencie lotes e faturas para envio aos convênios</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === 'lotes' && (
            <Button onClick={() => { setLoteEdit(null); setLoteData(emptyLote); setLoteForm(true); }}
              className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Novo Lote
            </Button>
          )}
          {tab === 'faturas' && (
            <Button onClick={() => { setFaturaData(emptyFatura); setFaturaForm(true); }}
              className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Plus className="h-4 w-4" /> Nova Fatura
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Lotes Abertos', value: summaryLotes.abertos, sub: fmt(summaryLotes.totalAberto), cls: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { label: 'Aguardando Pgto', value: summaryFaturas.enviadas, sub: fmt(summaryFaturas.totalPendente), cls: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
          { label: 'Faturas Pagas', value: summaryFaturas.pagas, sub: fmt(summaryFaturas.totalPago), cls: 'text-green-700', bg: 'bg-green-50 border-green-100' },
          { label: 'Glosados', value: lotes.filter(l => l.status === 'glosado').length, sub: fmt(summaryLotes.totalGlosado), cls: 'text-red-600', bg: 'bg-red-50 border-red-100' },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.bg}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.cls}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs + busca */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="lotes" className="gap-1.5">
              <Layers className="h-4 w-4" /> Lotes
              {summaryLotes.abertos > 0 && (
                <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-bold text-blue-700">
                  {summaryLotes.abertos}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="faturas" className="gap-1.5">
              <FileText className="h-4 w-4" /> Faturas
              {summaryFaturas.enviadas > 0 && (
                <span className="ml-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-bold text-purple-700">
                  {summaryFaturas.enviadas}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-9" />
        </div>
      </div>


      {/* ─── LOTES ─────────────────────────────────────────────────────── */}
      {tab === 'lotes' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {filteredLotes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <Layers className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhum lote encontrado.</p>
              <Button size="sm" onClick={() => setLoteForm(true)} className="bg-gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> Criar lote
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Número</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLotes.map((l) => {
                  const cfg = loteStatusCfg[l.status];
                  return (
                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/20"
                      onClick={() => setLoteDetail(l)}>
                      <TableCell className="font-mono text-xs font-semibold">{l.numero}</TableCell>
                      <TableCell>
                        <div className="font-medium">{l.convenioName}</div>
                        {l.ansCode && <div className="text-xs text-muted-foreground">ANS {l.ansCode}</div>}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{formatCompetencia(l.competencia)}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                          {l.itemCount}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{fmt(l.totalValue)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={`gap-1 text-xs ${cfg.cls}`}>
                          {cfg.icon} {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {l.status === 'aberto' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                              onClick={(e) => { e.stopPropagation(); handleFecharLote(l); }}>
                              <PackageCheck className="h-3 w-3 mr-1" /> Fechar
                            </Button>
                          )}
                          {l.status === 'fechado' && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-amber-700 border-amber-200"
                                onClick={(e) => { e.stopPropagation(); reabrirLote(l.id); }}>
                                <RotateCcw className="h-3 w-3 mr-1" /> Reabrir
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                                onClick={(e) => { e.stopPropagation(); handleEnviarLote(l); }}>
                                <SendHorizonal className="h-3 w-3 mr-1" /> Enviar
                              </Button>
                            </>
                          )}
                          {l.status === 'enviado' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-green-700 border-green-200"
                              onClick={(e) => { e.stopPropagation(); setPagamentoLote(l); setPagValor(String(l.totalValue)); setPagGlosa('0'); }}>
                              <DollarSign className="h-3 w-3 mr-1" /> Pagar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Imprimir lote (PDF)"
                            onClick={(e) => { e.stopPropagation(); printLote(l); }}>
                            <Printer className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar lote"
                            onClick={(e) => { e.stopPropagation(); openEditLote(l); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={(e) => { e.stopPropagation(); setLoteDelete(l.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ─── FATURAS ────────────────────────────────────────────────────── */}
      {tab === 'faturas' && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {filteredFaturas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="text-sm">Nenhuma fatura gerada ainda.</p>
              <Button size="sm" onClick={() => setFaturaForm(true)} className="bg-gradient-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> Gerar fatura
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Número</TableHead>
                  <TableHead>Convênio</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead>Lotes</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFaturas.map((f) => {
                  const cfg = faturaStatusCfg[f.status];
                  return (
                    <TableRow key={f.id} className="cursor-pointer hover:bg-muted/20"
                      onClick={() => setFaturaDetail(f)}>
                      <TableCell className="font-mono text-xs font-semibold">{f.numero}</TableCell>
                      <TableCell>
                        <div className="font-medium">{f.convenioName}</div>
                        {f.ansCode && <div className="text-xs text-muted-foreground">ANS {f.ansCode}</div>}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{formatCompetencia(f.competencia)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{f.loteIds.length} lote(s)</span>
                      </TableCell>
                      <TableCell className="font-medium">{fmt(f.totalValue)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.dataVencimento
                          ? new Date(f.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Badge variant="outline" className={`text-xs ${cfg.cls}`}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          {f.status === 'pendente' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                              onClick={() => setEnvioFatura(f)}>
                              <SendHorizonal className="h-3 w-3 mr-1" /> Enviar
                            </Button>
                          )}
                          {f.status === 'enviada' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-green-700 border-green-200"
                              onClick={() => { setPagamentoFatura(f); setPagValor(String(f.totalValue)); setPagGlosa('0'); }}>
                              <DollarSign className="h-3 w-3 mr-1" /> Pagar
                            </Button>
                          )}
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                            onClick={() => setFaturaDelete(f.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* ══════════ DIALOGS ══════════ */}

      {/* Criar/editar lote */}
      <Dialog open={loteForm} onOpenChange={(o) => { if (!o) { setLoteForm(false); setLoteEdit(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{loteEdit ? 'Editar Lote' : 'Novo Lote de Faturamento'}</DialogTitle>
            <DialogDescription>Crie um lote para agrupar atendimentos de um convênio e enviá-los para cobrança.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Convênio *</Label>
              <Select value={loteData.convenioId} onValueChange={(v) => setLoteData({ ...loteData, convenioId: v })}
                disabled={!!loteEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência (mês de referência) *</Label>
              <Select value={loteData.competencia} onValueChange={(v) => setLoteData({ ...loteData, competencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{formatCompetencia(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={loteData.observacoes} rows={2}
                onChange={(e) => setLoteData({ ...loteData, observacoes: e.target.value })}
                placeholder="Informações adicionais…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLoteForm(false); setLoteEdit(null); }}>Cancelar</Button>
            <Button onClick={submitLote} className="bg-gradient-primary text-primary-foreground">
              <Save className="h-4 w-4 mr-1" /> {loteEdit ? 'Salvar' : 'Criar Lote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe do lote + itens */}
      <Dialog open={!!loteDetail} onOpenChange={(o) => !o && setLoteDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loteDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Lote {loteDetail.numero} — {loteDetail.convenioName}
                </DialogTitle>
                <DialogDescription className="capitalize">
                  {formatCompetencia(loteDetail.competencia)} · {loteDetail.itemCount} item(s) · {fmt(loteDetail.totalValue)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`gap-1 ${loteStatusCfg[loteDetail.status].cls}`}>
                  {loteStatusCfg[loteDetail.status].icon} {loteStatusCfg[loteDetail.status].label}
                </Badge>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => printLote(loteDetail)}>
                    <Printer className="h-4 w-4" /> Imprimir PDF
                  </Button>
                {loteDetail.status === 'aberto' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700"
                      onClick={() => {
                        // Importa agendamentos finalizados de convênio ainda não enviados ao faturamento
                        const APT_KEY = "nexaclinic_appointments_v3";
                        let apts: any[] = [];
                        try { apts = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]"); } catch { apts = []; }
                        const competencia = loteDetail.competencia; // "YYYY-MM"

                        // IDs já presentes no lote para bloquear duplicidade
                        const idsNoLoteAtual = new Set<string>(
                          (loteDetail.items ?? []).map((i: any) => i.appointmentId).filter(Boolean)
                        );

                        const pending = apts.filter((a: any) => {
                          // Verifica se o convênio do agendamento está marcado como "Faturar"
                          const convsCad: any[] = convenios; // cadastro real (Supabase), já carregado no estado do componente
                          const temFaturarConf = convsCad.some((c: any) => c.faturar === true);
                          if (temFaturarConf) {
                            const conv = convsCad.find((c: any) =>
                              (c.name ?? '').trim().toLowerCase() === (a.insurance ?? '').trim().toLowerCase() ||
                              (c.id ?? '').trim().toLowerCase() === (a.insurance ?? '').trim().toLowerCase()
                            );
                            if (!conv || !conv.faturar) return false;
                          }
                          return (
                            a.insurance === loteDetail.convenioName &&
                            a.status === "finalizado" &&
                            !a.sentToBilling &&
                            typeof a.date === "string" &&
                            a.date.startsWith(competencia) &&
                            !idsNoLoteAtual.has(a.id)
                          );
                        });
                        if (pending.length === 0) {
                          toast.info("Nenhum atendimento pendente de faturamento para este convênio/competência");
                          return;
                        }
                        const profsLocal: any[] = (() => { try { return JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]"); } catch { return []; } })();
                        pending.forEach((a: any) => {
                          billingStorage.addItemToLote(loteDetail.id, {
                            appointmentId: a.id,
                            patientName: a.patientName,
                            patientCpf: a.cpf,
                            carteirinha: a.carteirinha ?? undefined,
                            convenioName: a.insurance,   // ← plano gravado no item
                            procedure: a.procedure ?? "",
                            procedureCode: a.procedureCode ?? undefined,
                            date: a.date,
                            quantity: 1,
                            unitValue: a.procedureValue ?? 0,
                            totalValue: a.procedureValue ?? 0,
                            professionalName: profsLocal.find((p: any) => p.id === a.professionalId)?.name ?? '',
                            authorizationCode: a.authorizationCode ?? undefined,
                            status: "incluido",
                          });
                          // marca sentToBilling no agendamento
                          const saved = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]");
                          const updated = saved.map((x: any) => x.id === a.id ? { ...x, sentToBilling: true } : x);
                          localStorage.setItem(APT_KEY, JSON.stringify(updated));
                        });
                        const refreshed = billingStorage_getLote(loteDetail.id);
                        if (refreshed) setLoteDetail(refreshed);
                        toast.success(`${pending.length} atendimento(s) importado(s) da Agenda`);
                      }}
                    >
                      <Download className="h-4 w-4" /> Importar da Agenda
                    </Button>
                    <Button size="sm" onClick={() => { setItemForm(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar item
                    </Button>
                  </div>
                )}
                </div>
              </div>

              {loteDetail.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                  <ClipboardList className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum item neste lote. Adicione atendimentos para faturar.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                        <TableHead>Paciente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Carteirinha</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Autorização</TableHead>
                        {loteDetail.status === 'aberto' && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loteDetail.items.map((item) => (
                        <TableRow key={item.id} className="text-sm">
                          <TableCell>
                            <div className="font-medium">{item.patientName}</div>
                            {item.patientCpf && <div className="text-xs text-muted-foreground">{item.patientCpf}</div>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">
                              {(item as any).convenioName || loteDetail.convenioName || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.carteirinha || '—'}</TableCell>
                          <TableCell>
                            <div>{item.procedure}</div>
                            {item.procedureCode && <div className="text-xs text-muted-foreground">TUSS {item.procedureCode}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="font-medium">{fmt(item.totalValue)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.authorizationCode || '—'}</TableCell>
                          {loteDetail.status === 'aberto' && (
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  removeItemFromLote(loteDetail.id, item.id);
                                  // Reverte sentToBilling e nexaclinic_repasse_itens se o item veio da Agenda
                                  if (item.appointmentId) {
                                    const APT_KEY = "nexaclinic_appointments_v3";
                                    try {
                                      const apts = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]");
                                      const reverted = apts.map((x: any) =>
                                        x.id === item.appointmentId ? { ...x, sentToBilling: false } : x
                                      );
                                      localStorage.setItem(APT_KEY, JSON.stringify(reverted));
                                    } catch { /* silencioso */ }
                                    // Remove repasse gerado automaticamente para este agendamento
                                    const REPASSE_KEY = "nexaclinic_repasse_itens";
                                    try {
                                      const repItens = JSON.parse(localStorage.getItem(REPASSE_KEY) ?? "[]");
                                      const filtered = repItens.filter((r: any) => r.appointmentId !== item.appointmentId);
                                      localStorage.setItem(REPASSE_KEY, JSON.stringify(filtered));
                                    } catch { /* silencioso */ }
                                  }
                                  const updated = billingStorage_getLote(loteDetail.id);
                                  if (updated) setLoteDetail(updated);
                                }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {loteDetail.status === 'pago' && (
                <div className="rounded-lg border bg-green-50 p-4 text-sm space-y-1">
                  <p className="font-semibold text-green-700">Pagamento recebido</p>
                  <p>Valor pago: <strong>{fmt(loteDetail.valorPago ?? 0)}</strong></p>
                  {(loteDetail.valorGlosado ?? 0) > 0 && (
                    <p className="text-red-600">Glosa: <strong>{fmt(loteDetail.valorGlosado!)}</strong></p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Form item */}
      <Dialog open={itemForm} onOpenChange={(o) => { if (!o) { setItemForm(false); setItemData(emptyItem); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Lote</DialogTitle>
            <DialogDescription>Informe os dados do atendimento a ser faturado.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Paciente *</Label>
              <Input value={itemData.patientName} onChange={(e) => setItemData({ ...itemData, patientName: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={itemData.patientCpf} onChange={(e) => setItemData({ ...itemData, patientCpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="text-xs">Carteirinha</Label>
              <Input value={itemData.carteirinha} onChange={(e) => setItemData({ ...itemData, carteirinha: e.target.value })} placeholder="Nº carteirinha" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Procedimento *</Label>
              <Input value={itemData.procedure} onChange={(e) => setItemData({ ...itemData, procedure: e.target.value })} placeholder="Ex: Consulta Cardiologia" />
            </div>
            <div>
              <Label className="text-xs">Código TUSS</Label>
              <Input value={itemData.procedureCode} onChange={(e) => setItemData({ ...itemData, procedureCode: e.target.value })} placeholder="10101012" />
            </div>
            <div>
              <Label className="text-xs">Código de Autorização</Label>
              <Input value={itemData.authorizationCode} onChange={(e) => setItemData({ ...itemData, authorizationCode: e.target.value })} placeholder="Autorização do plano" />
            </div>
            <div>
              <Label className="text-xs">Data do atendimento</Label>
              <Input type="date" value={itemData.date} onChange={(e) => setItemData({ ...itemData, date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} value={itemData.quantity} onChange={(e) => setItemData({ ...itemData, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Valor unitário (R$)</Label>
              <Input type="number" min={0} step="0.01" value={itemData.unitValue}
                onChange={(e) => setItemData({ ...itemData, unitValue: Number(e.target.value) })} />
            </div>
            <div className="flex items-end">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm w-full">
                Total: <strong>{fmt(Number(itemData.quantity) * Number(itemData.unitValue))}</strong>
              </div>
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Input value={itemData.professionalName} onChange={(e) => setItemData({ ...itemData, professionalName: e.target.value })} placeholder="Nome do profissional" />
            </div>
            <div>
              <Label className="text-xs">CRM/CRO</Label>
              <Input value={itemData.professionalCrm} onChange={(e) => setItemData({ ...itemData, professionalCrm: e.target.value })} placeholder="CRM/SP 123.456" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemForm(false)}>Cancelar</Button>
            <Button onClick={submitItem} className="bg-gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pagamento — lote */}
      <Dialog open={!!pagamentoLote} onOpenChange={(o) => !o && setPagamentoLote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento do Lote</DialogTitle>
            <DialogDescription>{pagamentoLote?.numero} · {pagamentoLote?.convenioName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagValor}
                onChange={(e) => setPagValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor glosado (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagGlosa}
                onChange={(e) => setPagGlosa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagamentoLote(null)}>Cancelar</Button>
            <Button onClick={submitPagamentoLote} className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar fatura */}
      <Dialog open={faturaForm} onOpenChange={(o) => { if (!o) setFaturaForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Nova Fatura</DialogTitle>
            <DialogDescription>Agrupe lotes fechados em uma fatura para envio ao convênio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Convênio *</Label>
              <Select value={faturaData.convenioId}
                onValueChange={(v) => setFaturaData({ ...faturaData, convenioId: v, loteIds: [] })}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência</Label>
              <Select value={faturaData.competencia}
                onValueChange={(v) => setFaturaData({ ...faturaData, competencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{formatCompetencia(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {faturaData.convenioId && (
              <div>
                <Label className="text-xs">Lotes disponíveis *</Label>
                {lotesDisponiveisParaFatura.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum lote disponível para este convênio. Feche um lote primeiro.</p>
                ) : (
                  <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto rounded-lg border p-2">
                    {lotesDisponiveisParaFatura.map(l => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={faturaData.loteIds.includes(l.id)}
                          onChange={(e) => {
                            setFaturaData(prev => ({
                              ...prev,
                              loteIds: e.target.checked
                                ? [...prev.loteIds, l.id]
                                : prev.loteIds.filter(id => id !== l.id),
                            }));
                          }}
                          className="rounded"
                        />
                        <span className="text-sm font-mono">{l.numero}</span>
                        <span className="text-xs text-muted-foreground">{l.itemCount} item(s) · {fmt(l.totalValue)}</span>
                        <Badge variant="outline" className={`ml-auto text-xs ${loteStatusCfg[l.status].cls}`}>
                          {loteStatusCfg[l.status].label}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
                {faturaData.loteIds.length > 0 && (
                  <p className="text-xs font-semibold text-green-700 mt-1">
                    Total selecionado: {fmt(lotes.filter(l => faturaData.loteIds.includes(l.id)).reduce((s, l) => s + l.totalValue, 0))}
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">Data de vencimento</Label>
              <Input type="date" value={faturaData.dataVencimento}
                onChange={(e) => setFaturaData({ ...faturaData, dataVencimento: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={faturaData.observacoes} rows={2}
                onChange={(e) => setFaturaData({ ...faturaData, observacoes: e.target.value })}
                placeholder="Informações adicionais…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFaturaForm(false)}>Cancelar</Button>
            <Button onClick={submitFatura} className="bg-gradient-primary text-primary-foreground">
              <FileText className="h-4 w-4 mr-1" /> Gerar Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar fatura */}
      <Dialog open={!!envioFatura} onOpenChange={(o) => !o && setEnvioFatura(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar Fatura ao Convênio</DialogTitle>
            <DialogDescription>{envioFatura?.numero} · {envioFatura?.convenioName}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Protocolo / número de envio (opcional)</Label>
            <Input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Ex: 2025-PRO-001" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnvioFatura(null)}>Cancelar</Button>
            <Button onClick={submitEnvioFatura} className="bg-gradient-primary text-primary-foreground">
              <SendHorizonal className="h-4 w-4 mr-1" /> Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pagamento — fatura */}
      <Dialog open={!!pagamentoFatura} onOpenChange={(o) => !o && setPagamentoFatura(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento da Fatura</DialogTitle>
            <DialogDescription>{pagamentoFatura?.numero} · {pagamentoFatura?.convenioName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagValor}
                onChange={(e) => setPagValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor glosado (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagGlosa}
                onChange={(e) => setPagGlosa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagamentoFatura(null)}>Cancelar</Button>
            <Button onClick={submitPagamentoFatura} className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe fatura */}
      <Dialog open={!!faturaDetail} onOpenChange={(o) => !o && setFaturaDetail(null)}>
        <DialogContent className="max-w-lg">
          {faturaDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{faturaDetail.numero}</DialogTitle>
                <DialogDescription>{faturaDetail.convenioName} · {formatCompetencia(faturaDetail.competencia)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p className="font-bold">{fmt(faturaDetail.totalValue)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`mt-1 ${faturaStatusCfg[faturaDetail.status].cls}`}>
                      {faturaStatusCfg[faturaDetail.status].label}
                    </Badge>
                  </div>
                  {faturaDetail.dataEnvio && (
                    <div>
                      <p className="text-xs text-muted-foreground">Enviada em</p>
                      <p>{new Date(faturaDetail.dataEnvio).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {faturaDetail.dataPagamento && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paga em</p>
                      <p>{new Date(faturaDetail.dataPagamento).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {faturaDetail.valorPago != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor pago</p>
                      <p className="font-bold text-green-700">{fmt(faturaDetail.valorPago)}</p>
                    </div>
                  )}
                  {(faturaDetail.valorGlosado ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor glosado</p>
                      <p className="font-bold text-red-600">{fmt(faturaDetail.valorGlosado!)}</p>
                    </div>
                  )}
                  {faturaDetail.protocolo && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Protocolo</p>
                      <p className="font-mono">{faturaDetail.protocolo}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Lotes incluídos</p>
                  <div className="space-y-1">
                    {faturaDetail.loteIds.map(lid => {
                      const l = lotes.find(x => x.id === lid);
                      return l ? (
                        <div key={lid} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                          <span className="font-mono font-semibold">{l.numero}</span>
                          <span className="text-muted-foreground">{l.itemCount} item(s)</span>
                          <span className="font-medium">{fmt(l.totalValue)}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão — lote */}
      <AlertDialog open={!!loteDelete} onOpenChange={(o) => !o && setLoteDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lote?</AlertDialogTitle>
            <AlertDialogDescription>Todos os itens serão perdidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (loteDelete) { deleteLote(loteDelete); setLoteDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão — fatura */}
      <AlertDialog open={!!faturaDelete} onOpenChange={(o) => !o && setFaturaDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fatura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (faturaDelete) { deleteFatura(faturaDelete); setFaturaDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Editar / Auditar Guia ────────────────────────────────────────── */}
      <Dialog open={!!guiaEdit} onOpenChange={(o) => { if (!o) setGuiaEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Auditar Guia
            </DialogTitle>
            <DialogDescription>
              Edite os dados da guia para faturamento ao convênio.
            </DialogDescription>
          </DialogHeader>
          {guiaEdit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Paciente</Label>
                  <Input value={guiaEdit.patientName ?? ''} disabled className="bg-muted/40" />
                </div>
                <div>
                  <Label className="text-xs">Convênio</Label>
                  <Input value={guiaEdit.insurance ?? ''} disabled className="bg-muted/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Procedimento</Label>
                  <Input value={guiaEdit.procedure ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedure: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Código TUSS</Label>
                  <Input value={guiaEdit.procedureCode ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedureCode: e.target.value })} placeholder="Ex: 10101012" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Carteirinha</Label>
                  <Input value={guiaEdit.carteirinha ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, carteirinha: e.target.value })} placeholder="Número da carteirinha" />
                </div>
                <div>
                  <Label className="text-xs">Autorização</Label>
                  <Input value={guiaEdit.authorizationCode ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, authorizationCode: e.target.value })} placeholder="Código de autorização" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" value={guiaEdit.procedureValue ?? 0} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedureValue: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Guia</Label>
                  <Select value={guiaEdit.tipoGuia ?? 'consulta'} onValueChange={(v) => setGuiaEdit({ ...guiaEdit, tipoGuia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="sadt">SADT</SelectItem>
                      <SelectItem value="honorarios">Honorários</SelectItem>
                      <SelectItem value="internacao">Internação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border p-2 bg-muted/30">
                <input type="checkbox" id="guiaCompleta" checked={!!guiaEdit.guiaCompleta}
                  onChange={(e) => setGuiaEdit({ ...guiaEdit, guiaCompleta: e.target.checked })} />
                <Label htmlFor="guiaCompleta" className="text-xs cursor-pointer">Guia completa (pronta para faturar)</Label>
              </div>
              <div>
                <Label className="text-xs">Observação de Auditoria</Label>
                <Textarea value={guiaEdit.auditoriaObs ?? ''} rows={2}
                  onChange={(e) => setGuiaEdit({ ...guiaEdit, auditoriaObs: e.target.value })}
                  placeholder="Notas de auditoria ou divergências encontradas…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGuiaEdit(null)}>Cancelar</Button>
            <Button onClick={() => salvarGuia(guiaEdit)} className="bg-gradient-primary text-primary-foreground">
              <Save className="h-4 w-4 mr-1" /> Salvar Guia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Gerar Fatura (filtro + seleção) ─────────────────────────────── */}

      <Dialog open={loteForm} onOpenChange={(o) => { if (!o) { setLoteForm(false); setLoteEdit(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{loteEdit ? 'Editar Lote' : 'Novo Lote de Faturamento'}</DialogTitle>
            <DialogDescription>Crie um lote para agrupar atendimentos de um convênio e enviá-los para cobrança.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Convênio *</Label>
              <Select value={loteData.convenioId} onValueChange={(v) => setLoteData({ ...loteData, convenioId: v })}
                disabled={!!loteEdit}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência (mês de referência) *</Label>
              <Select value={loteData.competencia} onValueChange={(v) => setLoteData({ ...loteData, competencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{formatCompetencia(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={loteData.observacoes} rows={2}
                onChange={(e) => setLoteData({ ...loteData, observacoes: e.target.value })}
                placeholder="Informações adicionais…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setLoteForm(false); setLoteEdit(null); }}>Cancelar</Button>
            <Button onClick={submitLote} className="bg-gradient-primary text-primary-foreground">
              <Save className="h-4 w-4 mr-1" /> {loteEdit ? 'Salvar' : 'Criar Lote'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe do lote + itens */}
      <Dialog open={!!loteDetail} onOpenChange={(o) => !o && setLoteDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loteDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Lote {loteDetail.numero} — {loteDetail.convenioName}
                </DialogTitle>
                <DialogDescription className="capitalize">
                  {formatCompetencia(loteDetail.competencia)} · {loteDetail.itemCount} item(s) · {fmt(loteDetail.totalValue)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between">
                <Badge variant="outline" className={`gap-1 ${loteStatusCfg[loteDetail.status].cls}`}>
                  {loteStatusCfg[loteDetail.status].icon} {loteStatusCfg[loteDetail.status].label}
                </Badge>
                <div className="flex gap-2 flex-wrap justify-end">
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => printLote(loteDetail)}>
                    <Printer className="h-4 w-4" /> Imprimir PDF
                  </Button>
                {loteDetail.status === 'aberto' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700"
                      onClick={() => {
                        // Importa agendamentos finalizados de convênio ainda não enviados ao faturamento
                        const APT_KEY = "nexaclinic_appointments_v3";
                        let apts: any[] = [];
                        try { apts = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]"); } catch { apts = []; }
                        const competencia = loteDetail.competencia; // "YYYY-MM"

                        // IDs já presentes no lote para bloquear duplicidade
                        const idsNoLoteAtual = new Set<string>(
                          (loteDetail.items ?? []).map((i: any) => i.appointmentId).filter(Boolean)
                        );

                        const pending = apts.filter((a: any) => {
                          // Verifica se o convênio do agendamento está marcado como "Faturar"
                          const convsCad: any[] = convenios; // cadastro real (Supabase), já carregado no estado do componente
                          const temFaturarConf = convsCad.some((c: any) => c.faturar === true);
                          if (temFaturarConf) {
                            const conv = convsCad.find((c: any) =>
                              (c.name ?? '').trim().toLowerCase() === (a.insurance ?? '').trim().toLowerCase() ||
                              (c.id ?? '').trim().toLowerCase() === (a.insurance ?? '').trim().toLowerCase()
                            );
                            if (!conv || !conv.faturar) return false;
                          }
                          return (
                            a.insurance === loteDetail.convenioName &&
                            a.status === "finalizado" &&
                            !a.sentToBilling &&
                            typeof a.date === "string" &&
                            a.date.startsWith(competencia) &&
                            !idsNoLoteAtual.has(a.id)
                          );
                        });
                        if (pending.length === 0) {
                          toast.info("Nenhum atendimento pendente de faturamento para este convênio/competência");
                          return;
                        }
                        const profsLocal: any[] = (() => { try { return JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]"); } catch { return []; } })();
                        pending.forEach((a: any) => {
                          billingStorage.addItemToLote(loteDetail.id, {
                            appointmentId: a.id,
                            patientName: a.patientName,
                            patientCpf: a.cpf,
                            carteirinha: a.carteirinha ?? undefined,
                            convenioName: a.insurance,   // ← plano gravado no item
                            procedure: a.procedure ?? "",
                            procedureCode: a.procedureCode ?? undefined,
                            date: a.date,
                            quantity: 1,
                            unitValue: a.procedureValue ?? 0,
                            totalValue: a.procedureValue ?? 0,
                            professionalName: profsLocal.find((p: any) => p.id === a.professionalId)?.name ?? '',
                            authorizationCode: a.authorizationCode ?? undefined,
                            status: "incluido",
                          });
                          // marca sentToBilling no agendamento
                          const saved = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]");
                          const updated = saved.map((x: any) => x.id === a.id ? { ...x, sentToBilling: true } : x);
                          localStorage.setItem(APT_KEY, JSON.stringify(updated));
                        });
                        const refreshed = billingStorage_getLote(loteDetail.id);
                        if (refreshed) setLoteDetail(refreshed);
                        toast.success(`${pending.length} atendimento(s) importado(s) da Agenda`);
                      }}
                    >
                      <Download className="h-4 w-4" /> Importar da Agenda
                    </Button>
                    <Button size="sm" onClick={() => { setItemForm(true); }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar item
                    </Button>
                  </div>
                )}
                </div>
              </div>

              {loteDetail.items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                  <ClipboardList className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum item neste lote. Adicione atendimentos para faturar.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                        <TableHead>Paciente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Carteirinha</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Autorização</TableHead>
                        {loteDetail.status === 'aberto' && <TableHead />}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loteDetail.items.map((item) => (
                        <TableRow key={item.id} className="text-sm">
                          <TableCell>
                            <div className="font-medium">{item.patientName}</div>
                            {item.patientCpf && <div className="text-xs text-muted-foreground">{item.patientCpf}</div>}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">
                              {(item as any).convenioName || loteDetail.convenioName || '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.carteirinha || '—'}</TableCell>
                          <TableCell>
                            <div>{item.procedure}</div>
                            {item.procedureCode && <div className="text-xs text-muted-foreground">TUSS {item.procedureCode}</div>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(item.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell className="font-medium">{fmt(item.totalValue)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.authorizationCode || '—'}</TableCell>
                          {loteDetail.status === 'aberto' && (
                            <TableCell>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                onClick={() => {
                                  removeItemFromLote(loteDetail.id, item.id);
                                  // Reverte sentToBilling e nexaclinic_repasse_itens se o item veio da Agenda
                                  if (item.appointmentId) {
                                    const APT_KEY = "nexaclinic_appointments_v3";
                                    try {
                                      const apts = JSON.parse(localStorage.getItem(APT_KEY) ?? "[]");
                                      const reverted = apts.map((x: any) =>
                                        x.id === item.appointmentId ? { ...x, sentToBilling: false } : x
                                      );
                                      localStorage.setItem(APT_KEY, JSON.stringify(reverted));
                                    } catch { /* silencioso */ }
                                    // Remove repasse gerado automaticamente para este agendamento
                                    const REPASSE_KEY = "nexaclinic_repasse_itens";
                                    try {
                                      const repItens = JSON.parse(localStorage.getItem(REPASSE_KEY) ?? "[]");
                                      const filtered = repItens.filter((r: any) => r.appointmentId !== item.appointmentId);
                                      localStorage.setItem(REPASSE_KEY, JSON.stringify(filtered));
                                    } catch { /* silencioso */ }
                                  }
                                  const updated = billingStorage_getLote(loteDetail.id);
                                  if (updated) setLoteDetail(updated);
                                }}>
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {loteDetail.status === 'pago' && (
                <div className="rounded-lg border bg-green-50 p-4 text-sm space-y-1">
                  <p className="font-semibold text-green-700">Pagamento recebido</p>
                  <p>Valor pago: <strong>{fmt(loteDetail.valorPago ?? 0)}</strong></p>
                  {(loteDetail.valorGlosado ?? 0) > 0 && (
                    <p className="text-red-600">Glosa: <strong>{fmt(loteDetail.valorGlosado!)}</strong></p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Form item */}
      <Dialog open={itemForm} onOpenChange={(o) => { if (!o) { setItemForm(false); setItemData(emptyItem); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Item ao Lote</DialogTitle>
            <DialogDescription>Informe os dados do atendimento a ser faturado.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Paciente *</Label>
              <Input value={itemData.patientName} onChange={(e) => setItemData({ ...itemData, patientName: e.target.value })} placeholder="Nome completo" />
            </div>
            <div>
              <Label className="text-xs">CPF</Label>
              <Input value={itemData.patientCpf} onChange={(e) => setItemData({ ...itemData, patientCpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label className="text-xs">Carteirinha</Label>
              <Input value={itemData.carteirinha} onChange={(e) => setItemData({ ...itemData, carteirinha: e.target.value })} placeholder="Nº carteirinha" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Procedimento *</Label>
              <Input value={itemData.procedure} onChange={(e) => setItemData({ ...itemData, procedure: e.target.value })} placeholder="Ex: Consulta Cardiologia" />
            </div>
            <div>
              <Label className="text-xs">Código TUSS</Label>
              <Input value={itemData.procedureCode} onChange={(e) => setItemData({ ...itemData, procedureCode: e.target.value })} placeholder="10101012" />
            </div>
            <div>
              <Label className="text-xs">Código de Autorização</Label>
              <Input value={itemData.authorizationCode} onChange={(e) => setItemData({ ...itemData, authorizationCode: e.target.value })} placeholder="Autorização do plano" />
            </div>
            <div>
              <Label className="text-xs">Data do atendimento</Label>
              <Input type="date" value={itemData.date} onChange={(e) => setItemData({ ...itemData, date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input type="number" min={1} value={itemData.quantity} onChange={(e) => setItemData({ ...itemData, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">Valor unitário (R$)</Label>
              <Input type="number" min={0} step="0.01" value={itemData.unitValue}
                onChange={(e) => setItemData({ ...itemData, unitValue: Number(e.target.value) })} />
            </div>
            <div className="flex items-end">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm w-full">
                Total: <strong>{fmt(Number(itemData.quantity) * Number(itemData.unitValue))}</strong>
              </div>
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Input value={itemData.professionalName} onChange={(e) => setItemData({ ...itemData, professionalName: e.target.value })} placeholder="Nome do profissional" />
            </div>
            <div>
              <Label className="text-xs">CRM/CRO</Label>
              <Input value={itemData.professionalCrm} onChange={(e) => setItemData({ ...itemData, professionalCrm: e.target.value })} placeholder="CRM/SP 123.456" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setItemForm(false)}>Cancelar</Button>
            <Button onClick={submitItem} className="bg-gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pagamento — lote */}
      <Dialog open={!!pagamentoLote} onOpenChange={(o) => !o && setPagamentoLote(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento do Lote</DialogTitle>
            <DialogDescription>{pagamentoLote?.numero} · {pagamentoLote?.convenioName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagValor}
                onChange={(e) => setPagValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor glosado (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagGlosa}
                onChange={(e) => setPagGlosa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagamentoLote(null)}>Cancelar</Button>
            <Button onClick={submitPagamentoLote} className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Criar fatura */}
      <Dialog open={faturaForm} onOpenChange={(o) => { if (!o) setFaturaForm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Nova Fatura</DialogTitle>
            <DialogDescription>Agrupe lotes fechados em uma fatura para envio ao convênio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Convênio *</Label>
              <Select value={faturaData.convenioId}
                onValueChange={(v) => setFaturaData({ ...faturaData, convenioId: v, loteIds: [] })}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Competência</Label>
              <Select value={faturaData.competencia}
                onValueChange={(v) => setFaturaData({ ...faturaData, competencia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {competencias.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{formatCompetencia(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {faturaData.convenioId && (
              <div>
                <Label className="text-xs">Lotes disponíveis *</Label>
                {lotesDisponiveisParaFatura.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Nenhum lote disponível para este convênio. Feche um lote primeiro.</p>
                ) : (
                  <div className="mt-1 space-y-1.5 max-h-40 overflow-y-auto rounded-lg border p-2">
                    {lotesDisponiveisParaFatura.map(l => (
                      <label key={l.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={faturaData.loteIds.includes(l.id)}
                          onChange={(e) => {
                            setFaturaData(prev => ({
                              ...prev,
                              loteIds: e.target.checked
                                ? [...prev.loteIds, l.id]
                                : prev.loteIds.filter(id => id !== l.id),
                            }));
                          }}
                          className="rounded"
                        />
                        <span className="text-sm font-mono">{l.numero}</span>
                        <span className="text-xs text-muted-foreground">{l.itemCount} item(s) · {fmt(l.totalValue)}</span>
                        <Badge variant="outline" className={`ml-auto text-xs ${loteStatusCfg[l.status].cls}`}>
                          {loteStatusCfg[l.status].label}
                        </Badge>
                      </label>
                    ))}
                  </div>
                )}
                {faturaData.loteIds.length > 0 && (
                  <p className="text-xs font-semibold text-green-700 mt-1">
                    Total selecionado: {fmt(lotes.filter(l => faturaData.loteIds.includes(l.id)).reduce((s, l) => s + l.totalValue, 0))}
                  </p>
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">Data de vencimento</Label>
              <Input type="date" value={faturaData.dataVencimento}
                onChange={(e) => setFaturaData({ ...faturaData, dataVencimento: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={faturaData.observacoes} rows={2}
                onChange={(e) => setFaturaData({ ...faturaData, observacoes: e.target.value })}
                placeholder="Informações adicionais…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFaturaForm(false)}>Cancelar</Button>
            <Button onClick={submitFatura} className="bg-gradient-primary text-primary-foreground">
              <FileText className="h-4 w-4 mr-1" /> Gerar Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enviar fatura */}
      <Dialog open={!!envioFatura} onOpenChange={(o) => !o && setEnvioFatura(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar Fatura ao Convênio</DialogTitle>
            <DialogDescription>{envioFatura?.numero} · {envioFatura?.convenioName}</DialogDescription>
          </DialogHeader>
          <div>
            <Label className="text-xs">Protocolo / número de envio (opcional)</Label>
            <Input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} placeholder="Ex: 2025-PRO-001" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEnvioFatura(null)}>Cancelar</Button>
            <Button onClick={submitEnvioFatura} className="bg-gradient-primary text-primary-foreground">
              <SendHorizonal className="h-4 w-4 mr-1" /> Confirmar envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pagamento — fatura */}
      <Dialog open={!!pagamentoFatura} onOpenChange={(o) => !o && setPagamentoFatura(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento da Fatura</DialogTitle>
            <DialogDescription>{pagamentoFatura?.numero} · {pagamentoFatura?.convenioName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagValor}
                onChange={(e) => setPagValor(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor glosado (R$)</Label>
              <Input type="number" min={0} step="0.01" value={pagGlosa}
                onChange={(e) => setPagGlosa(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPagamentoFatura(null)}>Cancelar</Button>
            <Button onClick={submitPagamentoFatura} className="bg-green-600 text-white hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalhe fatura */}
      <Dialog open={!!faturaDetail} onOpenChange={(o) => !o && setFaturaDetail(null)}>
        <DialogContent className="max-w-lg">
          {faturaDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{faturaDetail.numero}</DialogTitle>
                <DialogDescription>{faturaDetail.convenioName} · {formatCompetencia(faturaDetail.competencia)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p className="font-bold">{fmt(faturaDetail.totalValue)}</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={`mt-1 ${faturaStatusCfg[faturaDetail.status].cls}`}>
                      {faturaStatusCfg[faturaDetail.status].label}
                    </Badge>
                  </div>
                  {faturaDetail.dataEnvio && (
                    <div>
                      <p className="text-xs text-muted-foreground">Enviada em</p>
                      <p>{new Date(faturaDetail.dataEnvio).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {faturaDetail.dataPagamento && (
                    <div>
                      <p className="text-xs text-muted-foreground">Paga em</p>
                      <p>{new Date(faturaDetail.dataPagamento).toLocaleDateString('pt-BR')}</p>
                    </div>
                  )}
                  {faturaDetail.valorPago != null && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor pago</p>
                      <p className="font-bold text-green-700">{fmt(faturaDetail.valorPago)}</p>
                    </div>
                  )}
                  {(faturaDetail.valorGlosado ?? 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">Valor glosado</p>
                      <p className="font-bold text-red-600">{fmt(faturaDetail.valorGlosado!)}</p>
                    </div>
                  )}
                  {faturaDetail.protocolo && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Protocolo</p>
                      <p className="font-mono">{faturaDetail.protocolo}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Lotes incluídos</p>
                  <div className="space-y-1">
                    {faturaDetail.loteIds.map(lid => {
                      const l = lotes.find(x => x.id === lid);
                      return l ? (
                        <div key={lid} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                          <span className="font-mono font-semibold">{l.numero}</span>
                          <span className="text-muted-foreground">{l.itemCount} item(s)</span>
                          <span className="font-medium">{fmt(l.totalValue)}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão — lote */}
      <AlertDialog open={!!loteDelete} onOpenChange={(o) => !o && setLoteDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lote?</AlertDialogTitle>
            <AlertDialogDescription>Todos os itens serão perdidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (loteDelete) { deleteLote(loteDelete); setLoteDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar exclusão — fatura */}
      <AlertDialog open={!!faturaDelete} onOpenChange={(o) => !o && setFaturaDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover fatura?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (faturaDelete) { deleteFatura(faturaDelete); setFaturaDelete(null); } }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Editar / Auditar Guia ────────────────────────────────────────── */}
      <Dialog open={!!guiaEdit} onOpenChange={(o) => { if (!o) setGuiaEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Auditar Guia
            </DialogTitle>
            <DialogDescription>
              Edite os dados da guia para faturamento ao convênio.
            </DialogDescription>
          </DialogHeader>
          {guiaEdit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Paciente</Label>
                  <Input value={guiaEdit.patientName ?? ''} disabled className="bg-muted/40" />
                </div>
                <div>
                  <Label className="text-xs">Convênio</Label>
                  <Input value={guiaEdit.insurance ?? ''} disabled className="bg-muted/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Procedimento</Label>
                  <Input value={guiaEdit.procedure ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedure: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Código TUSS</Label>
                  <Input value={guiaEdit.procedureCode ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedureCode: e.target.value })} placeholder="Ex: 10101012" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Carteirinha</Label>
                  <Input value={guiaEdit.carteirinha ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, carteirinha: e.target.value })} placeholder="Número da carteirinha" />
                </div>
                <div>
                  <Label className="text-xs">Autorização</Label>
                  <Input value={guiaEdit.authorizationCode ?? ''} onChange={(e) => setGuiaEdit({ ...guiaEdit, authorizationCode: e.target.value })} placeholder="Código de autorização" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" value={guiaEdit.procedureValue ?? 0} onChange={(e) => setGuiaEdit({ ...guiaEdit, procedureValue: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Tipo de Guia</Label>
                  <Select value={guiaEdit.tipoGuia ?? 'consulta'} onValueChange={(v) => setGuiaEdit({ ...guiaEdit, tipoGuia: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consulta">Consulta</SelectItem>
                      <SelectItem value="sadt">SADT</SelectItem>
                      <SelectItem value="honorarios">Honorários</SelectItem>
                      <SelectItem value="internacao">Internação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded border p-2 bg-muted/30">
                <input type="checkbox" id="guiaCompleta" checked={!!guiaEdit.guiaCompleta}
                  onChange={(e) => setGuiaEdit({ ...guiaEdit, guiaCompleta: e.target.checked })} />
                <Label htmlFor="guiaCompleta" className="text-xs cursor-pointer">Guia completa (pronta para faturar)</Label>
              </div>
              <div>
                <Label className="text-xs">Observação de Auditoria</Label>
                <Textarea value={guiaEdit.auditoriaObs ?? ''} rows={2}
                  onChange={(e) => setGuiaEdit({ ...guiaEdit, auditoriaObs: e.target.value })}
                  placeholder="Notas de auditoria ou divergências encontradas…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGuiaEdit(null)}>Cancelar</Button>
            <Button onClick={() => salvarGuia(guiaEdit)} className="bg-gradient-primary text-primary-foreground">
              <Save className="h-4 w-4 mr-1" /> Salvar Guia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Gerar Fatura (filtro + seleção) ─────────────────────────────── */}
      <Dialog open={gerarFaturaOpen} onOpenChange={(o) => { if (!o) setGerarFaturaOpen(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Gerar Fatura — Controle de Guias
            </DialogTitle>
            <DialogDescription>
              Filtre as guias, selecione as que deseja faturar e clique em Gerar Lote.
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-3 border rounded-lg p-4 bg-muted/20">
            <div>
              <Label className="text-xs">Convênio</Label>
              <Select value={gfConvenioNome || 'todos_convenios'} onValueChange={(v) => {
                const valor = v === 'todos_convenios' ? '' : v;
                setGfConvenioNome(valor);
                const c = convenios.find((x: any) => x.name === valor);
                setGfConvenioId((c as any)?.id ?? '');
              }}>
                <SelectTrigger><SelectValue placeholder="Todos os convênios" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos_convenios">Todos os convênios</SelectItem>
                  {[...new Set(guias.map((g) => g.insurance))].map((ins: any) => (
                    <SelectItem key={ins} value={ins}>{ins}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Profissional</Label>
              <Select value={gfProfissional || 'todos_profissionais'} onValueChange={(v) => setGfProfissional(v === 'todos_profissionais' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos_profissionais">Todos</SelectItem>
                  {profissionais.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Período — De</Label>
              <Input type="date" value={gfPeriodoInicio} onChange={(e) => setGfPeriodoInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Período — Até</Label>
              <Input type="date" value={gfPeriodoFim} onChange={(e) => setGfPeriodoFim(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Status do Atendimento</Label>
              <Select value={gfStatus} onValueChange={setGfStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="finalizado">Finalizado</SelectItem>
                  <SelectItem value="em_atendimento">Em atendimento</SelectItem>
                  <SelectItem value="agendado">Agendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de Guia</Label>
              <Select value={gfTipoGuia} onValueChange={setGfTipoGuia}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="sadt">SADT</SelectItem>
                  <SelectItem value="honorarios">Honorários</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="gfGuiaCompleta" checked={gfGuiaCompleta}
                onChange={(e) => setGfGuiaCompleta(e.target.checked)} />
              <Label htmlFor="gfGuiaCompleta" className="text-xs cursor-pointer">Somente guias marcadas como completas</Label>
            </div>
          </div>

          <Button onClick={pesquisarGuias} className="w-full gap-2">
            <Search className="h-4 w-4" /> Pesquisar
          </Button>

          {/* Resultados */}
          {gfBuscou && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{gfResultados.length} guia(s) encontrada(s)</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setGfSelecionadas(gfResultados.map((g) => g.id))}>
                    Selecionar todas
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs"
                    onClick={() => setGfSelecionadas([])}>
                    Limpar
                  </Button>
                </div>
              </div>
              {gfResultados.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhuma guia encontrada com esses filtros.</p>
              ) : (
                <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Procedimento</TableHead>
                        <TableHead>Convênio</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Faturado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gfResultados.map((g) => (
                        <TableRow key={g.id} className={`cursor-pointer ${gfSelecionadas.includes(g.id) ? 'bg-primary/5' : ''}`}
                          onClick={() => setGfSelecionadas((prev) =>
                            prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id]
                          )}>
                          <TableCell>
                            <input type="checkbox" readOnly checked={gfSelecionadas.includes(g.id)} className="pointer-events-none" />
                          </TableCell>
                          <TableCell className="text-xs">{g.date ? new Date(g.date + 'T12:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{g.patientName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{g.procedure}</TableCell>
                          <TableCell className="text-xs">{g.insurance}</TableCell>
                          <TableCell className="text-right text-sm font-semibold">{fmt(g.procedureValue ?? 0)}</TableCell>
                          <TableCell>
                            {g.sentToBilling
                              ? <Badge variant="outline" className="text-xs border-purple-200 bg-purple-50 text-purple-700">Sim</Badge>
                              : <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">Não</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {gfSelecionadas.length > 0 && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-bold text-primary">{gfSelecionadas.length}</span> guia(s) selecionada(s) · Total:{' '}
                    <span className="font-bold">
                      {fmt(gfResultados.filter((g) => gfSelecionadas.includes(g.id)).reduce((s, g) => s + (g.procedureValue ?? 0), 0))}
                    </span>
                  </div>
                  <Button onClick={gerarFaturaDosFiltros} className="bg-gradient-primary text-primary-foreground gap-2">
                    <Layers className="h-4 w-4" /> Gerar Lote
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setGerarFaturaOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Diálogo opcional: Gerar TISS ─────────────────────────────────── */}
      <Dialog open={!!tissDialog} onOpenChange={(o) => { if (!o) setTissDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCog className="h-5 w-5 text-primary" />
              Gerar TISS para este lote?
            </DialogTitle>
            <DialogDescription>
              {tissDialog?.acao === 'fechar'
                ? 'O lote foi fechado com sucesso.'
                : 'O lote foi marcado como enviado.'}
              {' '}Deseja gerar o XML TISS (padrão ANS) para envio à operadora?
              Esta etapa é <strong>opcional</strong> — você pode fazer isso depois pela tela de TISS.
            </DialogDescription>
          </DialogHeader>
          {tissDialog && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Lote:</span> {tissDialog.lote.numero}</div>
              <div><span className="text-muted-foreground">Convênio:</span> {tissDialog.lote.convenioName}</div>
              <div><span className="text-muted-foreground">Competência:</span> {formatCompetencia(tissDialog.lote.competencia)}</div>
              <div><span className="text-muted-foreground">Itens:</span> {tissDialog.lote.itemCount}</div>
              <div><span className="text-muted-foreground">Total:</span> {fmt(tissDialog.lote.totalValue)}</div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTissDialog(null)}>
              Agora não
            </Button>
            <Button onClick={gerarTISS} disabled={tissLoading} className="gap-2">
              {tissLoading
                ? <><span className="animate-spin">⏳</span> Gerando...</>
                : <><FileCog className="h-4 w-4" /> Gerar XML TISS</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}