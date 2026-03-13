import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageRoot } from "@/lib/storage/root";

const TEMPLATE_SOURCE_DIRECTORY = "template-sources";
const MAX_TEMPLATE_SOURCE_SIZE_BYTES = 15 * 1024 * 1024;
const DOCX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
  "",
]);

function buildAbsolutePath(relativePath: string) {
  return path.join(getStorageRoot(), relativePath);
}

function assertDocxFileName(fileName: string) {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    throw new Error("Envie um arquivo .docx para usar no ONLYOFFICE.");
  }
}

function assertDocxMimeType(mimeType?: string | null) {
  if (!DOCX_MIME_TYPES.has((mimeType ?? "").trim())) {
    throw new Error("O arquivo precisa estar no formato DOCX.");
  }
}

export async function persistTemplateSourceFile(params: {
  templateId: string;
  fileName: string;
  fileBytes: Uint8Array;
  mimeType?: string | null;
  previousStoragePath?: string | null;
}) {
  assertDocxFileName(params.fileName);
  assertDocxMimeType(params.mimeType);

  const buffer = Buffer.from(params.fileBytes);

  if (!buffer.byteLength) {
    throw new Error("O arquivo DOCX enviado esta vazio.");
  }

  if (buffer.byteLength > MAX_TEMPLATE_SOURCE_SIZE_BYTES) {
    throw new Error("O arquivo DOCX ultrapassa o limite de 15 MB.");
  }

  const relativePath = path.posix.join(
    TEMPLATE_SOURCE_DIRECTORY,
    `${params.templateId}.docx`,
  );
  const absolutePath = buildAbsolutePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  if (params.previousStoragePath && params.previousStoragePath !== relativePath) {
    await unlink(buildAbsolutePath(params.previousStoragePath)).catch(() => {});
  }

  return {
    fileName: params.fileName,
    mimeType:
      params.mimeType?.trim() ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    storagePath: relativePath,
    sizeBytes: buffer.byteLength,
  };
}

export async function readTemplateSourceFile(storagePath: string) {
  return readFile(buildAbsolutePath(storagePath));
}

export async function deleteTemplateSourceFile(storagePath?: string | null) {
  if (!storagePath) {
    return;
  }

  await unlink(buildAbsolutePath(storagePath)).catch(() => {});
}
