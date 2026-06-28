import { useState, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { registrarAuditoria } from "@/lib/auth";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Download, X, Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { v4 as uuid } from "uuid";

// ─── Mapeamento colunas CSV/Excel → campos do Supabase ───────────────────────
// Adicione aqui aliases extras que sua planilha possa usar
const CAMPO_MAP: Record<string, string> = {
  // nome
  nome: "name", name: "name", "nome completo": "name",
  // cpf
  cpf: "cpf",
  // rg
  rg: "rg",
  // nascimento
  nascimento: "birth", "data nascimento": "birth", "data de nascimento": "birth", birth: "birth",
  // sexo
  sexo: "sexo", genero: "sexo", gênero: "sexo",
  // estado civil
  "estado civil": "estado_civil", estadocivil: "estado_civil", "estadocivil": "estado_civil",
  // profissão
  profissao: "profissao", profissão: "profissao",
  // nome mãe / pai
  "nome mae": "nome_mae", "nome da mae": "nome_mae", mae: "nome_mae",
  "nome pai": "nome_pai", "nome do pai": "nome_pai", pai: "nome_pai",
  // telefone
  telefone: "phone", celular: "phone", fone: "phone", phone: "phone",
  "telefone 2": "telefone2", telefone2: "telefone2",
  // email
  email: "email", "e-mail": "email",
  // endereço
  cep: "cep",
  endereco: "endereco", endereço: "endereco", logradouro: "endereco",
  numero: "numero", número: "numero",
  bairro: "bairro",
  cidade: "cidade",
  estado: "estado", uf: "estado",
  // convênio
  convenio: "insurance", convênio: "insurance", plano: "insurance", insurance: "insurance",
  "numero carteirinha": "convenio_numero", "nº carteirinha": "convenio_numero",
  "validade convenio": "convenio_validade", "validade convênio": "convenio_validade",
  // saúde
  "tipo sanguineo": "tipo_sanguineo", "tipo sanguíneo": "tipo_sanguineo",
  alergias: "alergias",
  medicamentos: "medicamentos",
  doencas: "doencas", doenças: "doencas",
  cirurgias: "cirurgias",
  observacoes: "observacoes", observações: "observacoes",
};

type Row = Record<string, any>;

function normKey(k: string) {
  return k.toLowerCase().trim().replace(/\s+/g, " ");
}

function parsearPlanilha(file: File): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array", cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Normalizadores para CHECK constraints do Supabase ───────────────────────

const ESTADO_CIVIL_MAP: Record<string, string> = {
  solteiro: "solteiro", solteira: "solteiro",
  casado: "casado", casada: "casado",
  divorciado: "divorciado", divorciada: "divorciado",
  viuvo: "viuvo", viuvo: "viuvo", viuva: "viuvo",
  "uniao estavel": "uniao_estavel", "uniao_estavel": "uniao_estavel",
  "uniao enstavel": "uniao_estavel",
};

const SEXO_MAP: Record<string, string> = {
  masculino: "masculino", masc: "masculino", m: "masculino", homem: "masculino",
  feminino: "feminino", fem: "feminino", f: "feminino", mulher: "feminino",
  outro: "outro", outros: "outro", "nao binario": "outro", "não binário": "outro",
};

const TIPO_SANGUINEO_ACEITOS = new Set(["A+","A-","B+","B-","AB+","AB-","O+","O-"]);

function normStr(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, " ");
}

function normalizarEstadoCivil(val: string): string | null {
  return ESTADO_CIVIL_MAP[normStr(val)] ?? null;
}

function normalizarSexo(val: string): string | null {
  return SEXO_MAP[normStr(val)] ?? null;
}

function normalizarTipoSanguineo(val: string): string | null {
  const upper = val.trim().toUpperCase();
  return TIPO_SANGUINEO_ACEITOS.has(upper) ? upper : null;
}

