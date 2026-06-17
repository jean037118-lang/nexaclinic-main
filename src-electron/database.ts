import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const userDataPath = app.getPath("userData");
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, "nexaclinic.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// ========================================
// TABELA PATIENTS
// ========================================
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

const existingCols = db.prepare("PRAGMA table_info(patients)").all().map((c: any) => c.name);
if (!existingCols.includes("birth"))     db.exec(`ALTER TABLE patients ADD COLUMN birth TEXT DEFAULT ''`);
if (!existingCols.includes("insurance")) db.exec(`ALTER TABLE patients ADD COLUMN insurance TEXT DEFAULT 'Particular'`);
if (!existingCols.includes("status"))    db.exec(`ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'ativo'`);

// ========================================
// TABELA USERS
// ========================================
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

// ========================================
// SESSÕES (token simples em memória + db)
// ========================================
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    token      TEXT    NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// ========================================
// HELPERS DE SENHA (sem bcrypt nativo)
// Usa PBKDF2 do Node — sem dependência extra
// ========================================
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 100_000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const verify = crypto
    .pbkdf2Sync(password, salt, 100_000, 64, "sha512")
    .toString("hex");
  return verify === hash;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// ========================================
// SEED: cria admin padrão se não existir
// ========================================
const adminExists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
if (!adminExists) {
  db.prepare(`
    INSERT INTO users (name, username, password, role)
    VALUES (?, ?, ?, ?)
  `).run("Administrador", "admin", hashPassword("admin123"), "admin");
  console.log("✅ Usuário admin criado (senha: admin123)");
}

export default db;
