"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src-electron/main.ts
var import_electron2 = require("electron");
var import_path2 = __toESM(require("path"), 1);
var import_fs2 = __toESM(require("fs"), 1);

// src-electron/database.ts
var import_better_sqlite3 = __toESM(require("better-sqlite3"), 1);
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var userDataPath = import_electron.app.getPath("userData");
if (!import_fs.default.existsSync(userDataPath)) {
  import_fs.default.mkdirSync(userDataPath, { recursive: true });
}
var dbPath = import_path.default.join(userDataPath, "nexaclinic.db");
var db = new import_better_sqlite3.default(dbPath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    cpf       TEXT    DEFAULT '',
    birth     TEXT    DEFAULT '',
    phone     TEXT    DEFAULT '',
    email     TEXT    DEFAULT '',
    insurance TEXT    DEFAULT 'Particular',
    status    TEXT    DEFAULT 'ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
var existingCols = db.prepare("PRAGMA table_info(patients)").all().map((c) => c.name);
if (!existingCols.includes("birth"))
  db.exec(`ALTER TABLE patients ADD COLUMN birth TEXT DEFAULT ''`);
if (!existingCols.includes("insurance"))
  db.exec(`ALTER TABLE patients ADD COLUMN insurance TEXT DEFAULT 'Particular'`);
if (!existingCols.includes("status"))
  db.exec(`ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'ativo'`);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'user',
    active     INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    token      TEXT    NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);
