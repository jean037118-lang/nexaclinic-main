import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import db, { hashPassword, verifyPassword, generateToken } from "./database";
import { initWhatsApp } from "./whatsapp";

const __dirname = app.getAppPath();

let mainWindow: BrowserWindow;

const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;

// ========================================
// AUTO BACKUP
// ========================================
function autoBackupDatabase() {
  try {
    const backupDir = path.join(app.getPath("documents"), "NexaClinic", "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // mantém apenas 30 backups
    const files = fs
      .readdirSync(backupDir)
      .filter(f => f.endsWith(".db"))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 30) {
      files.slice(30).forEach(f => fs.unlinkSync(path.join(backupDir, f.name)));
    }

    const d = new Date();
    const backupName = `backup-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}.db`;
    const source = db.memory ? path.join(app.getPath("userData"), "nexaclinic.db") : db.name;

    fs.copyFileSync(source, path.join(backupDir, backupName));
    console.log("✅ Backup automático criado");
  } catch (error) {
    console.error("❌ Erro backup automático", error);
  }
}

// ========================================
// AUTH — LOGIN
// ========================================
ipcMain.handle("auth-login", async (_, username: string, password: string) => {
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ? AND active = 1")
      .get(username) as any;

    if (!user) {
      return { success: false, error: "Usuário não encontrado ou inativo." };
    }

    const valid = verifyPassword(password, user.password);
    if (!valid) {
      return { success: false, error: "Senha incorreta." };
    }

    const token = generateToken();

    // limpa sessões antigas deste usuário (opcional: permite múltiplas sessões se remover)
    

    db.prepare("INSERT INTO sessions (user_id, token) VALUES (?, ?)").run(user.id, token);

    return {
      success: true,
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role },
    };
  } catch (error) {
    console.error("[auth-login]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// AUTH — VALIDATE SESSION
// ========================================
ipcMain.handle("auth-validate", async (_, token: string) => {
  try {
    if (!token) return { valid: false };

    const session = db
      .prepare(`
        SELECT s.token, u.id, u.name, u.username, u.role, u.active
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
      `)
      .get(token) as any;

    if (!session || !session.active) return { valid: false };

    return {
      valid: true,
      user: { id: session.id, name: session.name, username: session.username, role: session.role },
    };
  } catch (error) {
    console.error("[auth-validate]", error);
    return { valid: false };
  }
});

// ========================================
// AUTH — LOGOUT
// ========================================
ipcMain.handle("auth-logout", async (_, token: string) => {
  try {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return { success: true };
  } catch (error) {
    console.error("[auth-logout]", error);
    return { success: false };
  }
});

// ========================================
// USERS — GET
// ========================================
ipcMain.handle("get-users", async () => {
  try {
    return db.prepare("SELECT id, name, username, role, active, created_at FROM users ORDER BY id ASC").all();
  } catch (error) {
    console.error("[get-users]", error);
    return [];
  }
});

// ========================================
// USERS — CREATE
// ========================================
ipcMain.handle("create-user", async (_, user) => {
  try {
    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(user.username);
    if (existing) return { success: false, error: "Nome de usuário já existe." };

    const result = db
      .prepare("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)")
      .run(user.name, user.username, hashPassword(user.password), user.role || "user");

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[create-user]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// USERS — UPDATE
// ========================================
ipcMain.handle("update-user", async (_, id, user) => {
  try {
    if (user.password) {
      db.prepare("UPDATE users SET name = ?, username = ?, password = ?, role = ?, active = ? WHERE id = ?")
        .run(user.name, user.username, hashPassword(user.password), user.role, user.active ?? 1, id);
    } else {
      db.prepare("UPDATE users SET name = ?, username = ?, role = ?, active = ? WHERE id = ?")
        .run(user.name, user.username, user.role, user.active ?? 1, id);
    }
    return { success: true };
  } catch (error) {
    console.error("[update-user]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// USERS — DELETE
// ========================================
ipcMain.handle("delete-user", async (_, id) => {
  try {
    const count = (db.prepare("SELECT COUNT(*) as c FROM users WHERE active = 1").get() as any).c;
    if (count <= 1) return { success: false, error: "Não é possível excluir o último usuário ativo." };

    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    console.error("[delete-user]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// PATIENTS — CREATE
// ========================================
ipcMain.handle("create-patient", async (_, patient) => {
  try {
    const result = db
      .prepare(`INSERT INTO patients (name, cpf, birth, phone, email, insurance, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(patient.name, patient.cpf || "", patient.birth || "", patient.phone || "", patient.email || "", patient.insurance || "Particular", patient.status || "ativo");

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[create-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// PATIENTS — GET
// ========================================
ipcMain.handle("get-patients", async () => {
  try {
    return db.prepare("SELECT * FROM patients ORDER BY id DESC").all();
  } catch (error) {
    console.error("[get-patients]", error);
    return [];
  }
});

// ========================================
// PATIENTS — UPDATE
// ========================================
ipcMain.handle("update-patient", async (_, id, patient) => {
  try {
    db.prepare(`UPDATE patients SET name=?, cpf=?, birth=?, phone=?, email=?, insurance=?, status=? WHERE id=?`)
      .run(patient.name, patient.cpf || "", patient.birth || "", patient.phone || "", patient.email || "", patient.insurance || "Particular", patient.status || "ativo", id);

    return { success: true };
  } catch (error) {
    console.error("[update-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// PATIENTS — DELETE
// ========================================
ipcMain.handle("delete-patient", async (_, id) => {
  try {
    db.prepare("DELETE FROM patients WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    console.error("[delete-patient]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// BACKUP MANUAL
// ========================================
ipcMain.handle("backup-database", async () => {
  try {
    const backupDir = path.join(app.getPath("documents"), "NexaClinic", "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupName = `backup-${Date.now()}.db`;
    const source = db.memory ? path.join(app.getPath("userData"), "nexaclinic.db") : db.name;
    const destination = path.join(backupDir, backupName);

    fs.copyFileSync(source, destination);
    return { success: true, path: destination };
  } catch (error) {
    console.error("[backup-database]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// RESTORE BACKUP
// ========================================
ipcMain.handle("restore-backup", async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: "Selecionar Backup",
      filters: [{ name: "Banco SQLite", extensions: ["db"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) return { success: false };

    const databasePath = db.memory ? path.join(app.getPath("userData"), "nexaclinic.db") : db.name;

    db.close();
    fs.copyFileSync(result.filePaths[0], databasePath);

    app.relaunch();
    app.exit();

    return { success: true };
  } catch (error) {
    console.error("[restore-backup]", error);
    return { success: false, error: (error as Error).message };
  }
});

// ========================================
// WINDOW
// ========================================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, "../assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "dist-electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null as any;
  });
}

// ========================================
// APP READY
// ========================================
app.on("ready", () => {
  createWindow();
  autoBackupDatabase();
  setInterval(autoBackupDatabase, 1000 * 60 * 60 * 6);

  // Inicializa o cliente do WhatsApp (whatsapp-web.js)
  // A primeira vez vai exigir leitura do QR Code na tela de Configurações > WhatsApp
  initWhatsApp(mainWindow);
});

// No evento window-all-closed
app.on("window-all-closed", () => {
  // Limpa sessão no renderer antes de fechar
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `localStorage.removeItem('nexaclinic_sessao_v2')`
    );
  }
  if (process.platform !== "darwin") app.quit();
});


app.on("activate", () => {
  if (mainWindow === null) createWindow();
});
