export interface Anamnese {
  queixaPrincipal: string;
  historicoDoencaAtual: string;
  alergias: string;
  medicamentos: string;
  cirurgias: string;
  observacoes: string;
}

export interface Evolucao {
  id: string;
  data: string;
  profissional: string;
  descricao: string;
  cid10: string;
}

export interface Anexo {
  id: string;
  nome: string;
  url: string;
  tipo: string;
  data: string;
}

export interface Prontuario {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  dataCriacao: string;
  anamnese: Anamnese;
  evolucoes: Evolucao[];
  anexos: Anexo[];
}