'use client';
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MessageCircle, QrCode, CheckCircle2, XCircle, RefreshCw,
  LogOut, Info, Send, History, Smartphone, Bell, CheckCheck, Loader2, Phone,
} from "lucide-react";
import {
  getTemplates, saveTemplates, isWhatsAppEnabled, setWhatsAppEnabled,
  getLog, DEFAULT_TEMPLATES, type WhatsAppTemplates, type WALogEntry,
  getLembretesAmanha, sendLembretesManual, type LembreteAlvo, dateToBR,
} from "@/lib/whatsapp";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [{ title: "WhatsApp — NexaClinic" }],
  }),
  component: WhatsAppPage,
});

type WAStatus = "desconectado" | "aguardando_qr" | "conectando" | "conectado" | "erro";

const statusInfo: Record<WAStatus, { label: string; color: string; bg: string; icon: any }> = {
  desconectado:  { label: "Desconectado",   color: "#64748b", bg: "#f1f5f9", icon: XCircle },
  aguardando_qr: { label: "Aguardando leitura do QR Code", color: "#d97706", bg: "#fffbeb", icon: QrCode },
  conectando:    { label: "Conectando...",  color: "#2563eb", bg: "#eff6ff", icon: RefreshCw },
  conectado:     { label: "Conectado",      color: "#059669", bg: "#f0fdf4", icon: CheckCircle2 },
  erro:          { label: "Erro de conexão / dependências não instaladas", color: "#dc2626", bg: "#fef2f2", icon: XCircle },
};