function hashPassword(password) {
  const salt = import_crypto.default.randomBytes(16).toString("hex");
  const hash = import_crypto.default.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const verify = import_crypto.default.pbkdf2Sync(password, salt, 1e5, 64, "sha512").toString("hex");
  return verify === hash;
}
function generateToken() {
  return import_crypto.default.randomBytes(32).toString("hex");
}
var adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (name, username, password, role)
    VALUES (?, ?, ?, ?)
  `).run("Administrador", "admin", hashPassword("admin123"), "admin");
  console.log("\u2705 Usu\xE1rio admin criado (senha: admin123)");
}
var database_default = db;

// src-electron/main.ts
var __dirname = import_electron2.app.getAppPath();
var mainWindow;
var isDev = process.env.VITE_DEV_SERVER_URL !== void 0;
function autoBackupDatabase() {
  try {
    const backupDir = import_path2.default.join(import_electron2.app.getPath("documents"), "NexaClinic", "backups");
    if (!import_fs2.default.existsSync(backupDir)) {
      import_fs2.default.mkdirSync(backupDir, { recursive: true });
    }
    const files = import_fs2.default.readdirSync(backupDir).filter((f) => f.endsWith(".db")).map((f) => ({ name: f, time: import_fs2.default.statSync(import_path2.default.join(backupDir, f)).mtime.getTime() })).sort((a, b) => b.time - a.time);
    if (files.length > 30) {
      files.slice(30).forEach((f) => import_fs2.default.unlinkSync(import_path2.default.join(backupDir, f.name)));
    }
    const d = /* @__PURE__ */ new Date();
    const backupName = `backup-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}.db`;
    const source = database_default.memory ? import_path2.default.join(import_electron2.app.getPath("userData"), "nexaclinic.db") : database_default.name;
    import_fs2.default.copyFileSync(source, import_path2.default.join(backupDir, backupName));
    console.log("\u2705 Backup autom\xE1tico criado");
  } catch (error) {
    console.error("\u274C Erro backup autom\xE1tico", error);
  }
}
import_electron2.ipcMain.handle("auth-login", async (_, username, password) => {
  try {
    const user = database_default.prepare("SELECT * FROM users WHERE username = ? AND active = 1").get(username);
    if (!user) {
      return { success: false, error: "Usu\xE1rio n\xE3o encontrado ou inativo." };
    }
    const valid = verifyPassword(password, user.password);
    if (!valid) {
      return { success: false, error: "Senha incorreta." };
    }
    const token = generateToken();
    database_default.prepare("INSERT INTO sessions (user_id, token) VALUES (?, ?)").run(user.id, token);
    return {
      success: true,
      token,
      user: { id: user.id, name: user.name, username: user.username, role: user.role }
    };
  } catch (error) {
    console.error("[auth-login]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("auth-validate", async (_, token) => {
  try {
    if (!token)
      return { valid: false };
    const session = database_default.prepare(`
        SELECT s.token, u.id, u.name, u.username, u.role, u.active
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
      `).get(token);
    if (!session || !session.active)
      return { valid: false };
    return {
      valid: true,
      user: { id: session.id, name: session.name, username: session.username, role: session.role }
    };
  } catch (error) {
    console.error("[auth-validate]", error);
    return { valid: false };
  }
});
import_electron2.ipcMain.handle("auth-logout", async (_, token) => {
  try {
    database_default.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return { success: true };
  } catch (error) {
    console.error("[auth-logout]", error);
    return { success: false };
  }
});
import_electron2.ipcMain.handle("get-users", async () => {
  try {
    return database_default.prepare("SELECT id, name, username, role, active, created_at FROM users ORDER BY id ASC").all();
  } catch (error) {
    console.error("[get-users]", error);
    return [];
  }
});
import_electron2.ipcMain.handle("create-user", async (_, user) => {
  try {
    const existing = database_default.prepare("SELECT id FROM users WHERE username = ?").get(user.username);
    if (existing)
      return { success: false, error: "Nome de usu\xE1rio j\xE1 existe." };
    const result = database_default.prepare("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)").run(user.name, user.username, hashPassword(user.password), user.role || "user");
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[create-user]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("update-user", async (_, id, user) => {
  try {
    if (user.password) {
      database_default.prepare("UPDATE users SET name = ?, username = ?, password = ?, role = ?, active = ? WHERE id = ?").run(user.name, user.username, hashPassword(user.password), user.role, user.active ?? 1, id);
    } else {
      database_default.prepare("UPDATE users SET name = ?, username = ?, role = ?, active = ? WHERE id = ?").run(user.name, user.username, user.role, user.active ?? 1, id);
    }
    return { success: true };
  } catch (error) {
    console.error("[update-user]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("delete-user", async (_, id) => {
  try {
    const count = database_default.prepare("SELECT COUNT(*) as c FROM users WHERE active = 1").get().c;
    if (count <= 1)
      return { success: false, error: "N\xE3o \xE9 poss\xEDvel excluir o \xFAltimo usu\xE1rio ativo." };
    database_default.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    database_default.prepare("DELETE FROM users WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    console.error("[delete-user]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("create-patient", async (_, patient) => {
  try {
    const result = database_default.prepare(`INSERT INTO patients (name, cpf, birth, phone, email, insurance, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(patient.name, patient.cpf || "", patient.birth || "", patient.phone || "", patient.email || "", patient.insurance || "Particular", patient.status || "ativo");
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("[create-patient]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("get-patients", async () => {
  try {
    return database_default.prepare("SELECT * FROM patients ORDER BY id DESC").all();
  } catch (error) {
    console.error("[get-patients]", error);
    return [];
  }
});
import_electron2.ipcMain.handle("update-patient", async (_, id, patient) => {
  try {
    database_default.prepare(`UPDATE patients SET name=?, cpf=?, birth=?, phone=?, email=?, insurance=?, status=? WHERE id=?`).run(patient.name, patient.cpf || "", patient.birth || "", patient.phone || "", patient.email || "", patient.insurance || "Particular", patient.status || "ativo", id);
    return { success: true };
  } catch (error) {
    console.error("[update-patient]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("delete-patient", async (_, id) => {
  try {
    database_default.prepare("DELETE FROM patients WHERE id = ?").run(id);
    return { success: true };
  } catch (error) {
    console.error("[delete-patient]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("backup-database", async () => {
  try {
    const backupDir = import_path2.default.join(import_electron2.app.getPath("documents"), "NexaClinic", "backups");
    if (!import_fs2.default.existsSync(backupDir))
      import_fs2.default.mkdirSync(backupDir, { recursive: true });
    const backupName = `backup-${Date.now()}.db`;
    const source = database_default.memory ? import_path2.default.join(import_electron2.app.getPath("userData"), "nexaclinic.db") : database_default.name;
    const destination = import_path2.default.join(backupDir, backupName);
    import_fs2.default.copyFileSync(source, destination);
    return { success: true, path: destination };
  } catch (error) {
    console.error("[backup-database]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("restore-backup", async () => {
  try {
    const result = await import_electron2.dialog.showOpenDialog({
      title: "Selecionar Backup",
      filters: [{ name: "Banco SQLite", extensions: ["db"] }],
      properties: ["openFile"]
    });
    if (result.canceled || result.filePaths.length === 0)
      return { success: false };
    const databasePath = database_default.memory ? import_path2.default.join(import_electron2.app.getPath("userData"), "nexaclinic.db") : database_default.name;
    database_default.close();
    import_fs2.default.copyFileSync(result.filePaths[0], databasePath);
    import_electron2.app.relaunch();
    import_electron2.app.exit();
    return { success: true };
  } catch (error) {
    console.error("[restore-backup]", error);
    return { success: false, error: error.message };
  }
});
import_electron2.ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});
import_electron2.ipcMain.handle("window-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) { mainWindow.unmaximize(); } else { mainWindow.maximize(); }
});
import_electron2.ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});
function createWindow() {
  mainWindow = new import_electron2.BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1e3,
    minHeight: 700,
    frame: false,
    titleBarStyle: "hidden",
    icon: import_path2.default.join(__dirname, "../assets/icon.ico"),
    webPreferences: {
      preload: import_path2.default.join(__dirname, "dist-electron/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(import_path2.default.join(__dirname, "dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
import_electron2.app.on("ready", () => {
  createWindow();
  autoBackupDatabase();
  setInterval(autoBackupDatabase, 1e3 * 60 * 60 * 6);
});
import_electron2.app.on("window-all-closed", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript(
      `localStorage.removeItem('nexaclinic_sessao_v2')`
    );
  }
  if (process.platform !== "darwin")
    import_electron2.app.quit();
});
import_electron2.app.on("activate", () => {
  if (mainWindow === null)
    createWindow();
});
