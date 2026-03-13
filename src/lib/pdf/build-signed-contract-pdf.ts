import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

type EvidenceImage = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
};

type EvidenceSnapshot = {
  ipAddress: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsAccuracyMeters?: number | null;
  locationAddress?: string | null;
  selfieCapturedAt?: string | null;
  signatureDrawnAt?: string | null;
  selfieImage?: EvidenceImage | null;
  signatureMarkImage?: EvidenceImage | null;
};

export type SignedContractPayload = {
  title: string;
  clientName: string;
  signerName: string;
  signerEmail: string;
  templateBody: string;
  signedAt: string;
  evidence: EvidenceSnapshot;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const BODY_FONT_SIZE = 11;
const LINE_HEIGHT = 18;

function wrapText(text: string, maxCharsPerLine: number) {
  return text
    .split("\n")
    .flatMap((paragraph) => {
      if (!paragraph.trim()) {
        return [""];
      }

      const words = paragraph.split(/\s+/);
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;

        if (candidate.length > maxCharsPerLine) {
          if (currentLine) {
            lines.push(currentLine);
          }

          currentLine = word;
        } else {
          currentLine = candidate;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines;
    });
}

async function embedEvidenceImage(pdfDoc: PDFDocument, image?: EvidenceImage | null) {
  if (!image) {
    return null;
  }

  if (image.mimeType === "image/png") {
    return pdfDoc.embedPng(image.bytes);
  }

  return pdfDoc.embedJpg(image.bytes);
}

function drawWrappedBlock(params: {
  page: PDFPage;
  lines: string[];
  x: number;
  startY: number;
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  lineHeight: number;
}) {
  const { page, lines, x, startY, font, size, color, lineHeight } = params;
  let cursorY = startY;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: cursorY,
      size,
      font,
      color,
    });
    cursorY -= lineHeight;
  }

  return cursorY;
}

function drawEvidenceHighlightCard(params: {
  page: PDFPage;
  x: number;
  topY: number;
  width: number;
  height: number;
  label: string;
  capturedAt?: string | null;
  image: PDFImage | null;
  labelFont: PDFFont;
  bodyFont: PDFFont;
}) {
  const {
    page,
    x,
    topY,
    width,
    height,
    label,
    capturedAt,
    image,
    labelFont,
    bodyFont,
  } = params;
  const bottomY = topY - height;

  page.drawRectangle({
    x,
    y: bottomY,
    width,
    height,
    borderWidth: 1,
    borderColor: rgb(0.85, 0.86, 0.82),
    color: rgb(0.98, 0.98, 0.97),
  });

  page.drawText(label, {
    x: x + 16,
    y: topY - 24,
    size: 13,
    font: labelFont,
    color: rgb(0.11, 0.14, 0.13),
  });

  if (capturedAt) {
    page.drawText(capturedAt, {
      x: x + 16,
      y: topY - 40,
      size: 8,
      font: bodyFont,
      color: rgb(0.45, 0.48, 0.45),
    });
  }

  const imageAreaX = x + 16;
  const imageAreaY = bottomY + 18;
  const imageAreaWidth = width - 32;
  const imageAreaHeight = height - 76;

  if (!image) {
    page.drawText("Evidencia visual indisponivel.", {
      x: imageAreaX,
      y: imageAreaY + imageAreaHeight / 2,
      size: 10,
      font: bodyFont,
      color: rgb(0.55, 0.57, 0.55),
    });
    return;
  }

  const baseDimensions = image.scale(1);
  const scale = Math.min(
    imageAreaWidth / baseDimensions.width,
    imageAreaHeight / baseDimensions.height,
    1,
  );
  const fitted = image.scale(scale);

  page.drawImage(image, {
    x: imageAreaX + (imageAreaWidth - fitted.width) / 2,
    y: imageAreaY + (imageAreaHeight - fitted.height) / 2,
    width: fitted.width,
    height: fitted.height,
  });
}

