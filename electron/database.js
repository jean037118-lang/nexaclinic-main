import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import fs from "fs";

const userDataPath = app.getPath("userData");

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

const dbPath = path.join(userDataPath, "nexaclinic.db");

const db = new Database(dbPath);

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

const existingCols = db
  .prepare("PRAGMA table_info(patients)")
  .all()
  .map((c: any) => c.name);

if (!existingCols.includes("birth")) {
  db.exec(`ALTER TABLE patients ADD COLUMN birth TEXT DEFAULT ''`);
}
if (!existingCols.includes("insurance")) {
  db.exec(`ALTER TABLE patients ADD COLUMN insurance TEXT DEFAULT 'Particular'`);
}
if (!existingCols.includes("status")) {
  db.exec(`ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'ativo'`);
}

export default db;
