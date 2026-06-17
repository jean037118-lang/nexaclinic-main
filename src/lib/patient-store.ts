/**
 * patient-store.ts — versão localStorage (sem Supabase)
 * API pública: getAll, add, update, remove, upsertByName, subscribe
 */

import type { Patient } from "./mock-data";

const STORAGE_KEY = "nexaclinic_patients_v3";

type Listener = () => void;
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((l) => l());
}

function load(): Patient[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(patients: Patient[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
}

export const patientStore = {
  getAll(): Patient[] {
    return load();
  },

  add(data: Omit<Patient, "id">): Patient {
    const patients = load();
    const newPatient: Patient = {
      ...data,
      id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };
    patients.push(newPatient);
    save(patients);
    notify();
    return newPatient;
  },

  update(id: string, data: Partial<Omit<Patient, "id">>): void {
    const patients = load();
    const idx = patients.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Paciente não encontrado");
    patients[idx] = { ...patients[idx], ...data };
    save(patients);
    notify();
  },

  remove(id: string): void {
    const patients = load().filter((p) => p.id !== id);
    save(patients);
    notify();
  },

  async upsertByName(
    name: string,
    extra?: Partial<Omit<Patient, "id" | "name">>
  ): Promise<Patient> {
    const existing = load().find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      // Atualiza campos: CPF sempre atualiza se fornecido; outros só preenchem vazio
      const updates: Partial<Omit<Patient, "id">> = {};
      if (extra?.cpf && extra.cpf.trim()) updates.cpf = extra.cpf.trim();  // sempre atualiza CPF
      if (extra?.phone && !existing.phone) updates.phone = extra.phone;
      if (extra?.insurance && extra.insurance !== "Particular" && !existing.insurance)
        updates.insurance = extra.insurance;
      if (Object.keys(updates).length > 0) {
        patientStore.update(existing.id, updates);
        return { ...existing, ...updates };
      }
      return existing;
    }
    return patientStore.add({
      name,
      cpf: extra?.cpf ?? "",
      birth: extra?.birth ?? "",
      phone: extra?.phone ?? "",
      email: extra?.email ?? "",
      insurance: extra?.insurance ?? "Particular",
      lastVisit: extra?.lastVisit ?? new Date().toISOString().split("T")[0],
      status: extra?.status ?? "ativo",
    });
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
