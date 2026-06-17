import { Prontuario } from './types';

const STORAGE_KEY = 'nexaclinic_prontuarios';

export function readProntuarios(): Prontuario[] {
  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) {
    return [];
  }

  return JSON.parse(data);
}

export function saveProntuarios(prontuarios: Prontuario[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prontuarios));
}