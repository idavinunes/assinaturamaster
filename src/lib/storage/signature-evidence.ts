import { unlink, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageRoot } from "@/lib/storage/root";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

type ParsedImageDataUrl = {
  mimeType: "image/jpeg" | "image/png";
  buffer: Buffer;
  extension: "jpg" | "png";
};

function parseImageDataUrl(dataUrl: string): ParsedImageDataUrl {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|png));base64,([a-zA-Z0-9+/=]+)$/);

  if (!match) {
    throw new Error("Formato de imagem invalido. Use JPEG ou PNG.");
  }

  const mimeType = match[1] as ParsedImageDataUrl["mimeType"];
  const buffer = Buffer.from(match[2], "base64");

  if (!buffer.length) {
    throw new Error("A imagem enviada esta vazia.");
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("A imagem ultrapassa o limite de 5 MB.");
  }

  return {
    mimeType,
    buffer,
    extension: mimeType === "image/png" ? "png" : "jpg",
  };
}

function buildAbsolutePath(relativePath: string) {
  return path.join(getStorageRoot(), relativePath);
}

async function persistEvidenceImage(params: {
  directory: string;
  fileNameBase: string;
  imageBase64: string;
  previousFilePath?: string | null;
}) {
  const parsed = parseImageDataUrl(params.imageBase64);
  const relativePath = path.posix.join(
    params.directory,
    `${params.fileNameBase}.${parsed.extension}`,
  );
  const absolutePath = buildAbsolutePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, parsed.buffer);

  if (params.previousFilePath && params.previousFilePath !== relativePath) {
    await unlink(buildAbsolutePath(params.previousFilePath)).catch(() => {});
  }

  return {
    storagePath: relativePath,
    mimeType: parsed.mimeType,
  };
}

export async function persistSignatureSelfie(params: {
  signatureRequestId: string;
  selfieBase64: string;
  previousSelfiePath?: string | null;
}) {
  return persistEvidenceImage({
    directory: "signature-selfies",
    fileNameBase: params.signatureRequestId,
    imageBase64: params.selfieBase64,
    previousFilePath: params.previousSelfiePath,
  });
}

export async function persistDrawnSignature(params: {
  signatureRequestId: string;
  signatureBase64: string;
  previousSignaturePath?: string | null;
}) {
  return persistEvidenceImage({
    directory: "signature-drawings",
    fileNameBase: params.signatureRequestId,
    imageBase64: params.signatureBase64,
    previousFilePath: params.previousSignaturePath,
  });
}

export async function readStoredEvidenceFile(storagePath: string) {
  return readFile(buildAbsolutePath(storagePath));
}

export async function deleteStoredEvidenceFile(storagePath?: string | null) {
  if (!storagePath) {
    return;
  }

  await unlink(buildAbsolutePath(storagePath)).catch(() => {});
}
