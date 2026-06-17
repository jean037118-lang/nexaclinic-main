'use client';

import { useState, useCallback, useEffect } from 'react';
import { specialtyStorage } from '@/lib/specialties/storage';
import type { Specialty, SpecialtyInput, SpecialtyResponse } from '@/lib/specialties/types';

/**
 * Hook para gerenciar especialidades
 */
export function useSpecialty() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  /**
   * Carrega especialidades ao montar (apenas no cliente)
   */
  useEffect(() => {
    setMounted(true);
    try {
      const loaded = specialtyStorage.getSpecialties();
      setSpecialties(loaded);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar especialidades');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cria uma nova especialidade
   */
  const createSpecialty = useCallback(
    (input: SpecialtyInput): SpecialtyResponse => {
      try {
        // Validação
        if (!input.name || input.name.trim() === '') {
          return {
            success: false,
            error: 'Nome da especialidade é obrigatório',
          };
        }

        // Verifica duplicata
        if (specialties.some(s => s.name.toLowerCase() === input.name.toLowerCase())) {
          return {
            success: false,
            error: 'Esta especialidade já existe',
          };
        }

        const newSpecialty: Specialty = {
          id: `specialty_${Date.now()}`,
          name: input.name.trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const saved = specialtyStorage.saveSpecialty(newSpecialty);
        setSpecialties(prev => [...prev, saved]);
        setError(null);

        return {
          success: true,
          data: saved,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao criar especialidade';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    [specialties]
  );

  /**
   * Atualiza uma especialidade
   */
  const updateSpecialty = useCallback(
    (id: string, input: SpecialtyInput): SpecialtyResponse => {
      try {
        if (!input.name || input.name.trim() === '') {
          return {
            success: false,
            error: 'Nome da especialidade é obrigatório',
          };
        }

        const current = specialties.find(s => s.id === id);
        if (!current) {
          return {
            success: false,
            error: 'Especialidade não encontrada',
          };
        }

        // Verifica duplicata (excluindo a atual)
        if (
          specialties.some(
            s =>
              s.id !== id &&
              s.name.toLowerCase() === input.name.toLowerCase()
          )
        ) {
          return {
            success: false,
            error: 'Já existe outra especialidade com este nome',
          };
        }

        const updated: Specialty = {
          ...current,
          name: input.name.trim(),
          updatedAt: new Date().toISOString(),
        };

        const saved = specialtyStorage.saveSpecialty(updated);
        setSpecialties(prev =>
          prev.map(s => (s.id === id ? saved : s))
        );
        setError(null);

        return {
          success: true,
          data: saved,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao atualizar especialidade';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    [specialties]
  );

  /**
   * Deleta uma especialidade
   */
  const deleteSpecialty = useCallback(
    (id: string): SpecialtyResponse => {
      try {
        const specialty = specialties.find(s => s.id === id);
        if (!specialty) {
          return {
            success: false,
            error: 'Especialidade não encontrada',
          };
        }

        specialtyStorage.deleteSpecialty(id);
        setSpecialties(prev => prev.filter(s => s.id !== id));
        setError(null);

        return {
          success: true,
          data: specialty,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao deletar especialidade';
        setError(errorMsg);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    [specialties]
  );

  /**
   * Busca especialidade por ID
   */
  const getSpecialtyById = useCallback(
    (id: string): Specialty | undefined => {
      return specialties.find(s => s.id === id);
    },
    [specialties]
  );

  /**
   * Busca especialidade por nome
   */
  const getSpecialtyByName = useCallback(
    (name: string): Specialty | undefined => {
      return specialties.find(
        s => s.name.toLowerCase() === name.toLowerCase()
      );
    },
    [specialties]
  );

  return {
    // Estado
    specialties,
    loading: loading || !mounted,
    error,
    mounted,

    // Operações
    createSpecialty,
    updateSpecialty,
    deleteSpecialty,
    getSpecialtyById,
    getSpecialtyByName,
  };
}
