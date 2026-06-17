const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // Pacientes
  createPatient:  (patient)      => ipcRenderer.invoke("create-patient", patient),
  getPatients:    ()             => ipcRenderer.invoke("get-patients"),
  updatePatient:  (id, patient)  => ipcRenderer.invoke("update-patient", id, patient),
  deletePatient:  (id)           => ipcRenderer.invoke("delete-patient", id),
  backupDatabase: ()             => ipcRenderer.invoke("backup-database"),

  // Controles da janela (titlebar customizada)
  send: (channel, data) => {
    const allowed = ["window-minimize", "window-maximize", "window-close"];
    if (allowed.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },
});