function WhatsAppPage() {
  const [status, setStatus] = useState<WAStatus>("desconectado");
  const [number, setNumber] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(isWhatsAppEnabled());
  const [templates, setTemplatesState] = useState<WhatsAppTemplates>(getTemplates());
  const [log, setLog] = useState<WALogEntry[]>(getLog());
  const [isElectron, setIsElectron] = useState(false);

  // ── Lembretes manuais (consultas de "amanhã") ──────────────────────────
  const [lembretes, setLembretes] = useState<LembreteAlvo[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [enviandoLembretes, setEnviandoLembretes] = useState(false);
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);

  function carregarLembretes() {
    try {
      const appointments = JSON.parse(localStorage.getItem("nexaclinic_appointments_v3") ?? "[]");
      const professionals = JSON.parse(localStorage.getItem("nexaclinic_professionals") ?? "[]");
      const lista = getLembretesAmanha(appointments, professionals);
      setLembretes(lista);
      // por padrão seleciona quem ainda não recebeu e tem telefone
      setSelecionados(new Set(lista.filter((l) => !l.jaEnviado && l.phone).map((l) => l.appointmentId)));
    } catch { /* noop */ }
  }

  useEffect(() => { carregarLembretes(); }, []);

  function toggleSelecionado(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleEnviarLembretes() {
    const alvos = lembretes.filter((l) => selecionados.has(l.appointmentId));
    if (alvos.length === 0) {
      toast.error("Selecione ao menos um paciente.");
      return;
    }
    setEnviandoLembretes(true);
    setProgresso({ done: 0, total: alvos.length });

    const { sent, skipped } = await sendLembretesManual(alvos, (done, total) => {
      setProgresso({ done, total });
    });

    setEnviandoLembretes(false);
    setProgresso(null);
    setLog(getLog());
    carregarLembretes();

    if (sent > 0) {
      toast.success(`${sent} lembrete${sent > 1 ? "s" : ""} enviado${sent > 1 ? "s" : ""} com sucesso`);
    }
    if (skipped > 0) {
      toast.error(`${skipped} não enviado${skipped > 1 ? "s" : ""} (sem telefone ou erro)`);
    }
  }

  const amanhaBR = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return t.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    const api = (window as any)?.electronAPI?.whatsapp;
    if (!api) { setIsElectron(false); return; }
    setIsElectron(true);

    api.getStatus().then((s: any) => {
      setStatus(s.status);
      setNumber(s.number);
    });

    const offStatus = api.onStatus((s: any) => {
      setStatus(s.status);
      setNumber(s.number);
      if (s.status === "conectado") setQr(null);
    });
    const offQr = api.onQr((dataUrl: string) => setQr(dataUrl));

    return () => { offStatus?.(); offQr?.(); };
  }, []);

  function handleToggleEnabled(v: boolean) {
    setEnabled(v);
    setWhatsAppEnabled(v);
    toast.success(v ? "Automação do WhatsApp ativada" : "Automação do WhatsApp desativada");
  }

  function handleSaveTemplates() {
    saveTemplates(templates);
    toast.success("Modelos de mensagem salvos");
  }

  function handleResetTemplates() {
    setTemplatesState({ ...DEFAULT_TEMPLATES });
    saveTemplates(DEFAULT_TEMPLATES);
    toast.success("Modelos restaurados para o padrão");
  }

  async function handleReconnect() {
    const api = (window as any)?.electronAPI?.whatsapp;
    if (!api) return;
    setQr(null);
    setStatus("conectando");
    await api.reconnect();
  }

  async function handleLogout() {
    const api = (window as any)?.electronAPI?.whatsapp;
    if (!api) return;
    await api.logout();
    setNumber(null);
    setQr(null);
    setStatus("desconectado");
    toast.info("WhatsApp desconectado. Leia o QR Code novamente para reconectar.");
  }

  const Sb = statusInfo[status];

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-emerald-500" />
          WhatsApp — Automação de Mensagens
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie confirmações de agendamento e lembretes automáticos para os pacientes.
        </p>
      </div>

      {!isElectron && (
        <Card className="p-4 border-amber-200 bg-amber-50 flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Disponível apenas na versão Desktop (Electron)</p>
            <p className="text-xs mt-1">
              A integração com WhatsApp roda localmente junto com o aplicativo instalado na sua máquina.
              No navegador, esta tela mostra apenas a configuração dos modelos de mensagem.
            </p>
          </div>
        </Card>
      )}

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center"
              style={{ background: Sb.bg }}
            >
              <Sb.icon className="h-5 w-5" style={{ color: Sb.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: Sb.color }}>{Sb.label}</p>
              {number && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Smartphone className="h-3 w-3" /> Número conectado: +{number}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isElectron && status === "conectado" && (
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Desconectar
              </Button>
            )}
            {isElectron && status !== "conectado" && (
              <Button variant="outline" size="sm" onClick={handleReconnect} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> {status === "aguardando_qr" ? "Gerar novo QR" : "Conectar"}
              </Button>
            )}
          </div>
        </div>

        {isElectron && status === "aguardando_qr" && qr && (
          <div className="flex flex-col items-center gap-3 py-4 border-t border-border">
            <p className="text-sm font-medium text-center">
              Abra o WhatsApp no seu celular → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> e escaneie o código abaixo:
            </p>
            <img src={qr} alt="QR Code WhatsApp" className="h-64 w-64 rounded-lg border border-border p-2 bg-white" />
            <p className="text-xs text-muted-foreground">O código expira em alguns segundos. Clique em "Gerar novo QR" se ele expirar.</p>
          </div>
        )}

        {isElectron && status === "erro" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
            <p className="font-semibold">Não foi possível iniciar o WhatsApp.</p>
            <p>Verifique se as dependências foram instaladas no projeto desktop:</p>
            <code className="block bg-red-100 rounded px-2 py-1 mt-1">npm install whatsapp-web.js qrcode</code>
          </div>
        )}
      </Card>

      <Card className="p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Automação ativada</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quando ativado, mensagens de confirmação e lembretes são enviados automaticamente.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
      </Card>

      <Card className="p-5 space-y-5">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" /> Modelos de mensagem
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use as variáveis: <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{nome}"}</code>{" "}
            <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{procedimento}"}</code>{" "}
            <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{profissional}"}</code>{" "}
            <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{data}"}</code>{" "}
            <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{hora}"}</code>{" "}
            <code className="text-[11px] bg-muted rounded px-1 py-0.5">{"{convenio}"}</code>
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Confirmação de agendamento
          </Label>
          <Textarea
            rows={4}
            value={templates.confirmacao}
            onChange={(e) => setTemplatesState({ ...templates, confirmacao: e.target.value })}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">Enviada automaticamente ao criar o agendamento.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Lembrete (1 dia antes)
          </Label>
          <Textarea
            rows={4}
            value={templates.lembrete}
            onChange={(e) => setTemplatesState({ ...templates, lembrete: e.target.value })}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Usado no envio manual de lembretes (seção "Lembretes de amanhã" abaixo).
          </p>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSaveTemplates} className="gap-1.5">Salvar modelos</Button>
          <Button variant="ghost" onClick={handleResetTemplates}>Restaurar padrão</Button>
        </div>
      </Card>

      {/* Lembretes manuais — consultas de amanhã */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-500" /> Lembretes de amanhã
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Agendamentos para <strong>{dateToBR(amanhaBR)}</strong>. Selecione quem deve receber o lembrete e clique em enviar.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={carregarLembretes} className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </div>

        {lembretes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum agendamento para amanhã.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => setSelecionados(new Set(lembretes.filter(l => l.phone).map(l => l.appointmentId)))}
              >
                Selecionar todos
              </button>
              <span>·</span>
              <button
                className="text-primary hover:underline font-medium"
                onClick={() => setSelecionados(new Set())}
              >
                Limpar seleção
              </button>
            </div>

            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {lembretes.map((l) => {
                const semTelefone = !l.phone || !l.phone.replace(/\D/g, "");
                const checked = selecionados.has(l.appointmentId);
                return (
                  <label
                    key={l.appointmentId}
                    className={`flex items-center gap-3 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
                      semTelefone ? "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed" :
                      l.jaEnviado ? "border-emerald-100 bg-emerald-50/40" :
                      checked ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={semTelefone}
                      onChange={() => toggleSelecionado(l.appointmentId)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span className="font-mono font-bold text-foreground w-12 shrink-0">{l.hora}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{l.patientName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {l.procedimento}{l.profissional ? ` · ${l.profissional}` : ""}
                      </p>
                    </div>
                    {semTelefone ? (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                        <Phone className="h-3 w-3" /> Sem telefone
                      </span>
                    ) : l.jaEnviado ? (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                        <CheckCheck className="h-3 w-3" /> Enviado
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                onClick={handleEnviarLembretes}
                disabled={enviandoLembretes || selecionados.size === 0}
                className="gap-1.5"
              >
                {enviandoLembretes
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                Enviar lembrete{selecionados.size > 1 ? "s" : ""} ({selecionados.size})
              </Button>
              {progresso && (
                <span className="text-xs text-muted-foreground">
                  Enviando {progresso.done} de {progresso.total}...
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Histórico de envios
          </p>
          <Button variant="ghost" size="sm" onClick={() => setLog(getLog())} className="gap-1.5 text-xs">
            <RefreshCw className="h-3 w-3" /> Atualizar
          </Button>
        </div>

        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {log.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                  entry.success ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"
                }`}
              >
                {entry.success
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {entry.type === "confirmacao" ? "Confirmação" : "Lembrete"} — {entry.patientName}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(entry.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {!entry.success && entry.error && (
                    <p className="text-[11px] text-red-600 mt-0.5">{entry.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
