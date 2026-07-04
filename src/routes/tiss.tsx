'use client';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  FileCode2, Send, CheckCircle2, AlertCircle, Clock, RefreshCw,
  Download, Eye, Trash2, Plus, Search, Building2, Shield,
  ClipboardCheck, PackageCheck, XCircle, ChevronRight,
  Settings, Info, Copy, FileWarning, BadgeCheck, Wifi,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useTISS } from '@/hooks/useTISS';
import type {
  LoteTISS, ConfiguracaoTISS, ProtocoloRecebimento,
  GuiaTISS, GuiaConsulta, GuiaSADT, DadosBeneficiario,
  DadosProfissional, ItemProcedimento,
} from '@/lib/tiss/tiss-types';
import { GLOSA_DESCRICAO } from '@/lib/tiss/tiss-types';

export const Route = createFileRoute('/tiss')({
  head: () => ({ meta: [{ title: 'TISS Eletrônico — NexaClinic' }] }),
  component: TISSPage,
});

// ─── Helpers visuais ──────────────────────────────────────────────────────────

const situacaoCfg: Record<LoteTISS['situacao'], { label: string; cls: string; icon: React.ReactNode }> = {
  gerado:     { label: 'Gerado',     cls: 'border-slate-200 bg-slate-50 text-slate-600',      icon: <FileCode2 className="h-3 w-3" /> },
  validado:   { label: 'Validado',   cls: 'border-blue-200 bg-blue-50 text-blue-700',         icon: <BadgeCheck className="h-3 w-3" /> },
  enviado:    { label: 'Enviado',    cls: 'border-purple-200 bg-purple-50 text-purple-700',   icon: <Send className="h-3 w-3" /> },
  recebido:   { label: 'Recebido',   cls: 'border-cyan-200 bg-cyan-50 text-cyan-700',         icon: <PackageCheck className="h-3 w-3" /> },
  processado: { label: 'Processado', cls: 'border-green-200 bg-green-50 text-green-700',      icon: <CheckCircle2 className="h-3 w-3" /> },
  erro:       { label: 'Com Erro',   cls: 'border-red-200 bg-red-50 text-red-700',            icon: <AlertCircle className="h-3 w-3" /> },
};

