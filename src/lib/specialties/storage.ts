import type { Specialty } from './types';

const STORAGE_KEY = 'hexaclinic_specialties';

export const specialtyStorage = {
  getSpecialties(): Specialty[] {
    try {
      if (typeof window === 'undefined') return [];
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Erro ao carregar especialidades:', error);
      return [];
    }
  },

  saveSpecialty(specialty: Specialty): Specialty {
    try {
      if (typeof window === 'undefined') return specialty;
      const specialties = this.getSpecialties();
      const index = specialties.findIndex(s => s.id === specialty.id);

      if (index >= 0) {
        specialties[index] = specialty;
      } else {
        specialties.push(specialty);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(specialties));
      return specialty;
    } catch (error) {
      console.error('Erro ao salvar especialidade:', error);
      throw error;
    }
  },

  saveSpecialties(specialties: Specialty[]): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(specialties));
    } catch (error) {
      console.error('Erro ao salvar especialidades:', error);
      throw error;
    }
  },

  deleteSpecialty(id: string): void {
    try {
      if (typeof window === 'undefined') return;
      const specialties = this.getSpecialties();
      const filtered = specialties.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Erro ao deletar especialidade:', error);
      throw error;
    }
  },

  clearAll(): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar especialidades:', error);
      throw error;
    }
  },
};
