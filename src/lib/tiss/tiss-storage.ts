/**
 * tiss-storage.ts — NexaClinic
 * Persistência dos lotes TISS no localStorage
 */

import type {
  LoteTISS,
  ProtocoloRecebimento,
  ConfiguracaoTISS,
  ErroValidacaoTISS,
} from './tiss-types';
import { TISS_STORAGE_KEYS } from './tiss-types';
import { gerarXMLLoteTISS, validarLoteTISS, gerarHashSimples } from './tiss-xml';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return `tiss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function agora(): string {
  return new Date().toISOString();
}

function carregarJSON<T>(chave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(chave);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function salvarJSON(chave: string, valor: unknown): void {
  localStorage.setItem(chave, JSON.stringify(valor));
}

// ─── Configuração TISS ────────────────────────────────────────────────────────

export function getConfiguracaoTISS(): ConfiguracaoTISS {
  return carregarJSON<ConfiguracaoTISS>(TISS_STORAGE_KEYS.config, {
    prestadora: {
      cnpj: '',
      codigoNaOperadora: '',
      nomeFantasia: '',
      razaoSocial: '',
      cnes: '',
      telefone: '',
      email: '',
    },
    sequencialLote: 1,
    sequencialGuia: 1,
  });
}

export function salvarConfiguracaoTISS(config: ConfiguracaoTISS): void {
  salvarJSON(TISS_STORAGE_KEYS.config, config);
}

function proximoSequencialLote(): string {
  const config = getConfiguracaoTISS();
  const seq = config.sequencialLote;
  config.sequencialLote = seq + 1;
  salvarConfiguracaoTISS(config);
  const ano = new Date().getFullYear();
  return `${ano}/${String(seq).padStart(4, '0')}`;
}

// ─── Lotes TISS ──────────────────────────────────────────────────────────────

export function listarLotesTISS(): LoteTISS[] {
  return carregarJSON<LoteTISS[]>(TISS_STORAGE_KEYS.lotes, [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLoteTISS(id: string): LoteTISS | undefined {
  return listarLotesTISS().find((l) => l.id === id);
}

export function criarLoteTISS(dados: Omit<LoteTISS, 'id' | 'numeroLote' | 'situacao' | 'errosValidacao' | 'createdAt' | 'updatedAt' | 'xmlGerado' | 'hashXml'>): LoteTISS {
  const lotes = carregarJSON<LoteTISS[]>(TISS_STORAGE_KEYS.lotes, []);
  const numeroLote = proximoSequencialLote();

  const novo: LoteTISS = {
    ...dados,
    id: uid(),
    numeroLote,
    situacao: 'gerado',
    errosValidacao: [],
    createdAt: agora(),
    updatedAt: agora(),
  };

  // Gerar XML imediatamente
  const xml = gerarXMLLoteTISS(novo);
  novo.xmlGerado = xml;
  novo.hashXml = gerarHashSimples(xml);

  // Validar
  novo.errosValidacao = validarLoteTISS(novo);
  const temErros = novo.errosValidacao.some((e) => e.severity === 'error');
  if (!temErros) {
    novo.situacao = 'validado';
  }

  lotes.unshift(novo);
  salvarJSON(TISS_STORAGE_KEYS.lotes, lotes);
  return novo;
}

export function atualizarLoteTISS(id: string, changes: Partial<LoteTISS>): LoteTISS | null {
  const lotes = carregarJSON<LoteTISS[]>(TISS_STORAGE_KEYS.lotes, []);
  const idx = lotes.findIndex((l) => l.id === id);
  if (idx === -1) return null;

  const atualizado = { ...lotes[idx], ...changes, updatedAt: agora() };

  // Regenerar XML se guias mudaram
  if (changes.guias) {
    const xml = gerarXMLLoteTISS(atualizado);
    atualizado.xmlGerado = xml;
    atualizado.hashXml = gerarHashSimples(xml);
    atualizado.errosValidacao = validarLoteTISS(atualizado);
    const temErros = atualizado.errosValidacao.some((e) => e.severity === 'error');
    atualizado.situacao = temErros ? 'gerado' : 'validado';
  }

  lotes[idx] = atualizado;
  salvarJSON(TISS_STORAGE_KEYS.lotes, lotes);
  return atualizado;
}

export function marcarLoteEnviado(id: string): LoteTISS | null {
  return atualizarLoteTISS(id, {
    situacao: 'enviado',
    dataEnvio: agora(),
  });
}

export function registrarProtocoloRecebimento(
  loteTissId: string,
  protocolo: string,
  situacao: ProtocoloRecebimento['situacao'],
  dados: Partial<ProtocoloRecebimento> = {}
): ProtocoloRecebimento {
  // Atualizar lote
  atualizarLoteTISS(loteTissId, {
    protocolo,
    situacao: situacao === 'processado' ? 'processado' : 'recebido',
  });

  // Criar protocolo
  const protocolos = carregarJSON<ProtocoloRecebimento[]>(TISS_STORAGE_KEYS.protocolos, []);
  const novoProtocolo: ProtocoloRecebimento = {
    id: uid(),
    loteTissId,
    protocolo,
    dataRecebimento: agora(),
    situacao,
    totalGuias: dados.totalGuias ?? 0,
    totalGuiasProcessadas: dados.totalGuiasProcessadas ?? 0,
    totalGuiasComErro: dados.totalGuiasComErro ?? 0,
    valorProcessado: dados.valorProcessado ?? 0,
    mensagem: dados.mensagem,
    erros: dados.erros,
    createdAt: agora(),
  };

  protocolos.unshift(novoProtocolo);
  salvarJSON(TISS_STORAGE_KEYS.protocolos, protocolos);
  return novoProtocolo;
}

export function deletarLoteTISS(id: string): void {
  const lotes = carregarJSON<LoteTISS[]>(TISS_STORAGE_KEYS.lotes, [])
    .filter((l) => l.id !== id);
  salvarJSON(TISS_STORAGE_KEYS.lotes, lotes);
}

// ─── Protocolos ──────────────────────────────────────────────────────────────

export function listarProtocolos(): ProtocoloRecebimento[] {
  return carregarJSON<ProtocoloRecebimento[]>(TISS_STORAGE_KEYS.protocolos, [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getProtocolosPorLote(loteTissId: string): ProtocoloRecebimento[] {
  return listarProtocolos().filter((p) => p.loteTissId === loteTissId);
}

// ─── Download do XML ─────────────────────────────────────────────────────────

export function downloadXML(lote: LoteTISS): void {
  if (!lote.xmlGerado) return;
  const blob = new Blob([lote.xmlGerado], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TISS_${lote.convenioNome.replace(/\s/g, '_')}_Lote${lote.numeroLote.replace('/', '-')}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

export interface EstatisticasTISS {
  totalLotes: number;
  lotesValidados: number;
  lotesEnviados: number;
  lotesProcessados: number;
  lotesComErro: number;
  valorTotalEnviado: number;
  valorTotalProcessado: number;
}

export function getEstatisticasTISS(): EstatisticasTISS {
  const lotes = listarLotesTISS();
  return {
    totalLotes: lotes.length,
    lotesValidados: lotes.filter((l) => l.situacao === 'validado').length,
    lotesEnviados: lotes.filter((l) => l.situacao === 'enviado').length,
    lotesProcessados: lotes.filter((l) => l.situacao === 'processado').length,
    lotesComErro: lotes.filter((l) => l.errosValidacao.some((e) => e.severity === 'error')).length,
    valorTotalEnviado: lotes
      .filter((l) => ['enviado', 'processado', 'recebido'].includes(l.situacao))
      .reduce((s, l) => s + l.valorTotal, 0),
    valorTotalProcessado: lotes
      .filter((l) => l.situacao === 'processado')
      .reduce((s, l) => s + l.valorTotal, 0),
  };
}