export async function buildSignedContractEvidenceAppendixPdf(
  payload: SignedContractPayload,
) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const selfieImage = await embedEvidenceImage(pdfDoc, payload.evidence.selfieImage);
  const signatureMarkImage = await embedEvidenceImage(
    pdfDoc,
    payload.evidence.signatureMarkImage,
  );

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const evidenceTitleY = PAGE_HEIGHT - MARGIN;
  page.drawText("Evidencias coletadas automaticamente", {
    x: MARGIN,
    y: evidenceTitleY,
    size: 12,
    font: boldFont,
    color: rgb(0.22, 0.24, 0.23),
  });

  const subtitleLines = wrapText(
    "Este anexo e gerado automaticamente em todo documento assinado, independente do modelo utilizado.",
    88,
  );

  drawWrappedBlock({
    page,
    lines: subtitleLines,
    x: MARGIN,
    startY: evidenceTitleY - 18,
    font: regularFont,
    size: 8.5,
    color: rgb(0.45, 0.48, 0.45),
    lineHeight: 12,
  });

  const cardsTopY = PAGE_HEIGHT - 128;
  const cardsGap = 20;
  const cardsWidth = PAGE_WIDTH - MARGIN * 2;
  const cardWidth = (cardsWidth - cardsGap) / 2;
  const cardHeight = 280;

  drawEvidenceHighlightCard({
    page,
    x: MARGIN,
    topY: cardsTopY,
    width: cardWidth,
    height: cardHeight,
    label: "Selfie do signatario",
    capturedAt: payload.evidence.selfieCapturedAt ?? undefined,
    image: selfieImage,
    labelFont: boldFont,
    bodyFont: regularFont,
  });

  drawEvidenceHighlightCard({
    page,
    x: MARGIN + cardWidth + cardsGap,
    topY: cardsTopY,
    width: cardWidth,
    height: cardHeight,
    label: "Visto de assinatura",
    capturedAt: payload.evidence.signatureDrawnAt ?? undefined,
    image: signatureMarkImage,
    labelFont: boldFont,
    bodyFont: regularFont,
  });

  const footerX = MARGIN;
  const footerY = MARGIN + 18;
  const footerWidth = PAGE_WIDTH - MARGIN * 2;
  const technicalTrail =
    `IP: ${payload.evidence.ipAddress} - ` +
    `Latitude: ${payload.evidence.latitude ?? "nao coletada"} - ` +
    `Longitude: ${payload.evidence.longitude ?? "nao coletada"} - ` +
    `Precisao GPS: ${
      payload.evidence.gpsAccuracyMeters !== null &&
      payload.evidence.gpsAccuracyMeters !== undefined
        ? `${payload.evidence.gpsAccuracyMeters} m`
        : "nao coletada"
    } - ` +
    `Selfie capturada em: ${payload.evidence.selfieCapturedAt ?? "nao informada"} - ` +
    `Visto de assinatura em: ${payload.evidence.signatureDrawnAt ?? "nao informada"} - ` +
    `Endereco: ${payload.evidence.locationAddress ?? "nao coletado"}`;

  page.drawLine({
    start: { x: footerX, y: footerY + 58 },
    end: { x: footerX + footerWidth, y: footerY + 58 },
    thickness: 1,
    color: rgb(0.84, 0.85, 0.81),
  });

  page.drawText("Trilha tecnica da coleta", {
    x: footerX,
    y: footerY + 42,
    size: 9,
    font: boldFont,
    color: rgb(0.32, 0.35, 0.33),
  });

  const technicalTrailLines = wrapText(technicalTrail, 108);
  drawWrappedBlock({
    page,
    lines: technicalTrailLines.slice(0, 4),
    x: footerX,
    startY: footerY + 26,
    font: regularFont,
    size: 8.5,
    color: rgb(0.34, 0.37, 0.35),
    lineHeight: 12,
  });

  return pdfDoc.save();
}

export async function appendEvidenceAppendixToPdf(params: {
  basePdfBytes: Uint8Array;
  payload: SignedContractPayload;
}) {
  const mergedPdf = await PDFDocument.load(params.basePdfBytes);
  const appendixPdf = await PDFDocument.load(
    await buildSignedContractEvidenceAppendixPdf(params.payload),
  );
  const appendixPages = await mergedPdf.copyPages(appendixPdf, appendixPdf.getPageIndices());

  for (const appendixPage of appendixPages) {
    mergedPdf.addPage(appendixPage);
  }

  return mergedPdf.save();
}

export async function buildSignedContractPdf(payload: SignedContractPayload) {
  const pdfDoc = await PDFDocument.create();
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY - neededHeight < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
    }
  };

  page.drawText("ASSINATURA DIGITAL COM EVIDENCIAS", {
    x: MARGIN,
    y: cursorY,
    size: 14,
    font: boldFont,
    color: rgb(0.08, 0.13, 0.11),
  });

  cursorY -= 34;

  const headerLines = [
    `Titulo: ${payload.title}`,
    `Cliente: ${payload.clientName}`,
    `Assinante: ${payload.signerName}`,
    `E-mail: ${payload.signerEmail}`,
    `Assinado em: ${payload.signedAt}`,
  ];

  for (const line of headerLines) {
    ensureSpace(LINE_HEIGHT);
    page.drawText(line, {
      x: MARGIN,
      y: cursorY,
      size: BODY_FONT_SIZE,
      font: regularFont,
      color: rgb(0.18, 0.23, 0.2),
    });
    cursorY -= LINE_HEIGHT;
  }

  cursorY -= 8;

  page.drawText("Corpo do contrato", {
    x: MARGIN,
    y: cursorY,
    size: 12,
    font: boldFont,
    color: rgb(0.07, 0.46, 0.43),
  });

  cursorY -= 24;

  for (const line of wrapText(payload.templateBody, 95)) {
    ensureSpace(LINE_HEIGHT);
    page.drawText(line, {
      x: MARGIN,
      y: cursorY,
      size: BODY_FONT_SIZE,
      font: regularFont,
      color: rgb(0.18, 0.23, 0.2),
    });
    cursorY -= LINE_HEIGHT;
  }

  return appendEvidenceAppendixToPdf({
    basePdfBytes: await pdfDoc.save(),
    payload,
  });
}
