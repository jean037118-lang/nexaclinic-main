/**
 * fichaClinica.ts
 * Gera a "Ficha Clínica" em PDF de um agendamento: dados do paciente e do
 * agendamento no topo, e uma área em branco pautada para anamnese/evolução
 * — pensada para ser impressa e preenchida à mão durante o atendimento.
 *
 * Uso:
 *   import { gerarFichaClinicaPDF } from "@/lib/fichaClinica";
 *   await gerarFichaClinicaPDF({ appointment, patient, professionalName });
 */
import jsPDF from "jspdf";
import { drawPdfHeader } from "@/lib/pdfHeader";
import type { Patient } from "@/lib/mock-data";

interface FichaAppointment {
  patientName: string;
  date: string;        // "YYYY-MM-DD"
  start: string;        // "HH:MM"
  durationMin?: number;
  procedure?: string;
  insurance?: string;
  phone?: string;
}

function calcularIdade(birth?: string): string {
  if (!birth) return "—";
  const nasc = new Date(birth + "T12:00:00");
  if (isNaN(nasc.getTime())) return "—";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < nasc.getMonth() ||
    (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate());
  if (aindaNaoFezAniversario) idade--;
  return `${idade} anos`;
}

function fmtData(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function fmtCpf(cpf?: string): string {
  if (!cpf) return "—";
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11) return cpf;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

export async function gerarFichaClinicaPDF(params: {
  appointment: FichaAppointment;
  patient?: Patient | null;
  professionalName?: string;
}) {
  const { appointment: apt, patient, professionalName } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const escuro: [number, number, number] = [15, 23, 42];
  const cinza: [number, number, number] = [71, 85, 105];
  const azul: [number, number, number] = [8, 145, 178];
  const linhaClara: [number, number, number] = [203, 213, 225];

  let y = await drawPdfHeader(doc, "FICHA CLÍNICA", apt.patientName);
  y += 4;

  // ── Bloco: dados do paciente ─────────────────────────────────────────
  doc.setTextColor(...escuro);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Paciente", 14, y);
  doc.setDrawColor(...azul);
  doc.setLineWidth(0.8);
  doc.line(14, y + 2, 60, y + 2);
  y += 8;

  const campoPaciente = (label: string, valor: string, x: number, largura: number) => {
    doc.setTextColor(...cinza);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...escuro);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const texto = doc.splitTextToSize(valor || "—", largura);
    doc.text(texto, x, y + 5);
  };

  campoPaciente("Nome completo", apt.patientName, 14, 120);
  campoPaciente("Data de nascimento", `${fmtData(patient?.birth)}  (${calcularIdade(patient?.birth)})`, 140, 56);
  y += 12;

  campoPaciente("CPF", fmtCpf(patient?.cpf), 14, 56);
  campoPaciente("Telefone", patient?.phone || apt.phone || "—", 76, 56);
  campoPaciente("Sexo", patient?.sexo ? patient.sexo.charAt(0).toUpperCase() + patient.sexo.slice(1) : "—", 140, 56);
  y += 12;

  if (patient?.nomeMae) {
    campoPaciente("Nome da mãe", patient.nomeMae, 14, 182);
    y += 12;
  }

  // ── Bloco: dados do agendamento ──────────────────────────────────────
  y += 2;
  doc.setTextColor(...escuro);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Agendamento", 14, y);
  doc.setDrawColor(...azul);
  doc.setLineWidth(0.8);
  doc.line(14, y + 2, 68, y + 2);
  y += 8;

  campoPaciente("Data", fmtData(apt.date), 14, 40);
  campoPaciente("Horário", `${apt.start || "—"}${apt.durationMin ? ` (${apt.durationMin} min)` : ""}`, 56, 50);
  campoPaciente("Profissional", professionalName || "—", 108, 88);
  y += 12;

  campoPaciente("Procedimento", apt.procedure || "—", 14, 100);
  campoPaciente("Convênio", apt.insurance || "Particular", 118, 78);
  y += 14;

  // ── Área em branco pautada para anamnese / evolução ──────────────────
  doc.setTextColor(...escuro);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Anamnese / Evolução", 14, y);
  doc.setDrawColor(...azul);
  doc.setLineWidth(0.8);
  doc.line(14, y + 2, 62, y + 2);
  y += 10;

  const pageH = doc.internal.pageSize.getHeight();
  const margemInferior = 24; // espaço reservado para a assinatura
  const espacamentoLinha = 8;
  doc.setDrawColor(...linhaClara);
  doc.setLineWidth(0.2);
  for (let linhaY = y; linhaY < pageH - margemInferior; linhaY += espacamentoLinha) {
    doc.line(14, linhaY, 196, linhaY);
  }

  // ── Rodapé: assinatura ────────────────────────────────────────────────
  const assinaturaY = pageH - 14;
  doc.setDrawColor(...cinza);
  doc.setLineWidth(0.3);
  doc.line(14, assinaturaY, 100, assinaturaY);
  doc.setTextColor(...cinza);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Assinatura do profissional", 14, assinaturaY + 4);

  doc.line(130, assinaturaY, 196, assinaturaY);
  doc.text("Data", 130, assinaturaY + 4);

  const nomeArquivo = `ficha-clinica-${apt.patientName.replace(/\s+/g, "-").toLowerCase()}-${apt.date}.pdf`;
  doc.save(nomeArquivo);
}
