"""
Nexa Sync Agent — Python
Lê o arquivo .db (SQLite) do Nexa Clinic e sincroniza com o Supabase.

Requisitos: Python 3.8+ (sem instalar nada — usa só biblioteca padrão)
Uso:
  python sync_agent.py          → roda continuamente
  python sync_agent.py --once   → sincroniza uma vez e encerra
"""

import sqlite3
import json
import urllib.request
import urllib.error
import time
import sys
import os
from datetime import datetime, timezone

# ── Config ──────────────────────────────────────────────────────────────────

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def carregar_config():
    if not os.path.exists(CONFIG_PATH):
        print("❌ config.json não encontrado. Execute: python setup.py")
        sys.exit(1)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

# ── Logger ───────────────────────────────────────────────────────────────────

def log(nivel, msg, dados=None):
    ts = datetime.now().strftime("%H:%M:%S")
    icone = {"info": "ℹ️ ", "ok": "✅", "erro": "❌", "aviso": "⚠️ "}.get(nivel, "  ")
    linha = f"[{ts}] {icone} {msg}"
    if dados:
        linha += f" {json.dumps(dados, ensure_ascii=False)}"
    print(linha)

# ── Supabase ─────────────────────────────────────────────────────────────────

def supabase_upsert(cfg, tabela, linhas):
    if not linhas:
        return 0
    url = f"{cfg['supabase_url']}/rest/v1/{tabela}"
    dados = json.dumps(linhas).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=dados,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": cfg["supabase_service_key"],
            "Authorization": f"Bearer {cfg['supabase_service_key']}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
            return len(linhas)
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", errors="replace")
        raise Exception(f"HTTP {e.code} em {tabela}: {corpo}")

def supabase_gravar_log(cfg, entrada):
    url = f"{cfg['supabase_url']}/rest/v1/logs_sincronizacao"
    dados = json.dumps(entrada).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=dados,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": cfg["supabase_service_key"],
            "Authorization": f"Bearer {cfg['supabase_service_key']}",
            "Prefer": "return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp.read()
    except Exception:
        pass  # falha no log não interrompe o processo

# ── Leitura do banco local ────────────────────────────────────────────────────

def tabela_existe(cursor, nome):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (nome,)
    )
    return cursor.fetchone() is not None

def sincronizar(cfg):
    inicio = time.time()
    log("info", "Iniciando sincronização...")

    empresa_id = cfg["empresa_id"]
    db_path = cfg["db_path"]

    resultado = {
        "empresa_id": empresa_id,
        "tipo": "sincronizacao_completa",
        "status": "sucesso",
        "mensagem": "",
        "payload": {},
    }

    if not os.path.exists(db_path):
        resultado["status"] = "erro"
        resultado["mensagem"] = f"Arquivo .db não encontrado: {db_path}"
        log("erro", resultado["mensagem"])
        supabase_gravar_log(cfg, resultado)
        return

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        contagem = {"pacientes": 0, "financeiro": 0, "medicos": 0}

        # ── Pacientes ────────────────────────────────────────────────────────
        if tabela_existe(cur, "patients"):
            cur.execute("SELECT * FROM patients")
            linhas = cur.fetchall()
            log("info", f"Pacientes locais: {len(linhas)}")
            if linhas:
                mapeados = [
                    {
                        "empresa_id": empresa_id,
                        "external_id": f"local_{r['id']}",
                        "nome": r["name"] or "Sem nome",
                        "telefone": r["phone"] if "phone" in r.keys() else None,
                        "status": "ativo",
                        "created_at": r["created_at"] or datetime.now(timezone.utc).isoformat(),
                    }
                    for r in linhas
                ]
                contagem["pacientes"] = supabase_upsert(cfg, "pacientes", mapeados)
                log("ok", f"Pacientes sincronizados: {contagem['pacientes']}")

        # ── Financeiro ───────────────────────────────────────────────────────
        if tabela_existe(cur, "financeiro"):
            cur.execute("SELECT * FROM financeiro")
            linhas = cur.fetchall()
            if linhas:
                mapeados = [
                    {
                        "empresa_id": empresa_id,
                        "external_id": f"local_{r['id']}",
                        "tipo": r["tipo"] if "tipo" in r.keys() else "receita",
                        "descricao": r["descricao"] if "descricao" in r.keys() else "Importado",
                        "valor": float(r["valor"] if "valor" in r.keys() else 0),
                        "data": r["data"] if "data" in r.keys() else datetime.now().strftime("%Y-%m-%d"),
                        "status": r["status"] if "status" in r.keys() else "pago",
                        "origem": "nexa_clinic_local",
                    }
                    for r in linhas
                ]
                contagem["financeiro"] = supabase_upsert(cfg, "financeiro", mapeados)
                log("ok", f"Financeiro sincronizado: {contagem['financeiro']}")

        # ── Médicos ──────────────────────────────────────────────────────────
        if tabela_existe(cur, "medicos"):
            cur.execute("SELECT * FROM medicos")
            linhas = cur.fetchall()
            if linhas:
                mapeados = [
                    {
                        "empresa_id": empresa_id,
                        "external_id": f"local_{r['id']}",
                        "nome": r["nome"] if "nome" in r.keys() else r["name"],
                        "especialidade": r["especialidade"] if "especialidade" in r.keys() else None,
                        "crm": r["crm"] if "crm" in r.keys() else None,
                        "percentual_repasse": float(r["percentual_repasse"] if "percentual_repasse" in r.keys() else 50),
                        "ativo": True,
                    }
                    for r in linhas
                ]
                contagem["medicos"] = supabase_upsert(cfg, "medicos", mapeados)
                log("ok", f"Médicos sincronizados: {contagem['medicos']}")

        duracao = round(time.time() - inicio, 2)
        resultado["mensagem"] = f"Concluído em {duracao}s"
        resultado["payload"] = {**contagem, "duracao_s": duracao}
        log("ok", resultado["mensagem"], contagem)

    except Exception as e:
        resultado["status"] = "erro"
        resultado["mensagem"] = str(e)
        log("erro", str(e))
    finally:
        if conn:
            conn.close()
        supabase_gravar_log(cfg, resultado)

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("\n╔══════════════════════════════════════════╗")
    print("║    Nexa Sync Agent v2.0 — Python         ║")
    print("╚══════════════════════════════════════════╝\n")

    cfg = carregar_config()
    log("info", f"Banco local: {cfg['db_path']}")
    log("info", f"Supabase: {cfg['supabase_url']}")
    log("info", f"Empresa: {cfg['empresa_id']}")

    once = "--once" in sys.argv

    sincronizar(cfg)

    if once:
        print("\nModo --once concluído.")
        return

    intervalo = int(cfg.get("intervalo_minutos", 30)) * 60
    log("info", f"Próxima sincronização em {cfg.get('intervalo_minutos', 30)} minutos.")
    log("ok", "Agente rodando. Pressione Ctrl+C para encerrar.\n")

    try:
        while True:
            time.sleep(intervalo)
            sincronizar(cfg)
    except KeyboardInterrupt:
        print("\nAgente encerrado.")

if __name__ == "__main__":
    main()
