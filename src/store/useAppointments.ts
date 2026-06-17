// Store de agendamentos sem Zustand — compatível com Vite 7 + React 18
// Usa localStorage + eventos customizados para sincronizar entre componentes

const STORAGE_KEY = "nexaclinic_appointments";

export interface Appointment {
  id: string;
  patient: string;
  doctor: string;
  date: string;
  time: string;
}

function readFromStorage(): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function writeToStorage(appointments: Appointment[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  // Notifica outros componentes que escutam este evento
  window.dispatchEvent(new CustomEvent("nexaclinic:appointments-changed"));
}

export const useAppointmentStore = {
  getAll(): Appointment[] {
    return readFromStorage();
  },

  addAppointment(appointment: Appointment) {
    const updated = [...readFromStorage(), appointment];
    writeToStorage(updated);
  },

  removeAppointment(id: string) {
    const updated = readFromStorage().filter((a) => a.id !== id);
    writeToStorage(updated);
  },

  // Compatibilidade com código antigo que chamava loadAppointments()
  loadAppointments() {
    return readFromStorage();
  },
};
