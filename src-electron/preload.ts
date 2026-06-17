import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // ── Patients ──────────────────────────────────────
  createPatient: (patient: any) =>
    ipcRenderer.invoke("create-patient", patient),

  getPatients: () =>
    ipcRenderer.invoke("get-patients"),

  updatePatient: (id: number, patient: any) =>
    ipcRenderer.invoke("update-patient", id, patient),

  deletePatient: (id: number) =>
    ipcRenderer.invoke("delete-patient", id),

  // ── Backup ────────────────────────────────────────
  backupDatabase: () =>
    ipcRenderer.invoke("backup-database"),

  restoreBackup: () =>
    ipcRenderer.invoke("restore-backup"),

  // ── Auth ──────────────────────────────────────────
  /** Faz login. Retorna { success, token, user } ou { success: false, error } */
  login: (username: string, password: string) =>
    ipcRenderer.invoke("auth-login", username, password),

  /** Valida token salvo. Retorna { valid, user } */
  validateSession: (token: string) =>
    ipcRenderer.invoke("auth-validate", token),

  /** Encerra sessão */
  logout: (token: string) =>
    ipcRenderer.invoke("auth-logout", token),

  // ── Usuários (admin) ──────────────────────────────
  getUsers: () =>
    ipcRenderer.invoke("get-users"),

  createUser: (user: any) =>
    ipcRenderer.invoke("create-user", user),

  updateUser: (id: number, user: any) =>
    ipcRenderer.invoke("update-user", id, user),

  deleteUser: (id: number) =>
    ipcRenderer.invoke("delete-user", id),

  // ── WhatsApp ──────────────────────────────────────
  whatsapp: {
    /** Status atual: { status: "desconectado"|"aguardando_qr"|"conectando"|"conectado"|"erro", number } */
    getStatus: () => ipcRenderer.invoke("whatsapp-get-status"),

    /** Envia mensagem de texto. Retorna { success, error? } */
    sendMessage: (phone: string, message: string) =>
      ipcRenderer.invoke("whatsapp-send-message", phone, message),

    /** Desconecta e limpa a sessão salva (precisa ler QR novamente) */
    logout: () => ipcRenderer.invoke("whatsapp-logout"),

    /** Força reconexão / nova leitura de QR */
    reconnect: () => ipcRenderer.invoke("whatsapp-reconnect"),

    /** Recebe o QR Code (data URL base64 de imagem PNG) */
    onQr: (callback: (dataUrl: string) => void) => {
      const handler = (_: any, dataUrl: string) => callback(dataUrl);
      ipcRenderer.on("whatsapp-qr", handler);
      return () => ipcRenderer.removeListener("whatsapp-qr", handler);
    },

    /** Recebe atualizações de status: { status, number } */
    onStatus: (callback: (data: { status: string; number: string | null }) => void) => {
      const handler = (_: any, data: any) => callback(data);
      ipcRenderer.on("whatsapp-status", handler);
      return () => ipcRenderer.removeListener("whatsapp-status", handler);
    },
  },
});