function mapearLinhas(raw: Row[]): Row[] {
  return raw.map((r) => {
    const mapped: Row = {
      id: uuid(),
      created_at: new Date().toISOString(),
      status: "ativo", // valor padrão aceito pelo constraint
    };
    for (const [orig, val] of Object.entries(r)) {
      const campo = CAMPO_MAP[normKey(orig)];
      if (campo) mapped[campo] = val ?? "";
    }

    // normaliza campos com CHECK constraint
    if (mapped.estado_civil !== undefined) {
      const v = normalizarEstadoCivil(String(mapped.estado_civil));
      if (v) mapped.estado_civil = v; else delete mapped.estado_civil;
    }
    if (mapped.sexo !== undefined) {
      const v = normalizarSexo(String(mapped.sexo));
      if (v) mapped.sexo = v; else delete mapped.sexo;
    }
    if (mapped.tipo_sanguineo !== undefined) {
      const v = normalizarTipoSanguineo(String(mapped.tipo_sanguineo));
      if (v) mapped.tipo_sanguineo = v; else delete mapped.tipo_sanguineo;
    }

    if (!mapped.name) mapped.name = "";
    return mapped;
  }).filter(r => r.name);
}

async function enviarLotes(rows: Row[], onProgresso: (n: number) => void) {
  const LOTE = 50;
  let importados = 0;
  const erros: string[] = [];

  for (let i = 0; i < rows.length; i += LOTE) {
    const lote = rows.slice(i, i + LOTE);
    const { error } = await supabase
      .from("pacientes")
      .insert(lote);

    if (error) {
      erros.push(`Lote ${Math.floor(i / LOTE) + 1}: ${error.message}`);
    } else {
      importados += lote.length;
    }
    onProgresso(Math.min(i + LOTE, rows.length));
  }

  return { importados, erros };
}

// ─── Componente ───────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConcluido?: () => void;
}

type Etapa = "upload" | "preview" | "importando" | "resultado";

