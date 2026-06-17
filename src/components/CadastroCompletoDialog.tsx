/**
 * src/components/CadastroCompletoDialog.tsx
 *
 * Modal de cadastro completo do paciente.
 * Usado em dois lugares:
 *   1. Agenda   → botão "Iniciar atendimento" abre este modal antes de mudar o status
 *   2. Pacientes → botão editar abre este modal (substituindo o form simples)
 *
 * Props:
 *   open        — controla visibilidade
 *   onOpenChange — fecha o modal
 *   patient     — paciente a editar (null = novo cadastro)
 *   onSave      — callback com o Patient salvo
 *   origem      — "agenda" | "pacientes" (muda o texto do botão e aviso)
 */

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { patientStore } from "@/lib/patient-store";
import { type Patient } from "@/lib/mock-data";
import { toast } from "sonner";
import {
  User, MapPin, Heart, Phone as PhoneIcon,
  CreditCard, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Secao({
  titulo, icone, children, defaultOpen = false,
}: {
  titulo: string;
  icone: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">{icone}{titulo}</span>
        {aberto
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {aberto && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Campo({
  label, children, full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="text-xs text-slate-500 mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

const INSURANCES = ["Particular","Unimed","Bradesco Saúde","SulAmérica","Amil","Hapvida","NotreDame","Porto Seguro","Outros"];
const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

// ─── Tipo do form ─────────────────────────────────────────────────────────────
type PatientForm = Omit<Patient, "id" | "lastVisit" | "criadoEm" | "cadastroCompleto">;

function formVazio(base?: Partial<Patient>): PatientForm {
  return {
    name:                        base?.name                        ?? "",
    cpf:                         base?.cpf                         ?? "",
    birth:                       base?.birth                       ?? "",
    phone:                       base?.phone                       ?? "",
    email:                       base?.email                       ?? "",
    insurance:                   base?.insurance                   ?? "Particular",
    status:                      base?.status                      ?? "ativo",
    rg:                          base?.rg                          ?? "",
    sexo:                        base?.sexo                        ?? undefined,
    estadoCivil:                 base?.estadoCivil                 ?? undefined,
    profissao:                   base?.profissao                   ?? "",
    nacionalidade:               base?.nacionalidade               ?? "Brasileira",
    naturalidade:                base?.naturalidade                ?? "",
    nomeMae:                     base?.nomeMae                     ?? "",
    nomePai:                     base?.nomePai                     ?? "",
    responsavel:                 base?.responsavel                 ?? "",
    telefone2:                   base?.telefone2                   ?? "",
    cep:                         base?.cep                         ?? "",
    endereco:                    base?.endereco                    ?? "",
    numero:                      base?.numero                      ?? "",
    complemento:                 base?.complemento                 ?? "",
    bairro:                      base?.bairro                      ?? "",
    cidade:                      base?.cidade                      ?? "",
    estado:                      base?.estado                      ?? "",
    convenioNumero:              base?.convenioNumero              ?? "",
    convenioValidade:            base?.convenioValidade            ?? "",
    alergias:                    base?.alergias                    ?? "",
    medicamentos:                base?.medicamentos                ?? "",
    doencas:                     base?.doencas                     ?? "",
    cirurgias:                   base?.cirurgias                   ?? "",
    historiaFamiliar:            base?.historiaFamiliar            ?? "",
    tipoSanguineo:               base?.tipoSanguineo               ?? undefined,
    observacoes:                 base?.observacoes                 ?? "",
    contatoEmergenciaNome:       base?.contatoEmergenciaNome       ?? "",
    contatoEmergenciaTelefone:   base?.contatoEmergenciaTelefone   ?? "",
    contatoEmergenciaParentesco: base?.contatoEmergenciaParentesco ?? "",
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function CadastroCompletoDialog({
  open,
  onOpenChange,
  patient,
  onSave,
  origem = "pacientes",
}: {
  open:          boolean;
  onOpenChange:  (o: boolean) => void;
  patient:       Patient | null;
  onSave:        (saved: Patient) => void;
  origem?:       "agenda" | "pacientes";
}) {
  const [form, setForm] = useState<PatientForm>(formVazio());

  useEffect(() => {
    if (open) setForm(formVazio(patient ?? undefined));
  }, [open, patient]);

  function f(key: keyof PatientForm) {
    return {
      value: (form[key] as string) ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    };
  }

  function sel(key: keyof PatientForm) {
    return {
      value: (form[key] as string) ?? "",
      onValueChange: (v: string) => setForm((prev) => ({ ...prev, [key]: v })),
    };
  }

  function salvar() {
    if (!form.name.trim()) { toast.error("Nome do paciente é obrigatório."); return; }

    let saved: Patient;

    if (patient) {
      patientStore.update(patient.id, { ...form, cadastroCompleto: true });
      saved = { ...patient, ...form, cadastroCompleto: true };
      toast.success("Cadastro atualizado!");
    } else {
      saved = patientStore.add({
        ...form,
        lastVisit: new Date().toISOString().split("T")[0],
        cadastroCompleto: true,
        criadoEm: new Date().toISOString(),
      });
      toast.success("Paciente cadastrado!");
    }

    onSave(saved);
    onOpenChange(false);
  }

  const titulo = patient
    ? `Cadastro — ${patient.name}`
    : "Novo Paciente";

  const descricao = origem === "agenda"
    ? "Complete o cadastro antes de iniciar o atendimento. Você pode pular e preencher depois."
    : "Preencha as seções necessárias. Apenas o nome é obrigatório.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">

          {/* ── Identificação (sempre aberto) ─────────────────────────── */}
          <Secao
            titulo="Identificação"
            icone={<User className="w-4 h-4 text-cyan-600" />}
            defaultOpen
          >
            <Row>
              <Campo label="Nome completo *" full>
                <Input {...f("name")} placeholder="Nome completo" />
              </Campo>
            </Row>
            <Row>
              <Campo label="CPF">
                <Input {...f("cpf")} placeholder="000.000.000-00" />
              </Campo>
              <Campo label="RG">
                <Input {...f("rg")} placeholder="00.000.000-0" />
              </Campo>
            </Row>
            <Row>
              <Campo label="Data de nascimento">
                <Input type="date" {...f("birth")} />
              </Campo>
              <Campo label="Sexo">
                <Select {...sel("sexo")}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
            </Row>
            <Row>
              <Campo label="Estado civil">
                <Select {...sel("estadoCivil")}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                    <SelectItem value="casado">Casado(a)</SelectItem>
                    <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                    <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    <SelectItem value="uniao_estavel">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Profissão">
                <Input {...f("profissao")} placeholder="Ex: Professora" />
              </Campo>
            </Row>
            <Row>
              <Campo label="Nacionalidade">
                <Input {...f("nacionalidade")} placeholder="Brasileira" />
              </Campo>
              <Campo label="Naturalidade">
                <Input {...f("naturalidade")} placeholder="São Paulo/SP" />
              </Campo>
            </Row>
            <Row>
              <Campo label="Nome da mãe">
                <Input {...f("nomeMae")} placeholder="Nome completo" />
              </Campo>
              <Campo label="Nome do pai">
                <Input {...f("nomePai")} placeholder="Nome completo" />
              </Campo>
            </Row>
            <Campo label="Responsável (para menores)">
              <Input {...f("responsavel")} placeholder="Nome e parentesco" />
            </Campo>
          </Secao>

          {/* ── Contato ───────────────────────────────────────────────── */}
          <Secao
            titulo="Contato"
            icone={<PhoneIcon className="w-4 h-4 text-green-600" />}
            defaultOpen
          >
            <Row>
              <Campo label="Telefone / Celular">
                <Input {...f("phone")} placeholder="(00) 90000-0000" />
              </Campo>
              <Campo label="Telefone 2">
                <Input {...f("telefone2")} placeholder="(00) 90000-0000" />
              </Campo>
            </Row>
            <Campo label="E-mail">
              <Input type="email" {...f("email")} placeholder="email@exemplo.com" />
            </Campo>
          </Secao>

          {/* ── Endereço ──────────────────────────────────────────────── */}
          <Secao
            titulo="Endereço"
            icone={<MapPin className="w-4 h-4 text-orange-500" />}
          >
            <Row>
              <Campo label="CEP">
                <Input {...f("cep")} placeholder="00000-000" />
              </Campo>
              <Campo label="Estado">
                <Select {...sel("estado")}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BR.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </Row>
            <Row>
              <Campo label="Logradouro" full>
                <Input {...f("endereco")} placeholder="Rua, Avenida..." />
              </Campo>
            </Row>
            <Row>
              <Campo label="Número">
                <Input {...f("numero")} placeholder="123" />
              </Campo>
              <Campo label="Complemento">
                <Input {...f("complemento")} placeholder="Apto, Bloco..." />
              </Campo>
            </Row>
            <Row>
              <Campo label="Bairro">
                <Input {...f("bairro")} placeholder="Bairro" />
              </Campo>
              <Campo label="Cidade">
                <Input {...f("cidade")} placeholder="Cidade" />
              </Campo>
            </Row>
          </Secao>

          {/* ── Convênio ──────────────────────────────────────────────── */}
          <Secao
            titulo="Convênio / Plano de Saúde"
            icone={<CreditCard className="w-4 h-4 text-blue-600" />}
            defaultOpen
          >
            <Row>
              <Campo label="Convênio">
                <Select {...sel("insurance")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INSURANCES.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Nº da carteirinha">
                <Input {...f("convenioNumero")} placeholder="0000000000" />
              </Campo>
            </Row>
            <Campo label="Validade do plano">
              <Input type="date" {...f("convenioValidade")} className="w-48" />
            </Campo>
          </Secao>

          {/* ── Dados clínicos ────────────────────────────────────────── */}
          <Secao
            titulo="Dados Clínicos"
            icone={<Heart className="w-4 h-4 text-rose-500" />}
          >
            <Row>
              <Campo label="Tipo sanguíneo">
                <Select {...sel("tipoSanguineo")}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Status">
                <Select {...sel("status")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
            </Row>
            <Campo label="Alergias" full>
              <Textarea
                {...f("alergias")}
                rows={2}
                placeholder="Medicamentos, alimentos, látex..."
                className="resize-none text-sm"
              />
            </Campo>
            <Campo label="Medicamentos em uso contínuo" full>
              <Textarea
                {...f("medicamentos")}
                rows={2}
                placeholder="Nome, dose, frequência..."
                className="resize-none text-sm"
              />
            </Campo>
            <Campo label="Histórico de doenças / diagnósticos" full>
              <Textarea
                {...f("doencas")}
                rows={2}
                placeholder="Hipertensão, diabetes, etc."
                className="resize-none text-sm"
              />
            </Campo>
            <Campo label="Cirurgias / internações" full>
              <Textarea
                {...f("cirurgias")}
                rows={2}
                placeholder="Apendicectomia (2010), etc."
                className="resize-none text-sm"
              />
            </Campo>
            <Campo label="História familiar" full>
              <Textarea
                {...f("historiaFamiliar")}
                rows={2}
                placeholder="Cardiopatia, câncer, diabetes na família..."
                className="resize-none text-sm"
              />
            </Campo>
            <Campo label="Observações gerais" full>
              <Textarea
                {...f("observacoes")}
                rows={2}
                placeholder="Outras informações relevantes..."
                className="resize-none text-sm"
              />
            </Campo>
          </Secao>

          {/* ── Contato de emergência ─────────────────────────────────── */}
          <Secao
            titulo="Contato de Emergência"
            icone={<AlertTriangle className="w-4 h-4 text-amber-500" />}
          >
            <Row>
              <Campo label="Nome">
                <Input {...f("contatoEmergenciaNome")} placeholder="Nome completo" />
              </Campo>
              <Campo label="Parentesco">
                <Input {...f("contatoEmergenciaParentesco")} placeholder="Ex: Cônjuge, Filho(a)" />
              </Campo>
            </Row>
            <Campo label="Telefone de emergência">
              <Input {...f("contatoEmergenciaTelefone")} placeholder="(00) 90000-0000" className="w-64" />
            </Campo>
          </Secao>

        </div>

        <DialogFooter className="pt-2 gap-2">
          {origem === "agenda" && (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Pular por agora
            </Button>
          )}
          {origem === "pacientes" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          <Button
            onClick={salvar}
            className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl gap-2"
          >
            {patient ? "Salvar cadastro" : "Cadastrar paciente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
