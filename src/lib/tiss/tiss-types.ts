/**
 * tiss-types.ts — NexaClinic
 * Tipos para TISS 3.05.00 (padrão ANS)
 * Suporte: Guia de Consulta, SADT, Honorários
 */

// ─── Versão e constantes TISS ─────────────────────────────────────────────────
export const TISS_VERSAO = '3.05.00';
export const TISS_NAMESPACE = 'http://www.ans.gov.br/padroes/tiss/schemas';

// ─── Tipos de guia ────────────────────────────────────────────────────────────
export type TipoGuia =
  | 'guiaConsulta'
  | 'guiaSADT'
  | 'guiaHonorarios'
  | 'guiaInternacao'
  | 'guiaResumoBeneficiario';

export type TipoTransacao = 'envioLote' | 'cancelamentoSolicitacao' | 'consultaSituacao';

export type SituacaoLote =
  | 'processado'
  | 'processadoComPendencia'
  | 'naoProcessado'
  | 'emProcessamento';

// ─── Erros de glosa (ANS) ─────────────────────────────────────────────────────
export type CodigoGlosa =
  | '01' // Carteirinha inválida
  | '02' // Carteirinha vencida
  | '03' // Beneficiário não elegível
  | '04' // Procedimento não coberto
  | '05' // Código TUSS inválido
  | '06' // Autorização inválida
  | '07' // Senha inválida ou vencida
  | '08' // Quantidade excedida
  | '09' // Duplicidade de cobrança
  | '10' // Profissional não credenciado
  | '11' // CRM inválido
  | '12' // Data de atendimento inválida
  | '13' // Valor inválido
  | '14' // Falta de documentação
  | '99'; // Outros

export const GLOSA_DESCRICAO: Record<CodigoGlosa, string> = {
  '01': 'Carteirinha inválida',
  '02': 'Carteirinha vencida',
  '03': 'Beneficiário não elegível',
  '04': 'Procedimento não coberto',
  '05': 'Código TUSS inválido',
  '06': 'Autorização inválida',
  '07': 'Senha inválida ou vencida',
  '08': 'Quantidade excedida',
  '09': 'Duplicidade de cobrança',
  '10': 'Profissional não credenciado',
  '11': 'CRM inválido',
  '12': 'Data de atendimento inválida',
  '13': 'Valor inválido',
  '14': 'Falta de documentação',
  '99': 'Outros',
};

// ─── Dados da prestadora (clínica) ───────────────────────────────────────────
export interface DadosPrestadora {
  cnpj: string;
  codigoNaOperadora: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnes?: string; // Cadastro Nacional de Estabelecimentos de Saúde
  telefone?: string;
  email?: string;
}

// ─── Dados do beneficiário (paciente) ────────────────────────────────────────
export interface DadosBeneficiario {
  numeroCarteirinha: string;
  nome: string;
  dataNascimento: string;   // DD/MM/YYYY
  cpf?: string;
  cns?: string;             // Cartão Nacional de Saúde
  planoId?: string;
  planoNome?: string;
  validade?: string;        // validade da carteirinha
}

// ─── Dados do profissional executante ────────────────────────────────────────
export interface DadosProfissional {
  nome: string;
  cpf: string;
  crm?: string;
  cbo?: string;             // Código Brasileiro de Ocupações
  conselho: 'CRM' | 'CRO' | 'CRN' | 'CREFITO' | 'CRP' | 'COREN' | 'CFO' | 'Outro';
  uf: string;
  grauParticipacao?: '00' | '01' | '02' | '03'; // 00=executante, 01=solicitante
}

// ─── Item de procedimento ────────────────────────────────────────────────────
export interface ItemProcedimento {
  codigoTUSS: string;        // código tabela TUSS
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  viaAcesso?: string;
  tecnicaUtilizada?: string;
  reducaoAcrescimo?: number;
}

