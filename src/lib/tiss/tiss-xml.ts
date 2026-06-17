/**
 * tiss-xml.ts — NexaClinic
 * Geração e validação de XML TISS 3.05.00
 */

import type {
  LoteTISS,
  GuiaTISS,
  GuiaConsulta,
  GuiaSADT,
  GuiaHonorarios,
  ErroValidacaoTISS,
  DadosBeneficiario,
  DadosProfissional,
  ItemProcedimento,
} from './tiss-types';
import { TISS_VERSAO, TISS_NAMESPACE } from './tiss-types';

// ─── Formatadores ─────────────────────────────────────────────────────────────

function fmt(n: number, decimais = 2): string {
  return n.toFixed(decimais);
}

function fmtData(iso: string): string {
  // YYYY-MM-DD → YYYY-MM-DD (já no padrão TISS)
  return iso.substring(0, 10);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function limparCNPJ(s: string): string {
  return s.replace(/\D/g, '');
}

function limparCPF(s: string): string {
  return s.replace(/\D/g, '');
}

function limparCRM(s: string): string {
  return s.replace(/\D/g, '');
}

// ─── Hash simples (sem WebCrypto para compatibilidade) ────────────────────────
export function gerarHashSimples(xml: string): string {
  let hash = 0;
  for (let i = 0; i < xml.length; i++) {
    const char = xml.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

// ─── Bloco beneficiário ───────────────────────────────────────────────────────
function xmlBeneficiario(b: DadosBeneficiario): string {
  return `
        <ans:beneficiario>
          <ans:numeroDaCarteira>${esc(b.numeroCarteirinha)}</ans:numeroDaCarteira>
          <ans:atendimentoRN>N</ans:atendimentoRN>
          <ans:nomeBeneficiario>${esc(b.nome)}</ans:nomeBeneficiario>
          ${b.carteirinha ? `<ans:cartaoNacionalSaude>${esc(b.cns ?? '')}</ans:cartaoNacionalSaude>` : ''}
          <ans:dataNascimento>${b.dataNascimento}</ans:dataNascimento>
        </ans:beneficiario>`;
}

// ─── Bloco profissional ───────────────────────────────────────────────────────
function xmlProfissional(p: DadosProfissional, tag: string): string {
  return `
        <${tag}>
          <ans:sequencialNaGuia>1</ans:sequencialNaGuia>
          <ans:grauParticipacao>${p.grauParticipacao ?? '00'}</ans:grauParticipacao>
          <ans:codigoPrestadorNaOperadora></ans:codigoPrestadorNaOperadora>
          <ans:CPFCNPJ>${limparCPF(p.cpf)}</ans:CPFCNPJ>
          <ans:nome>${esc(p.nome)}</ans:nome>
          <ans:conselho>${p.conselho}</ans:conselho>
          <ans:numeroNoConselho>${limparCRM(p.crm ?? '')}</ans:numeroNoConselho>
          <ans:UF>${p.uf}</ans:UF>
          <ans:CBO>${p.cbo ?? '225125'}</ans:CBO>
        </${tag}>`;
}

// ─── Bloco procedimento ───────────────────────────────────────────────────────
function xmlProcedimento(item: ItemProcedimento, seq: number): string {
  return `
          <ans:procedimentosExecutados>
            <ans:sequencialItem>${seq}</ans:sequencialItem>
            <ans:procedimento>
              <ans:codigoTabela>22</ans:codigoTabela>
              <ans:codigoProcedimento>${esc(item.codigoTUSS)}</ans:codigoProcedimento>
              <ans:descricaoProcedimento>${esc(item.descricao)}</ans:descricaoProcedimento>
            </ans:procedimento>
            <ans:quantidadeExecutada>${item.quantidade}</ans:quantidadeExecutada>
            <ans:valorUnitario>${fmt(item.valorUnitario)}</ans:valorUnitario>
            <ans:valorTotal>${fmt(item.valorTotal)}</ans:valorTotal>
          </ans:procedimentosExecutados>`;
}

// ─── Guia de Consulta ─────────────────────────────────────────────────────────
function xmlGuiaConsulta(g: GuiaConsulta, numLote: string): string {
  return `
      <ans:guiasConsulta>
        <ans:cabecalhoGuia>
          <ans:registroANS>${numLote}</ans:registroANS>
          <ans:numeroGuiaPrestador>${esc(g.numeroGuia)}</ans:numeroGuiaPrestador>
          ${g.numeroAutorizacao ? `<ans:numeroGuiaOperadora>${esc(g.numeroAutorizacao)}</ans:numeroGuiaOperadora>` : ''}
          ${g.senhaAutorizacao ? `<ans:senha>${esc(g.senhaAutorizacao)}</ans:senha>` : ''}
          ${g.dataAutorizacao ? `<ans:dataAutorizacao>${fmtData(g.dataAutorizacao)}</ans:dataAutorizacao>` : ''}
          <ans:dataAtendimento>${fmtData(g.dataAtendimento)}</ans:dataAtendimento>
        </ans:cabecalhoGuia>
        ${xmlBeneficiario(g.beneficiario)}
        <ans:contratadoExecutante>
          <ans:codigoPrestadorNaOperadora></ans:codigoPrestadorNaOperadora>
        </ans:contratadoExecutante>
        ${xmlProfissional(g.profissionalExecutante, 'ans:profissionalExecutante')}
        <ans:tipoConsulta>${g.tipoConsulta ?? '1'}</ans:tipoConsulta>
        <ans:indicacaoAcidente>${g.indicacaoAcidente ?? '0'}</ans:indicacaoAcidente>
        <ans:procedimentoRealizado>
          <ans:procedimento>
            <ans:codigoTabela>22</ans:codigoTabela>
            <ans:codigoProcedimento>${esc(g.procedimento.codigoTUSS)}</ans:codigoProcedimento>
            <ans:descricaoProcedimento>${esc(g.procedimento.descricao)}</ans:descricaoProcedimento>
          </ans:procedimento>
          <ans:valorProcedimento>${fmt(g.procedimento.valorTotal)}</ans:valorProcedimento>
        </ans:procedimentoRealizado>
        <ans:valorTotal>
          <ans:valorTotalGeral>${fmt(g.procedimento.valorTotal)}</ans:valorTotalGeral>
        </ans:valorTotal>
        ${g.observacao ? `<ans:observacao>${esc(g.observacao)}</ans:observacao>` : ''}
      </ans:guiasConsulta>`;
}

// ─── Guia SADT ────────────────────────────────────────────────────────────────
function xmlGuiaSADT(g: GuiaSADT, numLote: string): string {
  const valorTotal = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);
  return `
      <ans:guiasSPSADT>
        <ans:cabecalhoGuia>
          <ans:registroANS>${numLote}</ans:registroANS>
          <ans:numeroGuiaPrestador>${esc(g.numeroGuia)}</ans:numeroGuiaPrestador>
          ${g.numeroAutorizacao ? `<ans:numeroGuiaOperadora>${esc(g.numeroAutorizacao)}</ans:numeroGuiaOperadora>` : ''}
          ${g.senhaAutorizacao ? `<ans:senha>${esc(g.senhaAutorizacao)}</ans:senha>` : ''}
          ${g.dataAutorizacao ? `<ans:dataAutorizacao>${fmtData(g.dataAutorizacao)}</ans:dataAutorizacao>` : ''}
        </ans:cabecalhoGuia>
        ${xmlBeneficiario(g.beneficiario)}
        <ans:dadosSolicitacao>
          <ans:dataSolicitacao>${fmtData(g.dataAtendimento)}</ans:dataSolicitacao>
          ${xmlProfissional(g.profissionalSolicitante, 'ans:profissionalSolicitante')}
        </ans:dadosSolicitacao>
        <ans:dadosAtendimento>
          <ans:tipoAtendimento>${g.tipoAtendimento ?? '01'}</ans:tipoAtendimento>
          <ans:indicacaoAcidente>${g.indicacaoAcidente ?? '0'}</ans:indicacaoAcidente>
          <ans:dataInicioAtendimento>${fmtData(g.dataAtendimento)}</ans:dataInicioAtendimento>
          <ans:dataFimAtendimento>${fmtData(g.dataAtendimento)}</ans:dataFimAtendimento>
          ${xmlProfissional(g.profissionalExecutante, 'ans:profissionalExecutante')}
          ${g.procedimentos.map((p, i) => xmlProcedimento(p, i + 1)).join('')}
        </ans:dadosAtendimento>
        <ans:valorTotal>
          <ans:valorTotalGeral>${fmt(valorTotal)}</ans:valorTotalGeral>
        </ans:valorTotal>
        ${g.observacao ? `<ans:observacao>${esc(g.observacao)}</ans:observacao>` : ''}
      </ans:guiasSPSADT>`;
}

// ─── Guia Honorários ──────────────────────────────────────────────────────────
function xmlGuiaHonorarios(g: GuiaHonorarios, numLote: string): string {
  const valorTotal = g.procedimentos.reduce((s, p) => s + p.valorTotal, 0);
  return `
      <ans:guiasHonorarios>
        <ans:cabecalhoGuia>
          <ans:registroANS>${numLote}</ans:registroANS>
          <ans:numeroGuiaPrestador>${esc(g.numeroGuia)}</ans:numeroGuiaPrestador>
          ${g.numeroAutorizacao ? `<ans:numeroGuiaOperadora>${esc(g.numeroAutorizacao)}</ans:numeroGuiaOperadora>` : ''}
        </ans:cabecalhoGuia>
        ${xmlBeneficiario(g.beneficiario)}
        <ans:contratadoExecutante>
          <ans:codigoPrestadorNaOperadora></ans:codigoPrestadorNaOperadora>
        </ans:contratadoExecutante>
        <ans:dadosAtendimento>
          <ans:dataAtendimento>${fmtData(g.dataAtendimento)}</ans:dataAtendimento>
          ${xmlProfissional(g.profissionalExecutante, 'ans:profissionalExecutante')}
          ${g.procedimentos.map((p, i) => xmlProcedimento(p, i + 1)).join('')}
        </ans:dadosAtendimento>
        <ans:valorTotal>
          <ans:valorTotalGeral>${fmt(valorTotal)}</ans:valorTotalGeral>
        </ans:valorTotal>
        ${g.observacao ? `<ans:observacao>${esc(g.observacao)}</ans:observacao>` : ''}
      </ans:guiasHonorarios>`;
}

// ─── Gerador do XML completo do lote ─────────────────────────────────────────
export function gerarXMLLoteTISS(lote: LoteTISS): string {
  const agora = new Date();
  const dataGeracao = agora.toISOString().substring(0, 10);
  const horaGeracao = agora.toTimeString().substring(0, 8);

  const guiasXML = lote.guias.map((g) => {
    switch (g.tipo) {
      case 'guiaConsulta':
        return xmlGuiaConsulta(g as GuiaConsulta, lote.convenioANS);
      case 'guiaSADT':
        return xmlGuiaSADT(g as GuiaSADT, lote.convenioANS);
      case 'guiaHonorarios':
        return xmlGuiaHonorarios(g as GuiaHonorarios, lote.convenioANS);
      default:
        return '';
    }
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ans:mensagemTISS
  xmlns:ans="${TISS_NAMESPACE}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${TISS_NAMESPACE} tissV3_05_00.xsd">

  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${lote.numeroLote}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${dataGeracao}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${horaGeracao}</ans:horaRegistroTransacao>
      <ans:versaoPadrao>${TISS_VERSAO}</ans:versaoPadrao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        <ans:CNPJ>${limparCNPJ(lote.prestadora.cnpj)}</ans:CNPJ>
        <ans:codigoPrestadorNaOperadora>${esc(lote.prestadora.codigoNaOperadora)}</ans:codigoPrestadorNaOperadora>
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${esc(lote.convenioANS)}</ans:registroANS>
    </ans:destino>
  </ans:cabecalho>

  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${lote.numeroLote}</ans:numeroLote>
      <ans:guias>
        ${guiasXML}
      </ans:guias>
      <ans:valorTotalGeral>${fmt(lote.valorTotal)}</ans:valorTotalGeral>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>

  <ans:epilogo>
    <ans:hash>${gerarHashSimples(guiasXML)}</ans:hash>
  </ans:epilogo>

</ans:mensagemTISS>`;

  return xml;
}

// ─── Validação pré-envio ──────────────────────────────────────────────────────
export function validarLoteTISS(lote: LoteTISS): ErroValidacaoTISS[] {
  const erros: ErroValidacaoTISS[] = [];

  // Validar prestadora
  if (!lote.prestadora.cnpj || limparCNPJ(lote.prestadora.cnpj).length !== 14) {
    erros.push({ campo: 'prestadora.cnpj', mensagem: 'CNPJ da prestadora inválido (deve ter 14 dígitos)', severity: 'error' });
  }
  if (!lote.prestadora.codigoNaOperadora) {
    erros.push({ campo: 'prestadora.codigoNaOperadora', mensagem: 'Código da prestadora na operadora é obrigatório', severity: 'error' });
  }
  if (!lote.convenioANS || lote.convenioANS.length < 3) {
    erros.push({ campo: 'convenioANS', mensagem: 'Código ANS da operadora é obrigatório', severity: 'error' });
  }
  if (lote.guias.length === 0) {
    erros.push({ campo: 'guias', mensagem: 'O lote não possui guias', severity: 'error' });
  }

  // Validar cada guia
  lote.guias.forEach((guia) => {
    const num = guia.numeroGuia;

    // Beneficiário
    if (!guia.beneficiario.numeroCarteirinha) {
      erros.push({ campo: 'beneficiario.numeroCarteirinha', mensagem: 'Número da carteirinha é obrigatório', guiaNumero: num, severity: 'error', codigoGlosa: '01' });
    }
    if (!guia.beneficiario.nome) {
      erros.push({ campo: 'beneficiario.nome', mensagem: 'Nome do beneficiário é obrigatório', guiaNumero: num, severity: 'error' });
    }
    if (!guia.beneficiario.dataNascimento) {
      erros.push({ campo: 'beneficiario.dataNascimento', mensagem: 'Data de nascimento do beneficiário é obrigatória', guiaNumero: num, severity: 'error' });
    }

    // Data de atendimento
    if (!guia.dataAtendimento) {
      erros.push({ campo: 'dataAtendimento', mensagem: 'Data de atendimento é obrigatória', guiaNumero: num, severity: 'error', codigoGlosa: '12' });
    }

    // Profissional executante
    const exec = guia.profissionalExecutante;
    if (!exec?.nome) {
      erros.push({ campo: 'profissionalExecutante.nome', mensagem: 'Nome do profissional executante é obrigatório', guiaNumero: num, severity: 'error' });
    }
    if (!exec?.cpf || limparCPF(exec.cpf).length !== 11) {
      erros.push({ campo: 'profissionalExecutante.cpf', mensagem: 'CPF do profissional executante inválido', guiaNumero: num, severity: 'error', codigoGlosa: '11' });
    }
    if (!exec?.crm) {
      erros.push({ campo: 'profissionalExecutante.crm', mensagem: 'Número do conselho profissional é obrigatório', guiaNumero: num, severity: 'warning', codigoGlosa: '11' });
    }

    // Procedimentos por tipo
    if (guia.tipo === 'guiaConsulta') {
      const g = guia as GuiaConsulta;
      if (!g.procedimento?.codigoTUSS) {
        erros.push({ campo: 'procedimento.codigoTUSS', mensagem: 'Código TUSS do procedimento é obrigatório', guiaNumero: num, severity: 'error', codigoGlosa: '05' });
      }
      if (!g.procedimento?.valorTotal || g.procedimento.valorTotal <= 0) {
        erros.push({ campo: 'procedimento.valorTotal', mensagem: 'Valor do procedimento deve ser maior que zero', guiaNumero: num, severity: 'error', codigoGlosa: '13' });
      }
    }

    if (guia.tipo === 'guiaSADT' || guia.tipo === 'guiaHonorarios') {
      const g = guia as GuiaSADT | GuiaHonorarios;
      if (!g.procedimentos || g.procedimentos.length === 0) {
        erros.push({ campo: 'procedimentos', mensagem: 'A guia deve ter ao menos um procedimento', guiaNumero: num, severity: 'error' });
      }
      g.procedimentos?.forEach((p, i) => {
        if (!p.codigoTUSS) {
          erros.push({ campo: `procedimentos[${i}].codigoTUSS`, mensagem: `Procedimento ${i + 1}: código TUSS obrigatório`, guiaNumero: num, severity: 'error', codigoGlosa: '05' });
        }
        if (!p.valorTotal || p.valorTotal <= 0) {
          erros.push({ campo: `procedimentos[${i}].valorTotal`, mensagem: `Procedimento ${i + 1}: valor deve ser maior que zero`, guiaNumero: num, severity: 'error', codigoGlosa: '13' });
        }
      });
    }
  });

  return erros;
}

// ─── Parser de XML de retorno (protocolo) ────────────────────────────────────
export function parseXMLRetorno(xmlRetorno: string): {
  protocolo?: string;
  situacao?: string;
  mensagem?: string;
  erros?: Array<{ guia: string; codigo: string; descricao: string }>;
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlRetorno, 'application/xml');

    const protocolo = doc.querySelector('protocolo')?.textContent ?? undefined;
    const situacao = doc.querySelector('situacaoLote')?.textContent ?? undefined;
    const mensagem = doc.querySelector('mensagem')?.textContent ?? undefined;

    const errosEls = doc.querySelectorAll('erroProcessamento');
    const erros = Array.from(errosEls).map((el) => ({
      guia: el.querySelector('numeroGuia')?.textContent ?? '',
      codigo: el.querySelector('codigo')?.textContent ?? '',
      descricao: el.querySelector('descricao')?.textContent ?? '',
    }));

    return { protocolo, situacao, mensagem, erros };
  } catch {
    return { mensagem: 'Erro ao processar XML de retorno' };
  }
}
