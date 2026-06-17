import { useState, useEffect } from "react";
export interface Specialty { id: string; name: string; }
const KEY = "nexaclinic_specialties_store";
const EV  = "nexaclinic:specialties-changed";
function read(): Specialty[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } }
function write(s: Specialty[]) { localStorage.setItem(KEY, JSON.stringify(s)); window.dispatchEvent(new CustomEvent(EV)); }
export const specialtyStore = {
  getAll: () => read(),
  add: (s: Specialty) => write([...read(), s]),
  remove: (id: string) => write(read().filter((x) => x.id !== id)),
};
export function useSpecialty() {
  const [specialties, setSpecialties] = useState(read);
  useEffect(() => { const h = () => setSpecialties(read()); window.addEventListener(EV, h); return () => window.removeEventListener(EV, h); }, []);
  return { specialties, addSpecialty: (s: Specialty) => specialtyStore.add(s) };
}
