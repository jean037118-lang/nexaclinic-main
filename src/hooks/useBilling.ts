// useBilling — hook para o módulo de Faturamento de convênios

import { useState, useEffect, useCallback } from 'react';
import { billingStorage } from '@/lib/financial/billing-storage';
import type {
  LoteFaturamento,
  FaturaConvenio,
  ItemFaturamento,
  LoteStatus,
  FaturaStatus,
  CreateLoteInput,
  CreateFaturaInput,
} from '@/lib/financial/billing-types';
import { toast } from 'sonner';

export function useBilling() {
  const [lotes, setLotes] = useState<LoteFaturamento[]>([]);
  const [faturas, setFaturas] = useState<FaturaConvenio[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLotes(billingStorage.getLotes());
    setFaturas(billingStorage.getFaturas());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ─── Lotes ─────────────────────────────────────────────────────────────────
  function createLote(input: CreateLoteInput): LoteFaturamento {
    const lote = billingStorage.createLote(input);
    reload();
    toast.success(`Lote ${lote.numero} criado com sucesso`);
    return lote;
  }

  function updateLote(id: string, patch: Partial<LoteFaturamento>): void {
    billingStorage.updateLote(id, patch);
    reload();
  }

  function fecharLote(id: string): void {
    billingStorage.updateLote(id, { status: 'fechado', fechadoAt: new Date().toISOString() });
    reload();
    toast.success('Lote fechado — pronto para faturar');
  }

  function reabrirLote(id: string): void {
    billingStorage.updateLote(id, { status: 'aberto', fechadoAt: undefined });
    reload();
    toast.success('Lote reaberto — pode adicionar ou remover itens');
  }

  function enviarLote(id: string): void {
    billingStorage.updateLote(id, { status: 'enviado', enviadoAt: new Date().toISOString() });
    reload();
    toast.success('Lote marcado como enviado ao convênio');
  }

  function marcarLotePago(id: string, valorPago: number, valorGlosado = 0): void {
    billingStorage.updateLote(id, {
      status: 'pago',
      pagoAt: new Date().toISOString(),
      valorPago,
      valorGlosado,
    });
    reload();
    toast.success('Pagamento do lote registrado');
  }

  function deleteLote(id: string): void {
    billingStorage.deleteLote(id);
    reload();
    toast.success('Lote removido');
  }

  function addItemToLote(loteId: string, item: Omit<ItemFaturamento, 'id' | 'loteId'>): void {
    billingStorage.addItemToLote(loteId, item);
    reload();
    toast.success('Item adicionado ao lote');
  }

  function removeItemFromLote(loteId: string, itemId: string): void {
    billingStorage.removeItemFromLote(loteId, itemId);
    reload();
    toast.success('Item removido do lote');
  }

  // ─── Faturas ───────────────────────────────────────────────────────────────
  function createFatura(input: CreateFaturaInput): FaturaConvenio {
    const fatura = billingStorage.createFatura(input);
    // fecha os lotes incluídos automaticamente
    input.loteIds.forEach(lid => {
      const lote = billingStorage.getLote(lid);
      if (lote && lote.status === 'aberto') {
        billingStorage.updateLote(lid, { status: 'fechado', fechadoAt: new Date().toISOString() });
      }
    });
    reload();
    toast.success(`Fatura ${fatura.numero} gerada com sucesso`);
    return fatura;
  }

  function updateFatura(id: string, patch: Partial<FaturaConvenio>): void {
    billingStorage.updateFatura(id, patch);
    reload();
  }

  function enviarFatura(id: string, protocolo?: string): void {
    billingStorage.updateFatura(id, {
      status: 'enviada',
      dataEnvio: new Date().toISOString().split('T')[0],
      protocolo,
    });
    reload();
    toast.success('Fatura marcada como enviada ao convênio');
  }

  function registrarPagamentoFatura(id: string, valorPago: number, valorGlosado = 0): void {
    billingStorage.updateFatura(id, {
      status: valorGlosado > 0 ? 'glosada' : 'paga',
      dataPagamento: new Date().toISOString().split('T')[0],
      valorPago,
      valorGlosado,
    });
    reload();
    toast.success('Pagamento da fatura registrado');
  }

  function deleteFatura(id: string): void {
    billingStorage.deleteFatura(id);
    reload();
    toast.success('Fatura removida');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function formatCurrency(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  function getLotesByConvenio(convenioId: string): LoteFaturamento[] {
    return lotes.filter(l => l.convenioId === convenioId);
  }

  function getFaturasByConvenio(convenioId: string): FaturaConvenio[] {
    return faturas.filter(f => f.convenioId === convenioId);
  }

  const summaryLotes = {
    abertos: lotes.filter(l => l.status === 'aberto').length,
    fechados: lotes.filter(l => l.status === 'fechado').length,
    enviados: lotes.filter(l => l.status === 'enviado').length,
    totalAberto: lotes.filter(l => l.status === 'aberto').reduce((s, l) => s + l.totalValue, 0),
    totalEnviado: lotes.filter(l => ['enviado', 'fechado'].includes(l.status)).reduce((s, l) => s + l.totalValue, 0),
    totalPago: lotes.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valorPago ?? 0), 0),
    totalGlosado: lotes.filter(l => l.status === 'pago').reduce((s, l) => s + (l.valorGlosado ?? 0), 0),
  };

  const summaryFaturas = {
    pendentes: faturas.filter(f => f.status === 'pendente').length,
    enviadas: faturas.filter(f => f.status === 'enviada').length,
    pagas: faturas.filter(f => f.status === 'paga').length,
    totalPendente: faturas.filter(f => ['pendente', 'enviada'].includes(f.status)).reduce((s, f) => s + f.totalValue, 0),
    totalPago: faturas.filter(f => f.status === 'paga').reduce((s, f) => s + (f.valorPago ?? 0), 0),
  };

  return {
    lotes,
    faturas,
    loading,
    summaryLotes,
    summaryFaturas,
    createLote,
    updateLote,
    fecharLote,
    reabrirLote,
    enviarLote,
    marcarLotePago,
    deleteLote,
    addItemToLote,
    removeItemFromLote,
    createFatura,
    updateFatura,
    enviarFatura,
    registrarPagamentoFatura,
    deleteFatura,
    formatCurrency,
    getLotesByConvenio,
    getFaturasByConvenio,
  };
}