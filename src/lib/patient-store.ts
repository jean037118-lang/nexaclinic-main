import { supabase } from "./supabase";
import type { Patient } from "./mock-data";

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
listeners.forEach((l) => l());
}

function mapFromDb(row: any): Patient {
return {
...row,
lastVisit: row.last_visit,
estadoCivil: row.estado_civil,
nomeMae: row.nome_mae,
nomePai: row.nome_pai,
convenioNumero: row.convenio_numero,
convenioValidade: row.convenio_validade,
historiaFamiliar: row.historia_familiar,
tipoSanguineo: row.tipo_sanguineo,
contatoEmergenciaNome: row.contato_emergencia_nome,
contatoEmergenciaTelefone: row.contato_emergencia_telefone,
contatoEmergenciaParentesco: row.contato_emergencia_parentesco,
cadastroCompleto: row.cadastro_completo,
};
}

function mapToDb(data: any) {
  return {
    name: data.name,
    cpf: data.cpf,
    birth: data.birth,
    phone: data.phone,
    email: data.email,
    insurance: data.insurance,
    last_visit: data.lastVisit,
    status: data.status,
    rg: data.rg,
    sexo: data.sexo,
    estado_civil: data.estadoCivil,
    profissao: data.profissao,
    nacionalidade: data.nacionalidade,
    naturalidade: data.naturalidade,
    nome_mae: data.nomeMae,
    nome_pai: data.nomePai,
    responsavel: data.responsavel,
    telefone2: data.telefone2,
    cep: data.cep,
    endereco: data.endereco,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    cidade: data.cidade,
    estado: data.estado,
    convenio_numero: data.convenioNumero,
    convenio_validade: data.convenioValidade,
    alergias: data.alergias,
    medicamentos: data.medicamentos,
    doencas: data.doencas,
    cirurgias: data.cirurgias,
    historia_familiar: data.historiaFamiliar,
    tipo_sanguineo: data.tipoSanguineo,
    observacoes: data.observacoes,
    contato_emergencia_nome: data.contatoEmergenciaNome,
    contato_emergencia_telefone:
      data.contatoEmergenciaTelefone,
    contato_emergencia_parentesco:
      data.contatoEmergenciaParentesco,
    cadastro_completo:
      data.cadastroCompleto ?? false,
  };
}
export const patientStore = {
async getAll(): Promise<Patient[]> {
const { data, error } = await supabase
.from("pacientes")
.select("*")
.order("created_at", { ascending: false });

```
if (error) {
  console.error(error);
  return [];
}

return (data || []).map(mapFromDb);
```

},

async add(
patient: Omit<Patient, "id">
): Promise<Patient> {
const payload = mapToDb(patient);

```
const { data, error } = await supabase
  .from("pacientes")
  .insert(payload)
  .select()
  .single();

if (error) {
  console.error(error);
  throw error;
}

notify();

return mapFromDb(data);
```

},

async update(
id: string,
updates: Partial<Omit<Patient, "id">>
): Promise<void> {
const payload = mapToDb(updates);

```
const { error } = await supabase
  .from("pacientes")
  .update(payload)
  .eq("id", id);

if (error) {
  console.error(error);
  throw error;
}

notify();
```

},

async remove(id: string): Promise<void> {
const { error } = await supabase
.from("pacientes")
.delete()
.eq("id", id);

```
if (error) {
  console.error(error);
  throw error;
}

notify();
```

},

async upsertByName(
name: string,
extra?: Partial<Omit<Patient, "id" | "name">>
): Promise<Patient> {
const { data: existing } = await supabase
.from("pacientes")
.select("*")
.ilike("name", name)
.maybeSingle();

```
if (existing) {
  const updates = mapToDb(extra || {});

  const { error } = await supabase
    .from("pacientes")
    .update(updates)
    .eq("id", existing.id);

  if (error) throw error;

  return {
    ...mapFromDb(existing),
    ...(extra || {}),
  } as Patient;
}

return await patientStore.add({
  name,
  cpf: extra?.cpf ?? "",
  birth: extra?.birth ?? "",
  phone: extra?.phone ?? "",
  email: extra?.email ?? "",
  insurance: extra?.insurance ?? "Particular",
  lastVisit:
    extra?.lastVisit ??
    new Date().toISOString().split("T")[0],
  status: extra?.status ?? "ativo",
} as Omit<Patient, "id">);
```

},

subscribe(listener: Listener) {
listeners.add(listener);

```
const channel = supabase
  .channel("pacientes_realtime")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "pacientes",
    },
    () => {
      listener();
    }
  )
  .subscribe();

return () => {
  listeners.delete(listener);
  supabase.removeChannel(channel);
};
```

},
};
