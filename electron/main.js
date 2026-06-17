import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow;

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// =========================
// CREATE PATIENT
// =========================
ipcMain.handle("create-patient", async (_, patient) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO patients (
        name,
        cpf,
        birth,
        phone,
        email,
        insurance,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patient.name,
      patient.cpf || "",
      patient.birth || "",
      patient.phone || "",
      patient.email || "",
      patient.insurance || "Particular",
      patient.status || "ativo"
    );

    return {
      success: true,
      id: result.lastInsertRowid,
    };
  } catch (error) {
    console.error("[create-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// GET PATIENTS
// =========================
ipcMain.handle("get-patients", async () => {
  try {
    const stmt = db.prepare(`
      SELECT *
      FROM patients
      ORDER BY id DESC
    `);

    return stmt.all();
  } catch (error) {
    console.error("[get-patients]", error);
    return [];
  }
});

// =========================
// UPDATE PATIENT
// =========================
ipcMain.handle("update-patient", async (_, id, patient) => {
  try {
    const stmt = db.prepare(`
      UPDATE patients
      SET
        name      = ?,
        cpf       = ?,
        birth     = ?,
        phone     = ?,
        email     = ?,
        insurance = ?,
        status    = ?
      WHERE id = ?
    `);

    stmt.run(
      patient.name,
      patient.cpf || "",
      patient.birth || "",
      patient.phone || "",
      patient.email || "",
      patient.insurance || "Particular",
      patient.status || "ativo",
      id
    );

    return { success: true };
  } catch (error) {
    console.error("[update-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// DELETE PATIENT
// =========================
ipcMain.handle("delete-patient", async (_, id) => {
  try {
    const stmt = db.prepare(`
      DELETE FROM patients
      WHERE id = ?
    `);

    stmt.run(id);

    return { success: true };
  } catch (error) {
    console.error("[delete-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// BACKUP DATABASE
// =========================
ipcMain.handle("backup-database", async () => {
  try {
    const userPath = app.getPath("documents");
    const backupDir = path.join(userPath, "NexaClinic", "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupName = `backup-${Date.now()}.db`;
    const source = path.join(app.getPath("userData"), "nexaclinic.db");
    const destination = path.join(backupDir, backupName);

    fs.copyFileSync(source, destination);

    return { success: true, path: destination };
  } catch (error) {
    console.error("[backup-database]", error);
    return { success: false, error: (error as Error).message };
  }
});

// =========================
// CREATE WINDOW
// =========================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
     icon: path.join(process.cwd(), "assets/icon.ico"),
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null as any;
  });
}

// =========================
// APP LIFECYCLE
// =========================
app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
