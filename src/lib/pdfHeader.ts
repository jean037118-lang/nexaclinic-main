/**
 * pdfHeader.ts
 * Utilitário para cabeçalho padronizado em todos os PDFs do NexaClinic.
 * Lê os dados da empresa (nome, logo) do localStorage e aplica no topo do documento.
 *
 * Uso:
 *   import { drawPdfHeader } from "@/lib/pdfHeader";
 *   const yStart = await drawPdfHeader(doc, "TÍTULO DO RELATÓRIO", "Subtítulo opcional");
 *   // yStart = posição Y logo após o cabeçalho, pronto para continuar o conteúdo
 */

import jsPDF from "jspdf";

const EMPRESA_KEY = "nexaclinic_empresa";

interface EmpresaData {
  nomeFantasia?: string;
  razaoSocial?: string;
  logo?: string; // base64 ou URL
}

function getEmpresa(): EmpresaData {
  try {
    return JSON.parse(localStorage.getItem(EMPRESA_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Desenha o cabeçalho no documento jsPDF.
 * Retorna a posição Y imediatamente após o cabeçalho.
 */
export async function drawPdfHeader(
  doc: jsPDF,
  titulo: string,
  subtitulo?: string,
  orientation: "portrait" | "landscape" = "portrait"
): Promise<number> {
  const empresa = getEmpresa();
  const pageW = doc.internal.pageSize.getWidth();
  const dark:  [number, number, number] = [15,  23,  42];
  const white: [number, number, number] = [255, 255, 255];
  const teal:  [number, number, number] = [14, 116, 144];
  const slate: [number, number, number] = [148, 163, 184];

  const headerH = 26;

  // Fundo escuro
  doc.setFillColor(...dark);
  doc.rect(0, 0, pageW, headerH, "F");

  // Faixa teal na base do header
  doc.setFillColor(...teal);
  doc.rect(0, headerH - 2, pageW, 2, "F");

  const nomeCli = empresa.nomeFantasia || empresa.razaoSocial || "NexaClinic";

  // ── Logo ou nome ───────────────────────────────────────────────────────
  let leftX = 12;
  const logoSrc = empresa.logo ?? "";

  if (logoSrc) {
    try {
      // Detecta formato
      let format: "PNG" | "JPEG" = "PNG";
      if (logoSrc.startsWith("data:image/jpeg") || logoSrc.endsWith(".jpg") || logoSrc.endsWith(".jpeg")) {
        format = "JPEG";
      }

      const logoH = 16;
      const logoW = 40; // max width; jsPDF mantém proporção automaticamente

      if (logoSrc.startsWith("data:")) {
        doc.addImage(logoSrc, format, leftX, (headerH - logoH) / 2, logoW, logoH, undefined, "FAST");
      } else {
        // URL externa — tenta carregar via canvas
        const img = await loadImageAsBase64(logoSrc);
        if (img) {
          doc.addImage(img, "PNG", leftX, (headerH - logoH) / 2, logoW, logoH, undefined, "FAST");
        }
      }
      leftX += logoW + 6;
    } catch {
      // fallback para nome
      doc.setTextColor(...white);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text(nomeCli, leftX, 11);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...slate);
      doc.text("Gestão Clínica Inteligente", leftX, 17);
    }
  } else {
    doc.setTextColor(...white);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(nomeCli, leftX, 11);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate);
    doc.text("Gestão Clínica Inteligente", leftX, 17);
  }

  // ── Título e subtítulo (direita) ───────────────────────────────────────
  doc.setTextColor(...white);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, pageW - 12, 10, { align: "right" });

  if (subtitulo) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...slate);
    doc.text(subtitulo, pageW - 12, 16, { align: "right" });
  }

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...slate);
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, pageW - 12, 22, { align: "right" });

  return headerH + 6; // retorna Y para início do conteúdo
}

/** Carrega imagem externa como base64 via canvas (fallback para URLs) */
function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
