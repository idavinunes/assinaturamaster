import { SignJWT } from "jose";
import { getOnlyOfficeUrl } from "@/lib/onlyoffice";

type ConvertServiceResult = {
  errorCode: number;
  fileUrl?: string;
  percent?: number;
  endConvert?: boolean;
};

function getXmlTagValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  return match?.[1]?.trim();
}

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

async function signOnlyOfficeConvertPayload(payload: Record<string, unknown>) {
  const secret = process.env.ONLYOFFICE_JWT_SECRET;

  if (!secret) {
    throw new Error("ONLYOFFICE_JWT_SECRET nao configurado.");
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(secret));
}

function parseConvertServiceXml(xml: string): ConvertServiceResult {
  const errorCode = Number(getXmlTagValue(xml, "Error") ?? "0");
  const fileUrl = getXmlTagValue(xml, "FileUrl");
  const percent = Number(getXmlTagValue(xml, "Percent") ?? "0");
  const endConvertValue = getXmlTagValue(xml, "EndConvert");

  return {
    errorCode,
    fileUrl: fileUrl ? decodeXmlEntities(fileUrl) : undefined,
    percent: Number.isFinite(percent) ? percent : undefined,
    endConvert: endConvertValue?.toLowerCase() === "true",
  };
}

export async function convertDocxUrlToPdf(params: {
  documentUrl: string;
  documentKey: string;
  fileName: string;
}) {
  const requestPayload = {
    async: false,
    filetype: "docx",
    key: params.documentKey,
    outputtype: "pdf",
    title: params.fileName,
    url: params.documentUrl,
  } satisfies Record<string, unknown>;

  const token = await signOnlyOfficeConvertPayload(requestPayload);
  const response = await fetch(`${getOnlyOfficeUrl()}/ConvertService.ashx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestPayload),
    cache: "no-store",
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error("O ONLYOFFICE nao aceitou a requisicao de conversao.");
  }

  const conversionResult = parseConvertServiceXml(responseText);

  if (conversionResult.errorCode !== 0 || !conversionResult.fileUrl) {
    throw new Error(
      `Conversao DOCX para PDF falhou no ONLYOFFICE (codigo ${conversionResult.errorCode}).`,
    );
  }

  const pdfResponse = await fetch(conversionResult.fileUrl, {
    cache: "no-store",
  });

  if (!pdfResponse.ok) {
    throw new Error("O ONLYOFFICE gerou o PDF, mas o download final falhou.");
  }

  return new Uint8Array(await pdfResponse.arrayBuffer());
}