export function ImportarPacientesDialog({ open, onOpenChange, onConcluido }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa]         = useState<Etapa>("upload");
  const [rows, setRows]           = useState<Row[]>([]);
  const [progresso, setProgresso] = useState(0);
  const [resultado, setResultado] = useState<{ importados: number; erros: string[] } | null>(null);
  const [fileName, setFileName]   = useState("");

  function reset() {
    setEtapa("upload");
    setRows([]);
    setProgresso(0);
    setResultado(null);
    setFileName("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFileName(f.name);
    try {
      const raw    = await parsearPlanilha(f);
      const mapped = mapearLinhas(raw);
      if (mapped.length === 0) {
        toast.error("Nenhum paciente encontrado. Verifique se a planilha tem coluna 'Nome'.");
        return;
      }
      setRows(mapped);
      setEtapa("preview");
    } catch {
      toast.error("Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.");
    }
  }

  async function handleImportar() {
    setEtapa("importando");
    setProgresso(0);
    const res = await enviarLotes(rows, (n) => setProgresso(n));
    setResultado(res);
    setEtapa("resultado");
    if (res.erros.length === 0) {
      registrarAuditoria("IMPORTAR_PACIENTES", `${res.importados} paciente(s) importado(s) via planilha`);
      onConcluido?.();
    }
  }

  const pct = rows.length > 0 ? Math.round((progresso / rows.length) * 100) : 0;

  // Colunas detectadas para preview
  const colsPreview = ["name", "cpf", "phone", "email", "birth", "insurance"].filter(
    c => rows[0]?.[c] !== undefined
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-cyan-600" /> Importar pacientes em massa
          </DialogTitle>
          <DialogDescription>
            Envie uma planilha Excel ou CSV com os dados dos pacientes.
          </DialogDescription>
        </DialogHeader>

        {/* ── ETAPA 1: upload ── */}
        {etapa === "upload" && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 transition group"
            >
              <FileText className="h-10 w-10 mx-auto text-slate-300 group-hover:text-cyan-500 mb-3 transition" />
              <p className="font-semibold text-slate-600 group-hover:text-cyan-700">
                Clique para selecionar a planilha
              </p>
              <p className="text-xs text-slate-400 mt-1">.xlsx · .xls · .csv</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </div>

            {/* Modelo para download */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Baixar modelo de planilha</p>
                <p className="text-xs text-slate-400 mt-0.5">Use o modelo para garantir que as colunas sejam reconhecidas</p>
              </div>
              <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={baixarModelo}>
                <Download className="h-4 w-4" /> Baixar modelo
              </Button>
            </div>

            {/* Colunas aceitas */}
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer font-medium text-slate-500 hover:text-slate-700">
                Ver colunas reconhecidas automaticamente
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Nome", "CPF", "RG", "Nascimento", "Sexo", "Estado Civil", "Profissão",
                  "Telefone", "Telefone 2", "Email", "CEP", "Endereço", "Número",
                  "Bairro", "Cidade", "Estado/UF", "Convênio/Plano", "Tipo Sanguíneo",
                  "Alergias", "Medicamentos", "Observações"].map(c => (
                  <span key={c} className="bg-slate-100 px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* ── ETAPA 2: preview ── */}
        {etapa === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">{fileName}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  <span className="text-emerald-600 font-semibold">{rows.length}</span> paciente(s) detectado(s) — prévia das primeiras 5 linhas:
                </p>
              </div>
              <button onClick={reset} className="text-slate-400 hover:text-slate-600 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabela preview */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {colsPreview.map(c => (
                      <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {colsPreview.map(c => (
                        <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                          {String(r[c] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && (
              <p className="text-xs text-slate-400 text-center">+ {rows.length - 5} mais não exibido(s)</p>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImportar} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                <Upload className="h-4 w-4" />
                Importar {rows.length} paciente(s)
              </Button>
            </div>
          </div>
        )}

        {/* ── ETAPA 3: importando ── */}
        {etapa === "importando" && (
          <div className="flex flex-col items-center gap-5 py-8">
            <Loader2 className="h-10 w-10 text-cyan-500 animate-spin" />
            <p className="text-sm font-semibold text-slate-700">
              Importando… {progresso} / {rows.length} pacientes
            </p>
            <div className="w-full max-w-sm bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">{pct}% concluído</p>
          </div>
        )}

        {/* ── ETAPA 4: resultado ── */}
        {etapa === "resultado" && resultado && (
          <div className="flex flex-col items-center gap-4 py-6">
            {resultado.erros.length === 0 ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="text-lg font-bold text-slate-800">Importação concluída!</p>
                <p className="text-sm text-slate-500">
                  <span className="text-emerald-600 font-semibold">{resultado.importados}</span> paciente(s) criado(s) no Supabase com sucesso.
                </p>
              </>
            ) : (
              <>
                <AlertCircle className="h-12 w-12 text-amber-500" />
                <p className="text-lg font-bold text-slate-800">Importação parcial</p>
                <p className="text-sm text-slate-500">
                  {resultado.importados} importado(s). {resultado.erros.length} lote(s) com erro.
                </p>
                <details className="text-xs text-red-500 w-full bg-red-50 rounded-xl p-3">
                  <summary className="cursor-pointer font-semibold">Ver erros</summary>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    {resultado.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </details>
              </>
            )}
            <Button className="mt-2 bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => { reset(); onOpenChange(false); }}>
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Gera e baixa o modelo de planilha ───────────────────────────────────────
function baixarModelo() {
  const cabecalho = [
    "Nome", "CPF", "RG", "Nascimento", "Sexo", "Estado Civil", "Profissão",
    "Telefone", "Telefone 2", "Email", "CEP", "Endereço", "Número",
    "Bairro", "Cidade", "Estado", "Convênio", "Tipo Sanguíneo",
    "Alergias", "Medicamentos", "Observações",
  ];
  const exemplo = [
    "Maria Silva", "123.456.789-00", "1234567", "1985-04-20", "Feminino",
    "Casada", "Professora", "(77) 99999-0000", "", "maria@email.com",
    "47800-000", "Rua das Flores", "10", "Centro", "Chapecó", "SC",
    "Unimed", "A+", "Dipirona", "", "Paciente hipertensa",
  ];
  const ws = XLSX.utils.aoa_to_sheet([cabecalho, exemplo]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pacientes");
  XLSX.writeFile(wb, "modelo_importacao_pacientes.xlsx");
}
