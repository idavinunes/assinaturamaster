import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "@prisma/client";
import { getStorageRoot } from "@/lib/storage/root";

const CLIENT_DOCUMENT_DIRECTORY = "client-documents";
const MAX_CLIENT_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_TYPE_TO_EXTENSION = new Map<string, string>([
  ["application/pdf", "pdf"],
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const ALLOWED_EXTENSIONS = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

function buildAbsolutePath(relativePath: string) {
  return path.join(getStorageRoot(), relativePath);
}

function resolveDocumentMimeType(params: {
  fileName: string;
  mimeType?: string | null;
}) {
  const normalizedMimeType = (params.mimeType ?? "").trim().toLowerCase();
  const fileExtension = path.extname(params.fileName).trim().toLowerCase();

  if (normalizedMimeType) {
    const extensionFromMimeType = MIME_TYPE_TO_EXTENSION.get(normalizedMimeType);

    if (!extensionFromMimeType) {
      throw new Error("Envie um PDF, JPG, PNG ou WEBP.");
    }

    return {
      mimeType: normalizedMimeType,
      extension: extensionFromMimeType,
    };
  }

  if (!ALLOWED_EXTENSIONS.has(fileExtension)) {
    throw new Error("Envie um PDF, JPG, PNG ou WEBP.");
  }

  const normalizedExtension = fileExtension === ".jpeg" ? ".jpg" : fileExtension;
  const mimeType = Array.from(MIME_TYPE_TO_EXTENSION.entries()).find(
    ([, extension]) => extension === normalizedExtension.slice(1),
  )?.[0];

  if (!mimeType) {
    throw new Error("Nao foi possivel identificar o tipo do arquivo enviado.");
  }

  return {
    mimeType,
    extension: normalizedExtension.slice(1),
  };
}

function normalizeOriginalFileName(fileName: string) {
  const trimmedFileName = fileName.trim();

  if (!trimmedFileName) {
    return "documento";
  }

  return path.basename(trimmedFileName);
}

export async function persistClientDocumentFile(params: {
  clientId: string;
  fileName: string;
  fileBytes: Uint8Array;
  mimeType?: string | null;
}) {
  const buffer = Buffer.from(params.fileBytes);

  if (!buffer.byteLength) {
    throw new Error("O arquivo enviado esta vazio.");
  }

  if (buffer.byteLength > MAX_CLIENT_DOCUMENT_SIZE_BYTES) {
    throw new Error("O arquivo ultrapassa o limite de 10 MB.");
  }

  const normalizedFileName = normalizeOriginalFileName(params.fileName);
  const resolvedDocumentType = resolveDocumentMimeType({
    fileName: normalizedFileName,
    mimeType: params.mimeType,
  });

  const relativePath = path.posix.join(
    CLIENT_DOCUMENT_DIRECTORY,
    params.clientId,
    `${randomUUID()}.${resolvedDocumentType.extension}`,
  );
  const absolutePath = buildAbsolutePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    fileName: normalizedFileName,
    mimeType: resolvedDocumentType.mimeType,
    storageProvider: "LOCAL" as StorageProvider,
    storagePath: relativePath,
    sizeBytes: buffer.byteLength,
  };
}

export async function readClientDocumentFile(params: {
  storageProvider: StorageProvider;
  storagePath: string;
}) {
  if (params.storageProvider !== "LOCAL") {
    throw new Error("STORAGE_PROVIDER_NOT_IMPLEMENTED");
  }

  return readFile(buildAbsolutePath(params.storagePath));
}

export async function deleteStoredClientDocument(params?: {
  storageProvider: StorageProvider;
  storagePath: string;
} | null) {
  if (!params?.storagePath) {
    return;
  }

  if (params.storageProvider !== "LOCAL") {
    throw new Error("STORAGE_PROVIDER_NOT_IMPLEMENTED");
  }

  await unlink(buildAbsolutePath(params.storagePath)).catch(() => {});
}
