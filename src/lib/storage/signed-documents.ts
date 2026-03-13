import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { getStorageRoot } from "@/lib/storage/root";

const SIGNED_DOCUMENT_DIRECTORY = "signed-documents";

export async function persistSignedContractPdf(params: {
  signatureRequestId: string;
  pdfBytes: Uint8Array;
}) {
  const relativePath = path.posix.join(
    SIGNED_DOCUMENT_DIRECTORY,
    `${params.signatureRequestId}.pdf`,
  );
  const absolutePath = path.join(getStorageRoot(), relativePath);
  const buffer = Buffer.from(params.pdfBytes);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    fileName: `${params.signatureRequestId}.pdf`,
    storagePath: relativePath,
    sizeBytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function readSignedContractPdf(storagePath: string) {
  return readFile(path.join(getStorageRoot(), storagePath));
}

export async function deleteSignedContractPdf(storagePath?: string | null) {
  if (!storagePath) {
    return;
  }

  await unlink(path.join(getStorageRoot(), storagePath)).catch(() => {});
}