const situacaoProtocoloCfg: Record<ProtocoloRecebimento['situacao'], { label: string; cls: string }> = {
  processado:              { label: 'Processado',                cls: 'border-green-200 bg-green-50 text-green-700' },
  processadoComPendencia:  { label: 'Proc. c/ Pendência',        cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  naoProcessado:           { label: 'Não Processado',            cls: 'border-red-200 bg-red-50 text-red-700' },
  emProcessamento:         { label: 'Em Processamento',          cls: 'border-blue-200 bg-blue-50 text-blue-700' },
};

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Convênios (Supabase — cache compartilhado, ver @/lib/agendaData) ──────────
async function fetchConveniosTISS(): Promise<{ id: string; name: string; ansCode?: string }[]> {
  try {
    const { listarConvenios } = await import('@/lib/agendaData');
    const list = await listarConvenios();
    return (list as any[]).filter((c) => c.status === 'ativo').map((c) => ({ id: c.id, name: c.name, ansCode: c.ansCode }));
  } catch { return []; }
}

// ─── Componente principal ─────────────────────────────────────────────────────
function TISSPage() {
  const {
    lotes, protocolos, stats, config, loading,
    criarLoteDoFaturamento, revalidarLote, enviarLote,
    registrarProtocolo, deletarLote, salvarConfig,
    fazerDownloadXML, visualizarXML,
  } = useTISS();

  const [tab, setTab] = useState<'lotes' | 'protocolos' | 'configuracao'>('lotes');
  const [q, setQ] = useState('');
  const [convenios, setConvenios] = useState<{ id: string; name: string; ansCode?: string }[]>([]);
  useEffect(() => { fetchConveniosTISS().then(setConvenios); }, []);

  // ─── Dialogs state ────────────────────────────────────────────────────────
  const [novoLoteOpen, setNovoLoteOpen] = useState(false);
  const [detalheOpen, setDetalheOpen] = useState<LoteTISS | null>(null);
  const [xmlOpen, setXmlOpen] = useState<string>('');
  const [xmlLoteNome, setXmlLoteNome] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [protocoloOpen, setProtocoloOpen] = useState<LoteTISS | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [errosOpen, setErrosOpen] = useState<LoteTISS | null>(null);

  // ─── Form novo lote ───────────────────────────────────────────────────────
  const emptyLote = { convenioId: '', tipoGuia: 'guiaConsulta' as GuiaTISS['tipo'] };
  const [loteForm, setLoteForm] = useState(emptyLote);

  // ─── Form guia simples (para demo/criar lote com 1 guia de consulta) ─────
  const emptyGuia = {
    numeroGuia: '',
    dataAtendimento: new Date().toISOString().substring(0, 10),
    numeroAutorizacao: '',
    senhaAutorizacao: '',
    // Beneficiário
    carteirinha: '',
    nomePaciente: '',
    dataNascimento: '',
    // Profissional
    profNome: '',
    profCpf: '',
    profCrm: '',
    profUf: 'SP',
    profConselho: 'CRM' as DadosProfissional['conselho'],
    // Procedimento
    codigoTUSS: '',
    descricaoProcedimento: '',
    quantidade: '1',
    valorUnitario: '',
    observacao: '',
  };
  const [guiaForm, setGuiaForm] = useState(emptyGuia);

  // ─── Form configuração ────────────────────────────────────────────────────
  const [configForm, setConfigForm] = useState<ConfiguracaoTISS>(config);
  useEffect(() => { setConfigForm(config); }, [config]);

  // ─── Form protocolo ───────────────────────────────────────────────────────
  const emptyProt = {
    protocolo: '',
    situacao: 'processado' as ProtocoloRecebimento['situacao'],
    mensagem: '',
    totalGuias: '',
    totalGuiasProcessadas: '',
    totalGuiasComErro: '',
    valorProcessado: '',
  };
  const [protForm, setProtForm] = useState(emptyProt);

  // ─── Filtragem ────────────────────────────────────────────────────────────
  const lotesFiltrados = lotes.filter((l) =>
    !q ||
    l.convenioNome.toLowerCase().includes(q.toLowerCase()) ||
    l.numeroLote.includes(q) ||
    l.protocolo?.includes(q)
  );

  // ─── Criar lote ───────────────────────────────────────────────────────────
  function handleCriarLote() {
    const conv = convenios.find((c: any) => c.id === loteForm.convenioId);
    if (!conv) { toast.error('Selecione um convênio'); return; }

    const val = parseFloat(guiaForm.valorUnitario) || 0;
    const qtd = parseInt(guiaForm.quantidade) || 1;

    const beneficiario: DadosBeneficiario = {
      numeroCarteirinha: guiaForm.carteirinha,
      nome: guiaForm.nomePaciente,
      dataNascimento: guiaForm.dataNascimento,
    };

    const profissional: DadosProfissional = {
      nome: guiaForm.profNome,
      cpf: guiaForm.profCpf,
      crm: guiaForm.profCrm,
      uf: guiaForm.profUf,
      conselho: guiaForm.profConselho,
      grauParticipacao: '00',
    };

    const procedimento: ItemProcedimento = {
      codigoTUSS: guiaForm.codigoTUSS,
      descricao: guiaForm.descricaoProcedimento,
      quantidade: qtd,
      valorUnitario: val,
      valorTotal: val * qtd,
    };

    const guia: GuiaConsulta = {
      tipo: 'guiaConsulta',
      numeroGuia: guiaForm.numeroGuia || `G${Date.now()}`,
      dataAtendimento: guiaForm.dataAtendimento,
      numeroAutorizacao: guiaForm.numeroAutorizacao || undefined,
      senhaAutorizacao: guiaForm.senhaAutorizacao || undefined,
      beneficiario,
      profissionalExecutante: profissional,
      procedimento,
      observacao: guiaForm.observacao || undefined,
    };

    const lote = criarLoteDoFaturamento({
      loteId: '',
      convenioId: conv.id,
      convenioNome: conv.name,
      convenioANS: conv.ansCode ?? '',
      competencia: guiaForm.dataAtendimento.substring(0, 7),
      prestadora: config.prestadora,
      guias: [guia],
      totalProcedimentos: 1,
      valorTotal: val * qtd,
      dataGeracao: new Date().toISOString(),
    });

    setNovoLoteOpen(false);
    setLoteForm(emptyLote);
    setGuiaForm(emptyGuia);

    const temErros = lote.errosValidacao.some((e) => e.severity === 'error');
    if (temErros) {
      toast.warning(`Lote criado com ${lote.errosValidacao.filter((e) => e.severity === 'error').length} erro(s) de validação`);
    } else {
      toast.success('Lote TISS criado e validado com sucesso!');
    }
  }

  // ─── Enviar lote ──────────────────────────────────────────────────────────
  async function handleEnviar(id: string) {
    const result = await enviarLote(id);
    if (result.ok) {
      toast.success(result.mensagem);
    } else {
      toast.error(result.mensagem);
    }
  }

  // ─── Registrar protocolo ──────────────────────────────────────────────────
  function handleRegistrarProtocolo() {
    if (!protocoloOpen) return;
    if (!protForm.protocolo) { toast.error('Número do protocolo é obrigatório'); return; }

    registrarProtocolo(protocoloOpen.id, protForm.protocolo, protForm.situacao, {
      mensagem: protForm.mensagem || undefined,
      totalGuias: parseInt(protForm.totalGuias) || protocoloOpen.guias.length,
      totalGuiasProcessadas: parseInt(protForm.totalGuiasProcessadas) || 0,
      totalGuiasComErro: parseInt(protForm.totalGuiasComErro) || 0,
      valorProcessado: parseFloat(protForm.valorProcessado) || 0,
    });

    setProtocoloOpen(null);
    setProtForm(emptyProt);
    toast.success('Protocolo de recebimento registrado!');
  }

  // ─── Copiar XML ───────────────────────────────────────────────────────────
  function handleCopiarXML() {
    if (xmlOpen) {
      navigator.clipboard.writeText(xmlOpen).then(() => toast.success('XML copiado!'));
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileCode2 className="h-6 w-6 text-blue-600" />
            Envio Eletrônico TISS
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            XML TISS 3.05.00 · Guias de Consulta, SADT e Honorários
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-1" /> Configurar Prestadora
          </Button>
          <Button size="sm" onClick={() => setNovoLoteOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Lote TISS
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Lotes', valor: stats.totalLotes, icon: <FileCode2 className="h-5 w-5 text-slate-500" />, cls: 'text-slate-700' },
          { label: 'Validados', valor: stats.lotesValidados, icon: <BadgeCheck className="h-5 w-5 text-blue-500" />, cls: 'text-blue-700' },
          { label: 'Enviados', valor: stats.lotesEnviados, icon: <Send className="h-5 w-5 text-purple-500" />, cls: 'text-purple-700' },
          { label: 'Processados', valor: stats.lotesProcessados, icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, cls: 'text-green-700' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            {c.icon}
            <div>
              <p className="text-xs text-slate-500">{c.label}</p>
              <p className={`text-xl font-bold ${c.cls}`}>{c.valor}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Valor total enviado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Valor Total Enviado</p>
          <p className="text-2xl font-bold text-purple-700">{fmt(stats.valorTotalEnviado)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Valor Total Processado</p>
          <p className="text-2xl font-bold text-green-700">{fmt(stats.valorTotalProcessado)}</p>
        </div>
      </div>

      {/* Aviso configuração */}
      {!config.prestadora.cnpj && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <Info className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Configuração de prestadora incompleta</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Configure o CNPJ e código da prestadora para gerar XMLs válidos.{' '}
              <button className="underline font-medium" onClick={() => setConfigOpen(true)}>Configurar agora</button>
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="lotes">Lotes TISS ({lotes.length})</TabsTrigger>
          <TabsTrigger value="protocolos">Protocolos ({protocolos.length})</TabsTrigger>
          <TabsTrigger value="configuracao">Configuração</TabsTrigger>
        </TabsList>

        {/* ─── ABA LOTES ────────────────────────────────────────────────── */}
        <TabsContent value="lotes" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar convênio, número do lote..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="border-none shadow-none p-0 h-auto focus-visible:ring-0"
              />
            </div>

            {lotesFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                <FileCode2 className="h-10 w-10" />
                <p className="text-sm">Nenhum lote TISS encontrado</p>
                <Button size="sm" variant="outline" onClick={() => setNovoLoteOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Criar primeiro lote
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº Lote</TableHead>
                    <TableHead>Convênio</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Guias</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Gerado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotesFiltrados.map((lote) => {
                    const sc = situacaoCfg[lote.situacao];
                    const erros = lote.errosValidacao.filter((e) => e.severity === 'error');
                    const warns = lote.errosValidacao.filter((e) => e.severity === 'warning');
                    return (
                      <TableRow key={lote.id}>
                        <TableCell className="font-mono text-xs font-medium">{lote.numeroLote}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-sm">{lote.convenioNome}</span>
                            <span className="text-xs text-slate-400">ANS: {lote.convenioANS}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{lote.competencia}</TableCell>
                        <TableCell className="text-sm">{lote.guias.length}</TableCell>
                        <TableCell className="font-medium text-sm">{fmt(lote.valorTotal)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`flex items-center gap-1 w-fit ${sc.cls}`}>
                            {sc.icon} {sc.label}
                          </Badge>
                          {erros.length > 0 && (
                            <button
                              className="flex items-center gap-1 text-xs text-red-600 mt-1 hover:underline"
                              onClick={() => setErrosOpen(lote)}
                            >
                              <AlertCircle className="h-3 w-3" />
                              {erros.length} erro(s)
                            </button>
                          )}
                          {warns.length > 0 && erros.length === 0 && (
                            <button
                              className="flex items-center gap-1 text-xs text-amber-600 mt-1 hover:underline"
                              onClick={() => setErrosOpen(lote)}
                            >
                              <FileWarning className="h-3 w-3" />
                              {warns.length} aviso(s)
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">
                          {lote.protocolo ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDate(lote.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {/* Revalidar */}
                            <Button
                              size="icon" variant="ghost"
                              title="Revalidar"
                              onClick={() => { revalidarLote(lote.id); toast.info('Lote revalidado'); }}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            {/* Ver XML */}
                            <Button
                              size="icon" variant="ghost"
                              title="Visualizar XML"
                              onClick={() => {
                                setXmlOpen(visualizarXML(lote.id));
                                setXmlLoteNome(`Lote ${lote.numeroLote} — ${lote.convenioNome}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {/* Baixar XML */}
                            <Button
                              size="icon" variant="ghost"
                              title="Baixar XML"
                              onClick={() => fazerDownloadXML(lote.id)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {/* Enviar */}
                            {(lote.situacao === 'validado' || lote.situacao === 'gerado') && (
                              <Button
                                size="sm" variant="outline"
                                className="border-purple-200 text-purple-700 hover:bg-purple-50"
                                onClick={() => handleEnviar(lote.id)}
                                disabled={loading}
                              >
                                <Send className="h-3.5 w-3.5 mr-1" /> Enviar
                              </Button>
                            )}
                            {/* Protocolo */}
                            {lote.situacao === 'enviado' && (
                              <Button
                                size="sm" variant="outline"
                                className="border-cyan-200 text-cyan-700 hover:bg-cyan-50"
                                onClick={() => { setProtocoloOpen(lote); setProtForm(emptyProt); }}
                              >
                                <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Protocolo
                              </Button>
                            )}
                            {/* Detalhes */}
                            <Button
                              size="icon" variant="ghost"
                              onClick={() => setDetalheOpen(lote)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            {/* Deletar */}
                            <Button
                              size="icon" variant="ghost"
                              className="text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteId(lote.id)}
                            >
                              <Trash2 className="h-4 w-4" />
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
        </TabsContent>

        {/* ─── ABA PROTOCOLOS ───────────────────────────────────────────── */}
        <TabsContent value="protocolos" className="mt-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {protocolos.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
                <ClipboardCheck className="h-10 w-10" />
                <p className="text-sm">Nenhum protocolo de recebimento registrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Guias</TableHead>
                    <TableHead>Processadas</TableHead>
                    <TableHead>Com Erro</TableHead>
                    <TableHead>Valor Processado</TableHead>
                    <TableHead>Data Recebimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocolos.map((p) => {
                    const lote = lotes.find((l) => l.id === p.loteTissId);
                    const sc = situacaoProtocoloCfg[p.situacao];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-medium">{p.protocolo}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {lote ? `${lote.numeroLote} — ${lote.convenioNome}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={sc.cls}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{p.totalGuias}</TableCell>
                        <TableCell className="text-sm text-green-700">{p.totalGuiasProcessadas}</TableCell>
                        <TableCell className="text-sm text-red-600">{p.totalGuiasComErro}</TableCell>
                        <TableCell className="font-medium text-sm">{fmt(p.valorProcessado)}</TableCell>
                        <TableCell className="text-xs text-slate-500">{fmtDate(p.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ─── ABA CONFIGURAÇÃO ─────────────────────────────────────────── */}
        <TabsContent value="configuracao" className="mt-4">
          <ConfiguracaoForm config={configForm} onChange={setConfigForm} onSave={() => {
            salvarConfig(configForm);
            toast.success('Configuração salva!');
          }} />
        </TabsContent>
      </Tabs>

      {/* ════ Dialog: Novo Lote ════ */}
      <Dialog open={novoLoteOpen} onOpenChange={setNovoLoteOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lote TISS</DialogTitle>
            <DialogDescription>Preencha os dados para gerar o XML TISS 3.05.00</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Convênio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Convênio *</Label>
                <Select value={loteForm.convenioId} onValueChange={(v) => setLoteForm((f) => ({ ...f, convenioId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} (ANS: {c.ansCode})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Tipo de Guia *</Label>
                <Select value={loteForm.tipoGuia} onValueChange={(v) => setLoteForm((f) => ({ ...f, tipoGuia: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guiaConsulta">Guia de Consulta</SelectItem>
                    <SelectItem value="guiaSADT">Guia de SADT</SelectItem>
                    <SelectItem value="guiaHonorarios">Guia de Honorários</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <hr className="border-slate-100" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dados da Guia</p>

            {/* Guia info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Nº da Guia</Label>
                <Input placeholder="Ex: G001" value={guiaForm.numeroGuia}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, numeroGuia: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data Atendimento *</Label>
                <Input type="date" value={guiaForm.dataAtendimento}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, dataAtendimento: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Nº Autorização</Label>
                <Input placeholder="Opcional" value={guiaForm.numeroAutorizacao}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, numeroAutorizacao: e.target.value }))} />
              </div>
            </div>

            <hr className="border-slate-100" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Beneficiário (Paciente)</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Nº Carteirinha *</Label>
                <Input value={guiaForm.carteirinha}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, carteirinha: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Nome do Paciente *</Label>
                <Input value={guiaForm.nomePaciente}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, nomePaciente: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data de Nascimento *</Label>
                <Input type="date" value={guiaForm.dataNascimento}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, dataNascimento: e.target.value }))} />
              </div>
            </div>

            <hr className="border-slate-100" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profissional Executante</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={guiaForm.profNome}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, profNome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>CPF *</Label>
                <Input placeholder="000.000.000-00" value={guiaForm.profCpf}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, profCpf: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Conselho</Label>
                <Select value={guiaForm.profConselho} onValueChange={(v) => setGuiaForm((f) => ({ ...f, profConselho: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['CRM','CRO','CRN','CREFITO','CRP','COREN','CFO'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nº Conselho (CRM)</Label>
                <Input placeholder="Ex: 12345" value={guiaForm.profCrm}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, profCrm: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>UF</Label>
                <Input placeholder="SP" maxLength={2} value={guiaForm.profUf}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, profUf: e.target.value.toUpperCase() }))} />
              </div>
            </div>

            <hr className="border-slate-100" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Procedimento</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código TUSS *</Label>
                <Input placeholder="Ex: 10101012" value={guiaForm.codigoTUSS}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, codigoTUSS: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Descrição *</Label>
                <Input placeholder="Ex: Consulta médica em atenção primária" value={guiaForm.descricaoProcedimento}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, descricaoProcedimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={guiaForm.quantidade}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, quantidade: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Valor Unitário (R$) *</Label>
                <Input type="number" step="0.01" placeholder="0,00" value={guiaForm.valorUnitario}
                  onChange={(e) => setGuiaForm((f) => ({ ...f, valorUnitario: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Valor Total</Label>
                <Input disabled value={
                  ((parseFloat(guiaForm.valorUnitario) || 0) * (parseInt(guiaForm.quantidade) || 1)).toFixed(2)
                } />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observação</Label>
              <Textarea rows={2} value={guiaForm.observacao}
                onChange={(e) => setGuiaForm((f) => ({ ...f, observacao: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoLoteOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarLote}>
              <FileCode2 className="h-4 w-4 mr-1" /> Gerar Lote TISS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Dialog: Detalhes do Lote ════ */}
      {detalheOpen && (
        <Dialog open={!!detalheOpen} onOpenChange={() => setDetalheOpen(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Lote TISS — {detalheOpen.numeroLote}</DialogTitle>
              <DialogDescription>{detalheOpen.convenioNome} · {detalheOpen.competencia}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-slate-500">ANS:</span> <strong>{detalheOpen.convenioANS}</strong></div>
                <div><span className="text-slate-500">Situação:</span> <Badge variant="outline" className={situacaoCfg[detalheOpen.situacao].cls}>{situacaoCfg[detalheOpen.situacao].label}</Badge></div>
                <div><span className="text-slate-500">Total Guias:</span> <strong>{detalheOpen.guias.length}</strong></div>
                <div><span className="text-slate-500">Valor Total:</span> <strong>{fmt(detalheOpen.valorTotal)}</strong></div>
                <div><span className="text-slate-500">Gerado:</span> {fmtDate(detalheOpen.createdAt)}</div>
                {detalheOpen.dataEnvio && <div><span className="text-slate-500">Enviado:</span> {fmtDate(detalheOpen.dataEnvio)}</div>}
                {detalheOpen.protocolo && <div><span className="text-slate-500">Protocolo:</span> <span className="font-mono">{detalheOpen.protocolo}</span></div>}
                {detalheOpen.hashXml && <div className="col-span-2"><span className="text-slate-500">Hash XML:</span> <span className="font-mono text-xs">{detalheOpen.hashXml}</span></div>}
              </div>

              <hr />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guias</p>
              {detalheOpen.guias.map((g, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{g.tipo === 'guiaConsulta' ? 'Consulta' : g.tipo === 'guiaSADT' ? 'SADT' : 'Honorários'} — Guia {g.numeroGuia}</span>
                    <span className="text-slate-500">{g.dataAtendimento}</span>
                  </div>
                  <div className="mt-1 text-slate-600">
                    Paciente: {g.beneficiario.nome} · Carteirinha: {g.beneficiario.numeroCarteirinha}
                  </div>
                  <div className="text-slate-600">
                    Profissional: {g.profissionalExecutante.nome} · {g.profissionalExecutante.conselho} {g.profissionalExecutante.crm}/{g.profissionalExecutante.uf}
                  </div>
                </div>
              ))}

              {detalheOpen.errosValidacao.length > 0 && (
                <>
                  <hr />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Validação</p>
                  <div className="space-y-1">
                    {detalheOpen.errosValidacao.map((e, i) => (
                      <div key={i} className={`flex items-start gap-2 rounded p-2 text-xs ${e.severity === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {e.severity === 'error' ? <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <FileWarning className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
                        <span>{e.guiaNumero ? `[Guia ${e.guiaNumero}] ` : ''}{e.mensagem}{e.codigoGlosa ? ` (Glosa ${e.codigoGlosa}: ${GLOSA_DESCRICAO[e.codigoGlosa]})` : ''}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ════ Dialog: Visualizar XML ════ */}
      <Dialog open={!!xmlOpen} onOpenChange={() => setXmlOpen('')}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>XML TISS — {xmlLoteNome}</DialogTitle>
            <DialogDescription>XML 3.05.00 gerado para envio à operadora</DialogDescription>
          </DialogHeader>
          <pre className="rounded-lg bg-slate-900 text-green-300 text-xs p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-[50vh] overflow-y-auto">
            {xmlOpen}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={handleCopiarXML}>
              <Copy className="h-4 w-4 mr-1" /> Copiar XML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════ Dialog: Erros de Validação ════ */}
      {errosOpen && (
        <Dialog open={!!errosOpen} onOpenChange={() => setErrosOpen(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Erros de Validação — Lote {errosOpen.numeroLote}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {errosOpen.errosValidacao.map((e, i) => (
                <div key={i} className={`rounded-lg p-3 text-sm ${e.severity === 'error' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className={`flex items-center gap-1.5 font-medium ${e.severity === 'error' ? 'text-red-700' : 'text-amber-700'}`}>
                    {e.severity === 'error' ? <AlertCircle className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
                    {e.severity === 'error' ? 'Erro' : 'Aviso'}{e.guiaNumero ? ` — Guia ${e.guiaNumero}` : ''}
                  </div>
                  <p className={`mt-0.5 ${e.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>{e.mensagem}</p>
                  {e.codigoGlosa && (
                    <p className="text-xs text-slate-500 mt-0.5">Código de Glosa {e.codigoGlosa}: {GLOSA_DESCRICAO[e.codigoGlosa]}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">Campo: {e.campo}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ════ Dialog: Registrar Protocolo ════ */}
      {protocoloOpen && (
        <Dialog open={!!protocoloOpen} onOpenChange={() => setProtocoloOpen(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Registrar Protocolo de Recebimento</DialogTitle>
              <DialogDescription>Lote {protocoloOpen.numeroLote} — {protocoloOpen.convenioNome}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label>Nº do Protocolo *</Label>
                <Input value={protForm.protocolo} onChange={(e) => setProtForm((f) => ({ ...f, protocolo: e.target.value }))} placeholder="Ex: 2024001234" />
              </div>
              <div className="space-y-1">
                <Label>Situação *</Label>
                <Select value={protForm.situacao} onValueChange={(v) => setProtForm((f) => ({ ...f, situacao: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="processado">Processado</SelectItem>
                    <SelectItem value="processadoComPendencia">Processado com Pendência</SelectItem>
                    <SelectItem value="naoProcessado">Não Processado</SelectItem>
                    <SelectItem value="emProcessamento">Em Processamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>Total Guias</Label>
                  <Input type="number" value={protForm.totalGuias} onChange={(e) => setProtForm((f) => ({ ...f, totalGuias: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Processadas</Label>
                  <Input type="number" value={protForm.totalGuiasProcessadas} onChange={(e) => setProtForm((f) => ({ ...f, totalGuiasProcessadas: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Com Erro</Label>
                  <Input type="number" value={protForm.totalGuiasComErro} onChange={(e) => setProtForm((f) => ({ ...f, totalGuiasComErro: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Valor Processado (R$)</Label>
                <Input type="number" step="0.01" value={protForm.valorProcessado} onChange={(e) => setProtForm((f) => ({ ...f, valorProcessado: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Mensagem da Operadora</Label>
                <Textarea rows={2} value={protForm.mensagem} onChange={(e) => setProtForm((f) => ({ ...f, mensagem: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProtocoloOpen(null)}>Cancelar</Button>
              <Button onClick={handleRegistrarProtocolo}>
                <ClipboardCheck className="h-4 w-4 mr-1" /> Registrar Protocolo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ════ Dialog: Configuração Prestadora ════ */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuração da Prestadora TISS</DialogTitle>
            <DialogDescription>Dados da clínica para gerar XMLs válidos</DialogDescription>
          </DialogHeader>
          <ConfiguracaoForm config={configForm} onChange={setConfigForm} onSave={() => {
            salvarConfig(configForm);
            setConfigOpen(false);
            toast.success('Configuração salva!');
          }} inline />
        </DialogContent>
      </Dialog>

      {/* ════ AlertDialog: Deletar ════ */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lote TISS?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
              if (deleteId) { deletarLote(deleteId); setDeleteId(null); toast.success('Lote deletado'); }
            }}>
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Componente de configuração ───────────────────────────────────────────────
function ConfiguracaoForm({
  config, onChange, onSave, inline = false,
}: {
  config: ConfiguracaoTISS;
  onChange: (c: ConfiguracaoTISS) => void;
  onSave: () => void;
  inline?: boolean;
}) {
  const p = config.prestadora;
  const set = (k: keyof typeof p, v: string) =>
    onChange({ ...config, prestadora: { ...p, [k]: v } });

  const body = (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>CNPJ *</Label>
          <Input placeholder="00.000.000/0000-00" value={p.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Código na Operadora *</Label>
          <Input value={p.codigoNaOperadora} onChange={(e) => set('codigoNaOperadora', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Razão Social</Label>
        <Input value={p.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Nome Fantasia</Label>
        <Input value={p.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>CNES</Label>
          <Input value={p.cnes ?? ''} onChange={(e) => set('cnes', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Telefone</Label>
          <Input value={p.telefone ?? ''} onChange={(e) => set('telefone', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>E-mail</Label>
        <Input type="email" value={p.email ?? ''} onChange={(e) => set('email', e.target.value)} />
      </div>
    </div>
  );

  if (inline) {
    return (
      <>
        <div className="py-2">{body}</div>
        <DialogFooter>
          <Button onClick={onSave}><Shield className="h-4 w-4 mr-1" /> Salvar Configuração</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-semibold text-slate-700 flex items-center gap-2">
        <Shield className="h-4 w-4" /> Dados da Prestadora
      </h2>
      {body}
      <Button onClick={onSave}><Shield className="h-4 w-4 mr-1" /> Salvar Configuração</Button>
    </div>
  );
}