// ─── Guia de Consulta ─────────────────────────────────────────────────────────
export interface GuiaConsulta {
  tipo: 'guiaConsulta';
  numeroGuia: string;
  dataAtendimento: string;    // YYYY-MM-DD
  dataAutorizacao?: string;
  numeroAutorizacao?: string;
  senhaAutorizacao?: string;
  indicacaoAcidente?: '0' | '1' | '2'; // 0=não, 1=sim-trânsito, 2=sim-trabalho
  tipoConsulta?: '1' | '2' | '3';      // 1=1ª consulta, 2=retorno, 3=pré-natal
  beneficiario: DadosBeneficiario;
  profissionalSolicitante?: DadosProfissional;
  profissionalExecutante: DadosProfissional;
  procedimento: ItemProcedimento;
  observacao?: string;
}

// ─── Guia de SADT ────────────────────────────────────────────────────────────
export interface GuiaSADT {
  tipo: 'guiaSADT';
  numeroGuia: string;
  dataAtendimento: string;
  dataAutorizacao?: string;
  numeroAutorizacao?: string;
  senhaAutorizacao?: string;
  tipoAtendimento?: '01' | '02' | '03' | '04'; // 01=simples, 02=urgência, etc.
  indicacaoAcidente?: '0' | '1' | '2';
  beneficiario: DadosBeneficiario;
  profissionalSolicitante: DadosProfissional;
  profissionalExecutante: DadosProfissional;
  procedimentos: ItemProcedimento[];
  observacao?: string;
}

// ─── Guia de Honorários ───────────────────────────────────────────────────────
export interface GuiaHonorarios {
  tipo: 'guiaHonorarios';
  numeroGuia: string;
  dataAtendimento: string;
  numeroAutorizacao?: string;
  senhaAutorizacao?: string;
  beneficiario: DadosBeneficiario;
  profissionalExecutante: DadosProfissional;
  procedimentos: ItemProcedimento[];
  observacao?: string;
}

export type GuiaTISS = GuiaConsulta | GuiaSADT | GuiaHonorarios;

// ─── Lote TISS ────────────────────────────────────────────────────────────────
export interface LoteTISS {
  id: string;
  loteId: string;           // ID do LoteFaturamento associado
  numeroLote: string;       // ex: "001"
  competencia: string;      // YYYY-MM
  convenioId: string;
  convenioNome: string;
  convenioANS: string;      // código ANS da operadora
  prestadora: DadosPrestadora;
  guias: GuiaTISS[];
  totalProcedimentos: number;
  valorTotal: number;
  dataGeracao: string;
  dataEnvio?: string;
  protocolo?: string;       // protocolo de retorno da operadora
  situacao: 'gerado' | 'validado' | 'enviado' | 'recebido' | 'processado' | 'erro';
  errosValidacao: ErroValidacaoTISS[];
  xmlGerado?: string;       // XML string gerado
  xmlRetorno?: string;      // XML de resposta da operadora
  hashXml?: string;         // hash do XML para integridade
  createdAt: string;
  updatedAt: string;
}

// ─── Erros de validação ───────────────────────────────────────────────────────
export interface ErroValidacaoTISS {
  campo: string;
  mensagem: string;
  codigoGlosa?: CodigoGlosa;
  guiaNumero?: string;
  severity: 'error' | 'warning';
}

// ─── Protocolo de recebimento ────────────────────────────────────────────────
export interface ProtocoloRecebimento {
  id: string;
  loteTissId: string;
  protocolo: string;
  dataRecebimento: string;
  situacao: SituacaoLote;
  mensagem?: string;
  totalGuias: number;
  totalGuiasProcessadas: number;
  totalGuiasComErro: number;
  valorProcessado: number;
  erros?: ErroRetornoTISS[];
  createdAt: string;
}

export interface ErroRetornoTISS {
  guiaNumero: string;
  codigo: string;
  descricao: string;
  codigoGlosa?: CodigoGlosa;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────
export const TISS_STORAGE_KEYS = {
  lotes: 'nexaclinic_tiss_lotes',
  protocolos: 'nexaclinic_tiss_protocolos',
  config: 'nexaclinic_tiss_config',
} as const;

// ─── Configuração TISS da clínica ────────────────────────────────────────────
export interface ConfiguracaoTISS {
  prestadora: DadosPrestadora;
  sequencialLote: number;   // contador para numerar lotes
  sequencialGuia: number;   // contador para numerar guias
}
