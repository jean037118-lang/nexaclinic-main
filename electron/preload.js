import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {

  patients: {

    create: (data) =>
      ipcRenderer.invoke("patients:create", data),

    list: () =>
      ipcRenderer.invoke("patients:list")

  }

});