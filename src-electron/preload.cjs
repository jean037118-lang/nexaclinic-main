"use strict";

// src-electron/preload.ts
var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  // ── Patients ──────────────────────────────────────
  createPatient: (patient) => import_electron.ipcRenderer.invoke("create-patient", patient),
  getPatients: () => import_electron.ipcRenderer.invoke("get-patients"),
  updatePatient: (id, patient) => import_electron.ipcRenderer.invoke("update-patient", id, patient),
  deletePatient: (id) => import_electron.ipcRenderer.invoke("delete-patient", id),
  // ── Backup ────────────────────────────────────────
  backupDatabase: () => import_electron.ipcRenderer.invoke("backup-database"),
  restoreBackup: () => import_electron.ipcRenderer.invoke("restore-backup"),
  // ── Auth ──────────────────────────────────────────
  /** Faz login. Retorna { success, token, user } ou { success: false, error } */
  login: (username, password) => import_electron.ipcRenderer.invoke("auth-login", username, password),
  /** Valida token salvo. Retorna { valid, user } */
  validateSession: (token) => import_electron.ipcRenderer.invoke("auth-validate", token),
  /** Encerra sessão */
  logout: (token) => import_electron.ipcRenderer.invoke("auth-logout", token),
  // ── Usuários (admin) ──────────────────────────────
  getUsers: () => import_electron.ipcRenderer.invoke("get-users"),
  createUser: (user) => import_electron.ipcRenderer.invoke("create-user", user),
  updateUser: (id, user) => import_electron.ipcRenderer.invoke("update-user", id, user),
  deleteUser: (id) => import_electron.ipcRenderer.invoke("delete-user", id)
});
import_electron.contextBridge.exposeInMainWorld("api", {
  send: (channel, data) => {
    const allowed = ["window-minimize", "window-maximize", "window-close"];
    if (allowed.includes(channel)) return import_electron.ipcRenderer.invoke(channel, data);
  }
});
