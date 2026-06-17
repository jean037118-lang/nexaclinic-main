import { app, ipcMain, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";

// whatsapp-web.js + qrcode são dependências externas.
// Instale com: npm install whatsapp-web.js qrcode
// (whatsapp-web.js usa puppeteer por baixo dos panos e baixa um Chromium)
let Client: any, LocalAuth: any, qrcode: any;
try {
  // require dinâmico para não quebrar o build se a dependência ainda não foi instalada
  ({ Client, LocalAuth } = require("whatsapp-web.js"));
  qrcode = require("qrcode");
} catch {
  console.warn("[whatsapp] Dependências não instaladas. Rode: npm install whatsapp-web.js qrcode");
}

type WAStatus = "desconectado" | "aguardando_qr" | "conectando" | "conectado" | "erro";

let client: any = null;
let currentStatus: WAStatus = "desconectado";
let currentNumber: string | null = null;
let win: BrowserWindow | null = null;

function sendToRenderer(channel: string, payload?: any) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function setStatus(status: WAStatus) {
  currentStatus = status;
  sendToRenderer("whatsapp-status", { status, number: currentNumber });
}

/**
 * Normaliza um número de telefone brasileiro para o formato esperado
 * pelo WhatsApp: 55DDDNUMERO@c.us
 */
function normalizePhone(phone: string): string | null {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;

  // remove zeros à esquerda
  digits = digits.replace(/^0+/, "");

  // se não tem código do país, assume Brasil (55)
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }

  // WhatsApp exige o "9" extra para celulares — alguns números antigos não têm.
  // Tenta manter como veio; caso falhe o envio, quem chamar pode tentar a variação.
  return `${digits}@c.us`;
}

/**
 * Aguarda a página interna do WhatsApp Web estar totalmente pronta.
 * Evita o erro "Cannot read properties of null (reading 'evaluate')",
 * que ocorre quando o evento "ready" dispara antes da página interna
 * (client.pupPage) estar de fato disponível.
 */
async function waitForPageReady(maxWaitMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      if (client?.pupPage && !client.pupPage.isClosed?.()) {
        // tenta um evaluate trivial para garantir que a página responde
        await client.pupPage.evaluate(() => true);
        return true;
      }
    } catch {
      // página ainda não está pronta, aguarda e tenta novamente
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function userDataDir() {
  return path.join(app.getPath("userData"), "whatsapp-session");
}

/**
 * Inicializa o cliente do WhatsApp Web.
 * Deve ser chamado uma vez, após a janela principal estar criada.
 */
export function initWhatsApp(mainWindow: BrowserWindow) {
  win = mainWindow;

  if (!Client) {
    setStatus("erro");
    return;
  }

  const sessionDir = userDataDir();
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: sessionDir }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr: string) => {
    setStatus("aguardando_qr");
    try {
      const dataUrl = await qrcode.toDataURL(qr, { width: 320, margin: 1 });
      sendToRenderer("whatsapp-qr", dataUrl);
    } catch (err) {
      console.error("[whatsapp] erro ao gerar QR", err);
    }
  });

  client.on("authenticated", () => {
    setStatus("conectando");
  });

  client.on("ready", async () => {
    currentNumber = client.info?.wid?.user ?? null;
    // pequena espera extra para garantir que a página interna estabilizou
    await waitForPageReady();
    setStatus("conectado");
  });

  client.on("disconnected", () => {
    currentNumber = null;
    setStatus("desconectado");
  });

  client.on("auth_failure", () => {
    setStatus("erro");
  });

  setStatus("conectando");
  client.initialize().catch((err: any) => {
    console.error("[whatsapp] erro ao inicializar", err);
    setStatus("erro");
  });
}

/**
 * Envia uma mensagem de texto para um número.
 */
async function sendMessage(phone: string, message: string, _retry = false): Promise<{ success: boolean; error?: string }> {
  if (!client || currentStatus !== "conectado") {
    return { success: false, error: "WhatsApp não está conectado." };
  }

  const jid = normalizePhone(phone);
  if (!jid) return { success: false, error: "Telefone inválido." };

  // Garante que a página interna do WhatsApp Web está pronta antes de operar
  const pageReady = await waitForPageReady();
  if (!pageReady) {
    return { success: false, error: "WhatsApp ainda inicializando, tente novamente em alguns segundos." };
  }

  try {
    // Verifica se o número existe no WhatsApp; tenta variações com/sem o 9º dígito
    const candidates = [jid];
    const digits = jid.replace("@c.us", "");
    if (digits.length === 13 && digits.startsWith("55")) {
      const ddd = digits.slice(2, 4);
      const rest = digits.slice(4);
      if (rest.length === 9 && rest.startsWith("9")) {
        candidates.push(`55${ddd}${rest.slice(1)}@c.us`); // sem o 9
      } else if (rest.length === 8) {
        candidates.push(`55${ddd}9${rest}@c.us`); // com o 9
      }
    }

    let target: string | null = null;
    for (const cand of candidates) {
      try {
        const numberId = await client.getNumberId(cand);
        if (numberId) { target = numberId._serialized; break; }
      } catch { /* tenta próximo */ }
    }
    if (!target) target = jid; // fallback: tenta enviar mesmo assim

    await client.sendMessage(target, message);
    return { success: true };
  } catch (err: any) {
    const msg: string = err?.message ?? "Erro ao enviar mensagem.";
    console.error("[whatsapp] erro ao enviar mensagem", err);

    // Erro típico de página não pronta — tenta novamente uma vez após aguardar
    if (!_retry && /evaluate|Cannot read properties of null|Session closed|Target closed/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 3000));
      return sendMessage(phone, message, true);
    }

    return { success: false, error: msg };
  }
}

/**
 * Desconecta e limpa a sessão salva (logout completo).
 */
async function logoutWhatsApp(): Promise<{ success: boolean }> {
  try {
    if (client) {
      await client.logout().catch(() => {});
      await client.destroy().catch(() => {});
      client = null;
    }
    const sessionDir = userDataDir();
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    setStatus("desconectado");
    return { success: true };
  } catch (err) {
    console.error("[whatsapp] erro ao desconectar", err);
    return { success: true };
  }
}

// ========================================
// IPC HANDLERS
// ========================================
ipcMain.handle("whatsapp-get-status", async () => {
  return { status: currentStatus, number: currentNumber };
});

ipcMain.handle("whatsapp-send-message", async (_, phone: string, message: string) => {
  return sendMessage(phone, message);
});

ipcMain.handle("whatsapp-logout", async () => {
  return logoutWhatsApp();
});

ipcMain.handle("whatsapp-reconnect", async (_event) => {
  if (win) initWhatsApp(win);
  return { success: true };
});
