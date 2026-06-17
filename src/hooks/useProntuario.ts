import { useEffect, useState } from 'react';
import { readProntuarios, saveProntuarios } from '@/lib/prontuario/storage';
import { Evolucao, Prontuario } from '@/lib/prontuario/types';

export function useProntuario() {
  const [prontuarios, setProntuarios] = useState<Prontuario[]>([]);

  useEffect(() => {
    setProntuarios(readProntuarios());
  }, []);

  function persist(list: Prontuario[]) {
    saveProntuarios(list);
    setProntuarios(list);
  }

  function criarProntuario(prontuario: Prontuario) {
    persist([...prontuarios, prontuario]);
  }

  function adicionarEvolucao(prontuarioId: string, evolucao: Evolucao) {
    const updated = prontuarios.map((p) => {
      if (p.id === prontuarioId) {
        return {
          ...p,
          evolucoes: [...p.evolucoes, evolucao],
        };
      }

      return p;
    });

    persist(updated);
  }

  return {
    prontuarios,
    criarProntuario,
    adicionarEvolucao,
  };
}