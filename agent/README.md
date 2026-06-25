# Nexa Sync Agent — Guia de Instalação

Este agente roda na máquina da clínica e sincroniza automaticamente
o banco de dados local (arquivo `.db`) com o painel web **Nexa Insight**.

---

## Pré-requisitos

- **Node.js 18 ou superior** instalado na máquina
  → Baixe em: https://nodejs.org (escolha "LTS")
- O arquivo `.db` gerado pelo Nexa Clinic deve estar acessível
- Acesso ao painel Supabase do Nexa Insight (peça ao administrador)

---

## Instalação passo a passo

### 1. Copie a pasta `agent` para a máquina da clínica

Coloque em um local fixo, por exemplo:
```
C:\NexaClinic\sync-agent\
```

### 2. Instale as dependências

Abra o **Prompt de Comando** dentro da pasta e execute:

```bash
npm install
```

Aguarde o download dos pacotes (pode levar 1-2 minutos na primeira vez).

### 3. Rode o setup

```bash
node setup.js
```

O setup vai perguntar:
- **URL do Supabase** → ex: `https://xyzxyz.supabase.co`
- **Service Role Key** → chave secreta do Supabase (peça ao administrador do sistema web)
- **ID da empresa** → UUID visível na tabela `empresas` do Supabase
- **Caminho do arquivo .db** → ex: `C:\NexaClinic\backup\backup-2026-6-20.db`
- **Intervalo** → de quantos em quantos minutos sincronizar (recomendado: 30)

Isso gera o arquivo `config.json` automaticamente.

### 4. Aplique a migration no Supabase

No painel do Supabase → **SQL Editor**, cole e execute o conteúdo
do arquivo `migration_pacientes.sql`.

Isso cria a tabela de pacientes e libera as permissões corretas.

### 5. Teste a sincronização

```bash
npm run sync-once
```

Você verá no terminal os registros sincronizados e um log aparecerá
em `logs_sincronizacao` no Supabase.

### 6. Inicie o agente contínuo

```bash
npm start
```

O agente ficará rodando e sincronizará automaticamente no intervalo configurado.

---

## Como fazer o agente iniciar com o Windows (opcional)

Para que o agente inicie automaticamente quando o computador ligar:

1. Pressione `Win + R`, digite `shell:startup` e pressione Enter
2. Crie um arquivo `nexa-sync.bat` com o conteúdo:

```bat
@echo off
cd /d C:\NexaClinic\sync-agent
node sync-agent.js
```

3. Coloque esse `.bat` na pasta que abriu no passo 1

---

## O que é sincronizado

| Dado local       | Tabela no Supabase     | Observação                        |
|------------------|------------------------|-----------------------------------|
| `patients`       | `pacientes`            | Nome, CPF, telefone, convênio     |
| `financeiro`*    | `financeiro`           | Quando disponível no sistema local|
| `medicos`*       | `medicos`              | Quando disponível no sistema local|

*Adicionado automaticamente quando o sistema local tiver essas tabelas.

---

## Segurança

- O `config.json` contém a **Service Role Key** — nunca envie esse arquivo para ninguém
- O agente só **lê** o banco local (abre em modo `readonly`)
- A comunicação com o Supabase é sempre via **HTTPS**
- O upsert usa `external_id` para garantir que nenhum registro seja duplicado

---

## Solução de problemas

| Problema                              | Solução                                              |
|---------------------------------------|------------------------------------------------------|
| `config.json não encontrado`          | Execute `node setup.js` primeiro                     |
| `Arquivo .db não encontrado`          | Verifique o caminho em `config.json` → `db_path`     |
| `Supabase 401 Unauthorized`           | Verifique a `supabase_service_key` no `config.json`  |
| `Supabase 404 — tabela não existe`    | Execute a `migration_pacientes.sql` no Supabase      |
| Dados não aparecem no painel web      | Verifique `logs_sincronizacao` no Supabase           |

---

## Suporte

Em caso de dúvidas, consulte o administrador do Nexa Insight
ou verifique os logs no painel web em **Configurações → Logs de Sincronização**.
