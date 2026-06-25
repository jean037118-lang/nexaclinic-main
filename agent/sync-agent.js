/**
 * sync-agent.js — Nexa Sync Agent
 *
 * Lê o arquivo .db gerado pelo Nexa Clinic (SQLite) e sincroniza
 * os dados com o Supabase (Nexa Insight Web).
 *
 * Tabelas locais  →  Tabelas Supabase
 * ─────────────────────────────────────
 * patients        →  pacientes  (futura)
 * users           →  profiles   (somente leitura — não sobrescreve)
 * [financeiro, repasses, medicos vêm de versões futuras do sistema local]
 *
 * O campo external_id em cada tabela do Supabase serve como chave
 * de idempotência: upsert não duplica registros mesmo rodando várias vezes.
 */

import Database from "better-sqlite3";
import fetch from "node-fetch";
import cron from "node-cron";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { argv } from "process";

// ─── Config ────────────────────────────────────────────────────────────────

const CONFIG_PATH = resolve("./config.json");

if (!existsSync(CONFIG_PATH)) {
  console.error(
    "❌ config.json não encontrado. Execute: node setup.js"
  );
  process.exit(1);
}

const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
const { supabase_url, supabase_service_key, empresa_id, db_path, intervalo_minutos, log_level } = config;

const RUN_ONCE = argv.includes("--once");

// ─── Logger ────────────────────────────────────────────────────────────────

function log(level, msg, data) {
  const ts = new Date().toLocaleString("pt-BR");
  const prefix = { info: "ℹ️ ", warn: "⚠️ ", error: "❌", ok: "✅" }[level] ?? "  ";
  console.log(`[${ts}] ${prefix} ${msg}`, data ? JSON.stringify(data) : "");
}

// ─── Supabase helpers ───────────────────────────────────────────────────────

const HEADERS = {
  "Content-Type": "application/json",
  "apikey": supabase_service_key,
  "Authorization": `Bearer ${supabase_service_key}`,
  "Prefer": "resolution=merge-duplicates",
};

async function supabaseUpsert(table, rows) {
  if (!rows.length) return { count: 0 };

  const res = await fetch(`${supabase_url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${table}: ${res.status} — ${err}`);
  }

  return { count: rows.length };
}

async function supabaseInsertLog(entry) {
  try {
    await fetch(`${supabase_url}/rest/v1/logs_sincronizacao`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(entry),
    });
  } catch {
    // log failure não bloqueia o processo
  }
}

// ─── Leitura do banco local ─────────────────────────────────────────────────

function abrirBanco() {
  if (!existsSync(db_path)) {
    throw new Error(`Arquivo .db não encontrado: ${db_path}`);
  }
  return new Database(db_path, { readonly: true });
}

// Converte patients locais para o formato da tabela 'pacientes' do Supabase.
// O campo external_id usa prefixo "local_" + id local para evitar colisão.
function mapearPacientes(rows) {
  return rows.map((r) => ({
    empresa_id,
    external_id: `local_${r.id}`,
    nome: r.name ?? "Sem nome",
    cpf: r.cpf ?? null,
    nascimento: r.birth ?? null,
    telefone: r.phone ?? null,
    email: r.email ?? null,
    convenio: r.insurance ?? null,
    status: r.status ?? "ativo",
    created_at: r.created_at ?? new Date().toISOString(),
  }));
}

// ─── Sincronização principal ────────────────────────────────────────────────

