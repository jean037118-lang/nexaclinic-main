/**
 * useTISS.ts — NexaClinic
 * Hook React para gerenciamento de lotes TISS
 */

import { useState, useEffect, useCallback } from 'react';
import type { LoteTISS, ProtocoloRecebimento, ConfiguracaoTISS } from '@/lib/tiss/tiss-types';
import {
  listarLotesTISS,
  getLoteTISS,
  criarLoteTISS,
  atualizarLoteTISS,
  marcarLoteEnviado,
  registrarProtocoloRecebimento,
  deletarLoteTISS,
  listarProtocolos,
  getEstatisticasTISS,
  getConfiguracaoTISS,
  salvarConfiguracaoTISS,
  downloadXML,
  type EstatisticasTISS,
} from '@/lib/tiss/tiss-storage';
import { validarLoteTISS, gerarXMLLoteTISS } from '@/lib/tiss/tiss-xml';

export function useTISS() {
  const [lotes, setLotes] = useState<LoteTISS[]>([]);
  const [protocolos, setProtocolos] = useState<ProtocoloRecebimento[]>([]);
  const [stats, setStats] = useState<EstatisticasTISS>({
    totalLotes: 0, lotesValidados: 0, lotesEnviados: 0,
    lotesProcessados: 0, lotesComErro: 0,
    valorTotalEnviado: 0, valorTotalProcessado: 0,
  });
  const [config, setConfig] = useState<ConfiguracaoTISS>(getConfiguracaoTISS());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLotes(listarLotesTISS());
    setProtocolos(listarProtocolos());
    setStats(getEstatisticasTISS());
    setConfig(getConfiguracaoTISS());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const criarLoteDoFaturamento = useCallback((
    dados: Omit<LoteTISS, 'id' | 'numeroLote' | 'situacao' | 'errosValidacao' | 'createdAt' | 'updatedAt' | 'xmlGerado' | 'hashXml'>
  ): LoteTISS => {
    const novo = criarLoteTISS(dados);
    refresh();
    return novo;
  }, [refresh]);

  const revalidarLote = useCallback((id: string): LoteTISS | null => {
    const lote = getLoteTISS(id);
    if (!lote) return null;
    const erros = validarLoteTISS(lote);
    const temErros = erros.some((e) => e.severity === 'error');
    const atualizado = atualizarLoteTISS(id, {
      errosValidacao: erros,
      situacao: temErros ? 'gerado' : 'validado',
    });
    refresh();
    return atualizado;
  }, [refresh]);

  const enviarLote = useCallback(async (id: string): Promise<{ ok: boolean; mensagem: string }> => {
    setLoading(true);
    try {
      const lote = getLoteTISS(id);
      if (!lote) return { ok: false, mensagem: 'Lote não encontrado' };

      const erros = validarLoteTISS(lote);
      if (erros.some((e) => e.severity === 'error')) {
        atualizarLoteTISS(id, { errosValidacao: erros });
        refresh();
        return { ok: false, mensagem: `Lote com ${erros.filter((e) => e.severity === 'error').length} erro(s) de validação. Corrija antes de enviar.` };
      }

      downloadXML(lote);
      marcarLoteEnviado(id);
      refresh();

      return { ok: true, mensagem: 'XML TISS gerado e download iniciado. Envie o arquivo ao portal da operadora.' };
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const registrarProtocolo = useCallback((
    loteTissId: string,
    protocolo: string,
    situacao: ProtocoloRecebimento['situacao'],
    extras: Partial<ProtocoloRecebimento> = {}
  ): ProtocoloRecebimento => {
    const p = registrarProtocoloRecebimento(loteTissId, protocolo, situacao, extras);
    refresh();
    return p;
  }, [refresh]);

  const deletarLote = useCallback((id: string) => {
    deletarLoteTISS(id);
    refresh();
  }, [refresh]);

  const salvarConfig = useCallback((c: ConfiguracaoTISS) => {
    salvarConfiguracaoTISS(c);
    refresh();
  }, [refresh]);

  const fazerDownloadXML = useCallback((id: string) => {
    const lote = getLoteTISS(id);
    if (lote) downloadXML(lote);
  }, []);

  const visualizarXML = useCallback((id: string): string => {
    const lote = getLoteTISS(id);
    return lote?.xmlGerado ?? '';
  }, []);

  return {
    lotes,
    protocolos,
    stats,
    config,
    loading,
    refresh,
    criarLoteDoFaturamento,
    revalidarLote,
    enviarLote,
    registrarProtocolo,
    deletarLote,
    salvarConfig,
    fazerDownloadXML,
    visualizarXML,
    getLote: getLoteTISS,
  };
}
