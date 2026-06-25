/**
 * setup.js — Configuração inicial do Nexa Sync Agent
 * Execute: node setup.js
 */

import { createRequire } from "module";
import { writeFileSync, existsSync } from "fs";
import { createInterface } from "readline";

const require = createRequire(import.meta.url);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

console.log("\n╔══════════════════════════════════════════╗");
console.log("║       Nexa Sync Agent — Setup            ║");
console.log("╚══════════════════════════════════════════╝\n");

async function main() {
  console.log("Vamos configurar a conexão com o Nexa Insight Web.\n");
  console.log("Você precisará das seguintes informações do seu painel Supabase:");
  console.log("  • URL do projeto (ex: https://xyzxyz.supabase.co)");
  console.log("  • Service Role Key (em Project Settings → API)");
  console.log("  • ID da empresa (na tabela 'empresas' do Supabase)\n");

  const supabase_url = (await ask("1. URL do Supabase: ")).trim();
  const supabase_service_key = (await ask("2. Service Role Key: ")).trim();
  const empresa_id = (await ask("3. ID da empresa (UUID): ")).trim();

  let db_path = (
    await ask(
      "4. Caminho completo do arquivo .db de backup\n   (ex: C:\\NexaClinic\\backup\\backup-2026-6-20.db)\n   Caminho: "
    )
  ).trim();

  // Normaliza barras para Windows
  db_path = db_path.replace(/\//g, "\\");

  const intervalo_str = (
    await ask("5. Intervalo de sincronização em minutos (padrão: 30): ")
  ).trim();
  const intervalo_minutos = parseInt(intervalo_str) || 30;

  const config = {
    _comentario: "Gerado pelo setup.js — NÃO compartilhe este arquivo",
    supabase_url,
    supabase_service_key,
    empresa_id,
    db_path,
    intervalo_minutos,
    log_level: "info",
  };

  writeFileSync("config.json", JSON.stringify(config, null, 2), "utf-8");

  console.log("\n✅ config.json criado com sucesso!");
  console.log("\nPróximos passos:");
  console.log("  1. Rode: npm start          → inicia o agente contínuo");
  console.log("  2. Rode: npm run sync-once  → sincroniza uma vez e encerra");
  console.log(
    "\n⚠️  IMPORTANTE: Nunca envie o config.json para ninguém — ele contém sua chave de acesso.\n"
  );

  rl.close();
}

main().catch((e) => {
  console.error("Erro no setup:", e.message);
  rl.close();
  process.exit(1);
});
