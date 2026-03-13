import { buildSignedContractPdf } from "@/lib/pdf/build-signed-contract-pdf";

export async function GET() {
  const pdfBytes = await buildSignedContractPdf({
    title: "Contrato de Prestacao de Servicos",
    clientName: "Cliente Exemplo LTDA",
    signerName: "Carlos Souza",
    signerEmail: "carlos.souza@email.com",
    signedAt: new Date().toLocaleString("pt-BR"),
    templateBody:
      "Pelo presente instrumento, as partes formalizam a contratacao dos servicos descritos neste documento. A assinatura deste contrato sera acompanhada por evidencias de selfie, geolocalizacao, IP e horario para reforcar a trilha probatoria do aceite.",
    evidence: {
      ipAddress: "203.0.113.12",
      latitude: -23.55052,
      longitude: -46.633308,
      gpsAccuracyMeters: 18,
      locationAddress: "Praca da Se, Se, Sao Paulo - SP, Brasil",
      selfieCapturedAt: new Date().toISOString(),
      signatureDrawnAt: new Date().toISOString(),
    },
  });

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="contrato-assinado-demo.pdf"',
    },
  });
}
