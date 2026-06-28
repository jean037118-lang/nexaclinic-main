import { getProntuarioDb, salvarProntuarioDb } from "@/lib/agendaData";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, Save, FileText, Pill, ClipboardList,
  ChevronDown, ChevronUp, Calendar, User, Stethoscope,
  Printer, X, AlertCircle,
} from "lucide-react";
import { patientStore } from "@/lib/patient-store";
import { type Patient, type Professional } from "@/lib/mock-data";
import { getUsuarioAtual } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/prontuario")({
  component: ProntuarioPage,
});

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Evolucao {
  id: string;
  data: string;
  profissional: string;
  cid10: string;
  queixa: string;
  exame: string;
  conduta: string;
  retorno: string;
}

interface Prescricao {
  id: string;
  data: string;
  profissional: string;
  medicamentos: string;
  observacoes: string;
}

interface Anamnese {
  queixaPrincipal: string;
  hda: string;
  hpp: string;
  hf: string;
  alergias: string;
  medicamentos: string;
  habitos: string;
  peso: string;
  altura: string;
  pressao: string;
  temperatura: string;
}

interface AnamneseRecord extends Anamnese {
  id: string;
  data: string;
  profissional: string;
}

interface ProntuarioRecord {
  patientId: string;
  anamnese: Anamnese; // legado
  anamneses: AnamneseRecord[];
  evolucoes: Evolucao[];
  prescricoes: Prescricao[];
  atualizadoEm: string;
}

// ─── Persistência — Supabase ──────────────────────────────────────────────────
const PRONT_BASE: Omit<ProntuarioRecord, "patientId"> = {
  anamnese: { queixaPrincipal: "", hda: "", hpp: "", hf: "", alergias: "", medicamentos: "", habitos: "", peso: "", altura: "", pressao: "", temperatura: "" },
  anamneses: [],
  evolucoes: [],
  prescricoes: [],
  atualizadoEm: "",
};

async function getProntuario(patientId: string): Promise<ProntuarioRecord> {
  try {
    const data = await getProntuarioDb(patientId);
    if (!data) return { patientId, ...PRONT_BASE };
    return {
      patientId,
      anamnese: data.anamnese ?? PRONT_BASE.anamnese,
      anamneses: data.anamneses ?? [],
      evolucoes: data.evolucoes ?? [],
      prescricoes: data.prescricoes ?? [],
      atualizadoEm: data.atualizado_em ?? "",
    };
  } catch { return { patientId, ...PRONT_BASE }; }
}

