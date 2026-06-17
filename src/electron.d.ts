export {}

declare global {
  interface ElectronAPI {
    whatsapp: {
      getStatus: () => Promise<{ status: string; number: string | null }>;
      sendMessage: (phone: string, message: string) => Promise<{ success: boolean; error?: string }>;
      logout: () => Promise<{ success: boolean }>;
      reconnect: () => Promise<{ success: boolean }>;
      onQr: (callback: (dataUrl: string) => void) => () => void;
      onStatus: (callback: (data: { status: string; number: string | null }) => void) => () => void;
    };
    [key: string]: any;
  }

  interface Window {
    api: {
      send: (channel: string, data?: any) => Promise<any>
      createPatient: (patient: any) => Promise<any>
      getPatients: () => Promise<any>
      updatePatient: (id: number, patient: any) => Promise<any>
      deletePatient: (id: number) => Promise<any>
      backupDatabase: () => Promise<any>
    }
    electronAPI: ElectronAPI
  }
}