async function sincronizar() {
  const inicio = Date.now();
  log("info", "Iniciando sincronização...");

  let db;
  const resultado = {
    empresa_id,
    tipo: "sincronizacao_completa",
    status: "sucesso",
    mensagem: "",
    payload: {},
  };

  try {
    db = abrirBanco();

    // ── 1. Pacientes ──────────────────────────────────────────────────────
    let contagemPacientes = 0;
    try {
      const pacientesLocais = db.prepare("SELECT * FROM patients").all();
      log("info", `Pacientes encontrados localmente: ${pacientesLocais.length}`);

      if (pacientesLocais.length > 0) {
        const mapeados = mapearPacientes(pacientesLocais);
        const { count } = await supabaseUpsert("pacientes", mapeados);
        contagemPacientes = count;
        log("ok", `Pacientes sincronizados: ${count}`);
      }
    } catch (e) {
      // Tabela pode não existir ainda no Supabase — avisa mas não aborta
      log("warn", "Pacientes: " + e.message);
    }

    // ── 2. Financeiro ─────────────────────────────────────────────────────
    // Quando o sistema local tiver tabela de financeiro, adicionar aqui.
    // Por ora, verifica se a tabela existe e registra.
    let contagemFinanceiro = 0;
    try {
      const temFinanceiro = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='financeiro'")
        .get();

      if (temFinanceiro) {
        const finRows = db.prepare("SELECT * FROM financeiro").all();
        log("info", `Financeiro local: ${finRows.length} registros`);

        const mapeados = finRows.map((r) => ({
          empresa_id,
          external_id: `local_${r.id}`,
          tipo: r.tipo ?? "receita",
          descricao: r.descricao ?? r.description ?? "Lançamento importado",
          valor: Number(r.valor ?? r.value ?? 0),
          data: r.data ?? r.date ?? new Date().toISOString().slice(0, 10),
          status: r.status ?? "pago",
          origem: "nexa_clinic_local",
        }));

        if (mapeados.length) {
          const { count } = await supabaseUpsert("financeiro", mapeados);
          contagemFinanceiro = count;
          log("ok", `Financeiro sincronizado: ${count}`);
        }
      } else {
        log("info", "Tabela 'financeiro' não encontrada no banco local (normal nesta versão)");
      }
    } catch (e) {
      log("warn", "Financeiro: " + e.message);
    }

    // ── 3. Médicos / Repasses ─────────────────────────────────────────────
    let contagemMedicos = 0;
    try {
      const temMedicos = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medicos'")
        .get();

      if (temMedicos) {
        const medRows = db.prepare("SELECT * FROM medicos WHERE ativo=1 OR ativo IS NULL").all();
        const mapeados = medRows.map((r) => ({
          empresa_id,
          external_id: `local_${r.id}`,
          nome: r.nome ?? r.name,
          especialidade: r.especialidade ?? r.specialty ?? null,
          crm: r.crm ?? null,
          percentual_repasse: Number(r.percentual_repasse ?? r.percentual ?? 50),
          ativo: true,
        }));

        if (mapeados.length) {
          const { count } = await supabaseUpsert("medicos", mapeados);
          contagemMedicos = count;
          log("ok", `Médicos sincronizados: ${count}`);
        }
      }
    } catch (e) {
      log("warn", "Médicos: " + e.message);
    }

    // ── Resultado ─────────────────────────────────────────────────────────
    const duracao = Date.now() - inicio;
    resultado.mensagem = `Sincronização concluída em ${duracao}ms`;
    resultado.payload = {
      pacientes: contagemPacientes,
      financeiro: contagemFinanceiro,
      medicos: contagemMedicos,
      duracao_ms: duracao,
    };

    log("ok", resultado.mensagem, resultado.payload);

  } catch (e) {
    resultado.status = "erro";
    resultado.mensagem = e.message;
    log("error", "Falha na sincronização: " + e.message);
  } finally {
    if (db) db.close();
    await supabaseInsertLog(resultado);
  }

  return resultado;
}

// ─── Inicialização ──────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║       Nexa Sync Agent v1.0               ║");
  console.log("╚══════════════════════════════════════════╝\n");
  log("info", `Banco local: ${db_path}`);
  log("info", `Supabase: ${supabase_url}`);
  log("info", `Empresa ID: ${empresa_id}`);

  if (RUN_ONCE) {
    log("info", "Modo: sincronização única (--once)");
    await sincronizar();
    process.exit(0);
  }

  // Sincroniza imediatamente ao iniciar
  await sincronizar();

  // Agenda sincronizações periódicas
  const expr = `*/${intervalo_minutos} * * * *`;
  log("info", `Agendado: a cada ${intervalo_minutos} minutos (cron: ${expr})`);

  cron.schedule(expr, async () => {
    await sincronizar();
  });

  log("ok", "Agente rodando. Pressione Ctrl+C para encerrar.\n");
}

main().catch((e) => {
  console.error("Erro fatal:", e);
  process.exit(1);
});