async function saveProntuario(record: ProntuarioRecord, patientName?: string) {
  await salvarProntuarioDb(record.patientId, { ...record, patientName: patientName ?? "" });
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getProfissionais(): Professional[] {
  // Profissionais carregados via Supabase no useEffect do componente
  return [];
}

// ─── Componente Secção expansível ─────────────────────────────────────────────
function Secao({
  titulo, icone, children, defaultOpen = true,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-3 font-semibold text-slate-800">
          {icone}
          {titulo}
        </div>
        {aberto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberto && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
function ProntuarioPage() {
  const [pacientes, setPacientes] = useState<Patient[]>([]);
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Patient | null>(null);
  const [prontuario, setProntuario] = useState<ProntuarioRecord | null>(null);
  const [aba, setAba] = useState<"anamnese" | "evolucoes" | "prescricoes">("evolucoes");
  const buscaRef = useRef<HTMLDivElement>(null);

  const usuarioAtual = getUsuarioAtual();

  // Lê patientId da URL (quando vindo de Pacientes ou Agenda)
  const search = useSearch({ strict: false }) as any;
  const patientIdFromUrl = search?.patientId as string | undefined;

  // Carrega pacientes
  useEffect(() => {
    setPacientes(patientStore.getAll());
    return patientStore.subscribe(() => setPacientes(patientStore.getAll()));
  }, []);

  // Seleciona automaticamente quando patientId vem na URL
  useEffect(() => {
    if (!patientIdFromUrl) return;
    const lista = patientStore.getAll();
    const found = lista.find((p) => p.id === patientIdFromUrl);
    if (found) selecionarPaciente(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientIdFromUrl]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaAberta(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selecionarPaciente(p: Patient) {
    setPacienteSelecionado(p);
    setProntuario(getProntuario(p.id));
    setBusca(p.name);
    setBuscaAberta(false);
    setAba("evolucoes");
  }

  function limparSelecao() {
    setPacienteSelecionado(null);
    setProntuario(null);
    setBusca("");
  }

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.name.toLowerCase().includes(busca.toLowerCase()) ||
      p.cpf?.includes(busca)
  );

  const idade = (birth: string) => {
    if (!birth) return "";
    const anos = Math.floor(
      (Date.now() - new Date(birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    return `${anos} anos`;
  };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <FileText className="w-8 h-8 text-cyan-600" />
          Prontuário Eletrônico
        </h1>
        <p className="text-slate-500 mt-1">Ficha clínica, anamnese e evolução do paciente</p>
      </div>

      {/* Busca de paciente */}
      <div ref={buscaRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setBuscaAberta(true);
              if (!e.target.value) limparSelecao();
            }}
            onFocus={() => setBuscaAberta(true)}
            placeholder="Buscar paciente por nome ou CPF..."
            className="w-full border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white shadow-sm"
          />
          {busca && (
            <button onClick={limparSelecao} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown de resultados */}
        {buscaAberta && busca && !pacienteSelecionado && (
          <div className="absolute z-30 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {pacientesFiltrados.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">
                <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nenhum paciente encontrado
              </div>
            ) : (
              pacientesFiltrados.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selecionarPaciente(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-50 transition text-left border-b border-slate-50 last:border-0"
                >
                  <div className="w-9 h-9 rounded-full bg-cyan-100 text-cyan-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.cpf} · {idade(p.birth)} · {p.insurance}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Aviso se não há pacientes */}
        {pacientes.length === 0 && (
          <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Nenhum paciente cadastrado. Cadastre pacientes na aba Pacientes primeiro.
          </div>
        )}
      </div>

      {/* Prontuário do paciente selecionado */}
      {pacienteSelecionado && prontuario ? (
        <>
          {/* Card do paciente */}
          <div className="bg-gradient-to-r from-cyan-600 to-teal-600 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 text-white font-bold text-xl flex items-center justify-center">
                  {pacienteSelecionado.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{pacienteSelecionado.name}</h2>
                  <div className="flex gap-3 mt-1 text-white/80 text-sm">
                    <span>{idade(pacienteSelecionado.birth)}</span>
                    {pacienteSelecionado.cpf && <span>CPF: {pacienteSelecionado.cpf}</span>}
                    <span>{pacienteSelecionado.insurance}</span>
                    {pacienteSelecionado.phone && <span>{pacienteSelecionado.phone}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-white/70">
                {prontuario.atualizadoEm && (
                  <p>Atualizado {new Date(prontuario.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                )}
                <p>{prontuario.evolucoes.length} evolução(ões)</p>
                <p>{prontuario.prescricoes.length} prescrição(ões)</p>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
            {(["evolucoes", "anamnese", "prescricoes"] as const).map((a) => {
              const label = { evolucoes: "Evoluções", anamnese: "Anamnese", prescricoes: "Prescrições" }[a];
              const Icon = { evolucoes: ClipboardList, anamnese: Stethoscope, prescricoes: Pill }[a];
              return (
                <button
                  key={a}
                  onClick={() => setAba(a)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                    aba === a ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Aba: Evoluções */}
          {aba === "evolucoes" && (
            <EvolucaoTab
              prontuario={prontuario}
              setProntuario={setProntuario}
              profissional={usuarioAtual?.nome ?? "Administrador"}
              profissionais={getProfissionais()}
            />
          )}

          {/* Aba: Anamnese */}
          {aba === "anamnese" && (
            <AnamneseTab
              prontuario={prontuario}
              setProntuario={setProntuario}
              profissional={usuarioAtual?.nome ?? "Administrador"}
            />
          )}

          {/* Aba: Prescrições */}
          {aba === "prescricoes" && (
            <PrescricaoTab
              prontuario={prontuario}
              setProntuario={setProntuario}
              profissional={usuarioAtual?.nome ?? "Administrador"}
              paciente={pacienteSelecionado}
            />
          )}
        </>
      ) : (
        /* Estado vazio */
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-16 text-center text-slate-400">
          <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Selecione um paciente</p>
          <p className="text-sm mt-1">Use a busca acima para localizar o prontuário</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EVOLUÇÕES
// ══════════════════════════════════════════════════════════════════════════════
const EVOLUCAO_VAZIA = {
  cid10: "", queixa: "", exame: "", conduta: "", retorno: "",
};

function EvolucaoTab({
  prontuario, setProntuario, profissional, profissionais,
}: {
  prontuario: ProntuarioRecord;
  setProntuario: (p: ProntuarioRecord) => void;
  profissional: string;
  profissionais: Professional[];
}) {
  const [form, setForm] = useState(EVOLUCAO_VAZIA);
  const [profSelecionado, setProfSelecionado] = useState(profissional);
  const [expandido, setExpandido] = useState<string | null>(null);

  function salvar() {
    if (!form.queixa && !form.conduta) {
      toast.error("Preencha ao menos a queixa ou a conduta.");
      return;
    }
    const nova: Evolucao = {
      id: uid(),
      data: new Date().toISOString(),
      profissional: profSelecionado,
      ...form,
    };
    const atualizado: ProntuarioRecord = {
      ...prontuario,
      evolucoes: [nova, ...prontuario.evolucoes],
    };
    saveProntuario(atualizado);
    setProntuario(atualizado);
    setForm(EVOLUCAO_VAZIA);
    toast.success("Evolução salva!");
  }

  function excluir(id: string) {
    const atualizado: ProntuarioRecord = {
      ...prontuario,
      evolucoes: prontuario.evolucoes.filter((e) => e.id !== id),
    };
    saveProntuario(atualizado);
    setProntuario(atualizado);
    toast.success("Evolução excluída.");
  }

  return (
    <div className="space-y-4">
      {/* Formulário nova evolução */}
      <Secao titulo="Nova Evolução" icone={<Plus className="w-4 h-4 text-cyan-600" />}>
        <div className="space-y-3 mt-4">
          {/* Profissional */}
          {profissionais.length > 0 && (
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Profissional</label>
              <select
                value={profSelecionado}
                onChange={(e) => setProfSelecionado(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 bg-white"
              >
                <option value={profissional}>{profissional} (atual)</option>
                {profissionais.map((p) => (
                  <option key={p.id} value={p.name}>{p.name} — {p.specialty}</option>
                ))}
              </select>
            </div>
          )}

          {/* CID-10 */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">CID-10</label>
            <input
              value={form.cid10}
              onChange={(e) => setForm({ ...form, cid10: e.target.value })}
              placeholder="Ex: G43 — Enxaqueca"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          {/* Queixa principal */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Queixa / Subjetivo</label>
            <textarea
              rows={2}
              value={form.queixa}
              onChange={(e) => setForm({ ...form, queixa: e.target.value })}
              placeholder="Relato do paciente, sintomas..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
            />
          </div>

          {/* Exame físico */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Exame Físico / Objetivo</label>
            <textarea
              rows={2}
              value={form.exame}
              onChange={(e) => setForm({ ...form, exame: e.target.value })}
              placeholder="Achados ao exame, sinais vitais..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
            />
          </div>

          {/* Conduta */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Conduta / Plano</label>
            <textarea
              rows={3}
              value={form.conduta}
              onChange={(e) => setForm({ ...form, conduta: e.target.value })}
              placeholder="Diagnóstico, tratamento, orientações..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
            />
          </div>

          {/* Retorno */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Data de Retorno</label>
            <input
              type="date"
              value={form.retorno}
              onChange={(e) => setForm({ ...form, retorno: e.target.value })}
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>

          <button
            onClick={salvar}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition"
          >
            <Save className="w-4 h-4" /> Salvar Evolução
          </button>
        </div>
      </Secao>

      {/* Histórico */}
      <Secao titulo={`Histórico de Evoluções (${prontuario.evolucoes.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />} defaultOpen={true}>
        {prontuario.evolucoes.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma evolução registrada.</p>
        ) : (() => {
          const coresPaleta = ["#0891b2","#7c3aed","#db2777","#ea580c","#16a34a","#ca8a04","#dc2626","#2563eb"];
          const corPorProf: Record<string, string> = {};
          prontuario.evolucoes.forEach(ev => {
            if (!corPorProf[ev.profissional]) {
              const idx = Object.keys(corPorProf).length % coresPaleta.length;
              corPorProf[ev.profissional] = coresPaleta[idx];
            }
          });
          const todosProfissionais = [...new Set(prontuario.evolucoes.map(e => e.profissional))];
          return (
            <div className="space-y-3 mt-4">
              {/* Legenda de profissionais */}
              {todosProfissionais.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Profissionais com registros neste prontuário:</p>
                  <div className="flex flex-wrap gap-2">
                    {todosProfissionais.map(prof => (
                      <span key={prof} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${corPorProf[prof]}18`, color: corPorProf[prof], border: `1px solid ${corPorProf[prof]}44` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: corPorProf[prof] }} />
                        {prof}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {prontuario.evolucoes.map((ev) => {
                const cor = corPorProf[ev.profissional] ?? "#64748b";
                return (
                  <div key={ev.id} className="border rounded-xl overflow-hidden" style={{ borderColor: `${cor}44` }}>
                    <button
                      onClick={() => setExpandido(expandido === ev.id ? null : ev.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap text-sm min-w-0">
                        <span className="font-semibold text-slate-700 shrink-0">
                          {new Date(ev.data).toLocaleDateString("pt-BR")}
                        </span>
                        {ev.cid10 && (
                          <span className="bg-cyan-100 text-cyan-700 text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                            {ev.cid10}
                          </span>
                        )}
                        <span
                          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${cor}18`, color: cor, border: `1px solid ${cor}44` }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cor }} />
                          {ev.profissional}
                        </span>
                        {ev.queixa && (
                          <span className="text-slate-400 text-xs truncate max-w-[200px] hidden sm:block">
                            {ev.queixa}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); excluir(ev.id); }}
                          className="p-1 text-slate-300 hover:text-red-500 transition rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        {expandido === ev.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {expandido === ev.id && (
                      <div className="border-t px-4 py-4 space-y-3 text-sm" style={{ borderColor: `${cor}22`, background: `${cor}06` }}>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                          <span className="text-xs font-semibold" style={{ color: cor }}>Registrado por {ev.profissional}</span>
                          <span className="text-xs text-slate-400">em {new Date(ev.data).toLocaleString("pt-BR")}</span>
                        </div>
                        {ev.queixa && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Queixa / Subjetivo</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{ev.queixa}</p>
                          </div>
                        )}
                        {ev.exame && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Exame Físico</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{ev.exame}</p>
                          </div>
                        )}
                        {ev.conduta && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Conduta / Plano</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{ev.conduta}</p>
                          </div>
                        )}
                        {ev.retorno && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">Retorno</p>
                            <p className="text-slate-700">{new Date(ev.retorno).toLocaleDateString("pt-BR")}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Secao>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ANAMNESE
// ══════════════════════════════════════════════════════════════════════════════
const ANAMNESE_VAZIA: Anamnese = { queixaPrincipal: "", hda: "", hpp: "", hf: "", alergias: "", medicamentos: "", habitos: "", peso: "", altura: "", pressao: "", temperatura: "" };

function AnamneseTab({ prontuario, setProntuario, profissional }: {
  prontuario: ProntuarioRecord;
  setProntuario: (p: ProntuarioRecord) => void;
  profissional: string;
}) {
  const [form, setForm] = useState<Anamnese>(ANAMNESE_VAZIA);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (prontuario.anamneses.length > 0) {
      const { id, data, profissional: _p, ...campos } = prontuario.anamneses[0];
      setForm(campos);
    } else {
      setForm(ANAMNESE_VAZIA);
    }
  }, [prontuario.patientId]);

  function f(key: keyof Anamnese) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value }),
    };
  }

  function salvar() {
    const temConteudo = Object.values(form).some(v => v.trim() !== "");
    if (!temConteudo) { toast.error("Preencha ao menos um campo antes de salvar."); return; }
    const novo: AnamneseRecord = { id: uid(), data: new Date().toISOString(), profissional, ...form };
    const atualizado = { ...prontuario, anamneses: [novo, ...prontuario.anamneses] };
    saveProntuario(atualizado); setProntuario(atualizado);
    toast.success("Anamnese salva!");
  }

  function excluir(id: string) {
    const atualizado = { ...prontuario, anamneses: prontuario.anamneses.filter(a => a.id !== id) };
    saveProntuario(atualizado); setProntuario(atualizado); toast.success("Anamnese excluída.");
  }

  const coresPaleta = ["#0891b2","#7c3aed","#db2777","#ea580c","#16a34a","#ca8a04","#dc2626","#2563eb"];
  const corPorProf: Record<string, string> = {};
  prontuario.anamneses.forEach(a => {
    if (!corPorProf[a.profissional]) corPorProf[a.profissional] = coresPaleta[Object.keys(corPorProf).length % coresPaleta.length];
  });

  return (
    <div className="space-y-4">
      <Secao titulo="Nova Anamnese" icone={<Plus className="w-4 h-4 text-cyan-600" />}>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Peso (kg)", key: "peso" as const, placeholder: "Ex: 70" },
              { label: "Altura (cm)", key: "altura" as const, placeholder: "Ex: 170" },
              { label: "Pressão (mmHg)", key: "pressao" as const, placeholder: "Ex: 120/80" },
              { label: "Temperatura (°C)", key: "temperatura" as const, placeholder: "Ex: 36.5" },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
                <input {...f(key)} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400" />
              </div>
            ))}
          </div>
          {[
            { label: "Queixa Principal", key: "queixaPrincipal" as const, rows: 2, placeholder: "Motivo da consulta..." },
            { label: "História da Doença Atual (HDA)", key: "hda" as const, rows: 3, placeholder: "Início, evolução, fatores de piora/melhora..." },
            { label: "História Patológica Pregressa (HPP)", key: "hpp" as const, rows: 3, placeholder: "Doenças anteriores, cirurgias, internações..." },
            { label: "História Familiar (HF)", key: "hf" as const, rows: 3, placeholder: "Doenças na família, histórico genético..." },
            { label: "Alergias", key: "alergias" as const, rows: 2, placeholder: "Medicamentos, alimentos, outros..." },
            { label: "Medicamentos em uso", key: "medicamentos" as const, rows: 2, placeholder: "Nome, dose, frequência..." },
            { label: "Hábitos de vida", key: "habitos" as const, rows: 2, placeholder: "Tabagismo, etilismo, atividade física..." },
          ].map(({ label, key, rows, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{label}</label>
              <textarea {...f(key)} rows={rows} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none" />
            </div>
          ))}
          <button onClick={salvar} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition">
            <Save className="w-4 h-4" /> Salvar Anamnese
          </button>
        </div>
      </Secao>

      <Secao titulo={`Histórico de Anamneses (${prontuario.anamneses.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />} defaultOpen={true}>
        {prontuario.anamneses.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma anamnese registrada.</p>
        ) : (() => {
          const todosProfissionais = [...new Set(prontuario.anamneses.map(a => a.profissional))];
          return (
            <div className="space-y-3 mt-4">
              {todosProfissionais.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-blue-800 mb-2">Profissionais com anamneses neste prontuário:</p>
                  <div className="flex flex-wrap gap-2">
                    {todosProfissionais.map(prof => (
                      <span key={prof} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: `${corPorProf[prof]}18`, color: corPorProf[prof], border: `1px solid ${corPorProf[prof]}44` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: corPorProf[prof] }} />
                        {prof}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {prontuario.anamneses.map((an) => {
                const isMeu = an.profissional === profissional;
                const cor = corPorProf[an.profissional] ?? "#64748b";
                const resumo = an.queixaPrincipal || an.hda || "";
                return (
                  <div key={an.id} className="border rounded-xl overflow-hidden" style={{ borderColor: `${cor}44` }}>
                    <button onClick={() => setExpandido(expandido === an.id ? null : an.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition text-left">
                      <div className="flex items-center gap-2 flex-wrap text-sm min-w-0">
                        <span className="font-semibold text-slate-700 shrink-0">{new Date(an.data).toLocaleDateString("pt-BR")}</span>
                        {(an.peso || an.pressao) && (
                          <span className="bg-rose-100 text-rose-700 text-xs font-medium px-2 py-0.5 rounded-full shrink-0">
                            {an.peso && `${an.peso}kg`}{an.peso && an.pressao && " · "}{an.pressao && `${an.pressao}mmHg`}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: `${cor}18`, color: cor, border: `1px solid ${cor}44` }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
                          {an.profissional}
                          {isMeu && <span className="opacity-60 font-normal">(você)</span>}
                        </span>
                        {resumo && <span className="text-slate-400 text-xs truncate max-w-[180px] hidden sm:block">{resumo}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isMeu && (
                          <button onClick={(e) => { e.stopPropagation(); excluir(an.id); }} className="p-1 text-slate-300 hover:text-red-500 transition rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {expandido === an.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </button>
                    {expandido === an.id && (
                      <div className="border-t px-4 py-4 space-y-3 text-sm" style={{ borderColor: `${cor}22`, background: `${cor}06` }}>
                        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <div className="w-2 h-2 rounded-full" style={{ background: cor }} />
                          <span className="text-xs font-semibold" style={{ color: cor }}>Registrado por {an.profissional}</span>
                          <span className="text-xs text-slate-400">em {new Date(an.data).toLocaleString("pt-BR")}</span>
                        </div>
                        {(an.peso || an.altura || an.pressao || an.temperatura) && (
                          <div>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Sinais Vitais</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[["Peso", an.peso, "kg"], ["Altura", an.altura, "cm"], ["Pressão", an.pressao, "mmHg"], ["Temperatura", an.temperatura, "°C"]].map(([l, v, u]) => v ? (
                                <div key={l} className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                                  <p className="text-[10px] text-slate-400 uppercase font-medium">{l}</p>
                                  <p className="text-sm font-bold text-slate-700">{v}<span className="text-xs font-normal text-slate-400 ml-0.5">{u}</span></p>
                                </div>
                              ) : null)}
                            </div>
                          </div>
                        )}
                        {[
                          ["Queixa Principal", an.queixaPrincipal],
                          ["História da Doença Atual", an.hda],
                          ["História Patológica Pregressa", an.hpp],
                          ["História Familiar", an.hf],
                          ["Alergias", an.alergias],
                          ["Medicamentos em uso", an.medicamentos],
                          ["Hábitos de vida", an.habitos],
                        ].map(([label, valor]) => valor ? (
                          <div key={label}>
                            <p className="text-xs font-semibold uppercase text-slate-400 mb-1">{label}</p>
                            <p className="text-slate-700 whitespace-pre-wrap">{valor}</p>
                          </div>
                        ) : null)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Secao>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PRESCRIÇÕES
// ══════════════════════════════════════════════════════════════════════════════
function PrescricaoTab({
  prontuario, setProntuario, profissional, paciente,
}: {
  prontuario: ProntuarioRecord;
  setProntuario: (p: ProntuarioRecord) => void;
  profissional: string;
  paciente: Patient;
}) {
  const [medicamentos, setMedicamentos] = useState("");
  const [observacoes, setObservacoes] = useState("");

  function salvar() {
    if (!medicamentos.trim()) {
      toast.error("Informe os medicamentos da prescrição.");
      return;
    }
    const nova: Prescricao = {
      id: uid(),
      data: new Date().toISOString(),
      profissional,
      medicamentos,
      observacoes,
    };
    const atualizado: ProntuarioRecord = {
      ...prontuario,
      prescricoes: [nova, ...prontuario.prescricoes],
    };
    saveProntuario(atualizado);
    setProntuario(atualizado);
    setMedicamentos("");
    setObservacoes("");
    toast.success("Prescrição salva!");
  }

  function excluir(id: string) {
    const atualizado: ProntuarioRecord = {
      ...prontuario,
      prescricoes: prontuario.prescricoes.filter((p) => p.id !== id),
    };
    saveProntuario(atualizado);
    setProntuario(atualizado);
  }

  function imprimir(p: Prescricao) {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Prescrição — ${paciente.name}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; font-size: 14px; }
        h2 { border-bottom: 2px solid #333; padding-bottom: 8px; }
        .info { color: #666; margin-bottom: 20px; }
        .meds { white-space: pre-wrap; line-height: 1.8; }
        .obs { margin-top: 16px; color: #444; }
        .footer { margin-top: 60px; border-top: 1px solid #333; padding-top: 12px; text-align: center; }
        @media print { button { display: none; } }
      </style></head><body>
      <h2>Prescrição Médica</h2>
      <div class="info">
        <strong>Paciente:</strong> ${paciente.name}<br/>
        <strong>Data:</strong> ${new Date(p.data).toLocaleDateString("pt-BR")}<br/>
        <strong>Profissional:</strong> ${p.profissional}
      </div>
      <div class="meds">${p.medicamentos}</div>
      ${p.observacoes ? `<div class="obs"><strong>Observações:</strong> ${p.observacoes}</div>` : ""}
      <div class="footer">${p.profissional}</div>
      <br/><button onclick="window.print()">🖨️ Imprimir</button>
      </body></html>
    `);
    win.document.close();
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Nova Prescrição" icone={<Pill className="w-4 h-4 text-violet-600" />}>
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Medicamentos</label>
            <textarea
              rows={5}
              value={medicamentos}
              onChange={(e) => setMedicamentos(e.target.value)}
              placeholder={"1. Dipirona 500mg — 1 comprimido a cada 6h por 5 dias\n2. Ibuprofeno 400mg — 1 comprimido 8/8h com alimento\n..."}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 resize-none font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Observações</label>
            <input
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Orientações gerais, restrições..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </div>
          <button
            onClick={salvar}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition"
          >
            <Save className="w-4 h-4" /> Salvar Prescrição
          </button>
        </div>
      </Secao>

      <Secao titulo={`Histórico de Prescrições (${prontuario.prescricoes.length})`} icone={<Calendar className="w-4 h-4 text-slate-500" />}>
        {prontuario.prescricoes.length === 0 ? (
          <p className="text-slate-400 text-sm py-4 text-center">Nenhuma prescrição registrada.</p>
        ) : (
          <div className="space-y-3 mt-4">
            {prontuario.prescricoes.map((p) => (
              <div key={p.id} className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="font-semibold text-slate-700 text-sm">
                      {new Date(p.data).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="text-slate-400 text-xs ml-2">{p.profissional}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => imprimir(p)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                      title="Imprimir"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => excluir(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Excluir"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 rounded-lg p-3 text-xs leading-relaxed">
                  {p.medicamentos}
                </pre>
                {p.observacoes && (
                  <p className="text-xs text-slate-500 mt-2">{p.observacoes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}