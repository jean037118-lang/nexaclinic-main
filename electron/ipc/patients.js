import { ipcMain } from "electron";
import db from "../database.js";

export function registerPatientsIPC() {

  ipcMain.handle("patients:create", (_, patient) => {

    const stmt = db.prepare(`
      INSERT INTO patients
      (name, cpf, phone, email, birth_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      patient.name,
      patient.cpf,
      patient.phone,
      patient.email,
      patient.birth_date
    );

    return {
      success: true,
      id: result.lastInsertRowid
    };
  });

  ipcMain.handle("patients:list", () => {

    const stmt = db.prepare(`
      SELECT * FROM patients
      ORDER BY id DESC
    `);

    return stmt.all();
  });

}