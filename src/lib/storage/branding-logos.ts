import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getStorageRoot } from "@/lib/storage/root";

const BRANDING_LOGO_DIRECTORY = "branding-logos";
const BRANDING_LOGO_ROUTE_PREFIX = "/api/branding/logo";
const MAX_BRANDING_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TYPE_TO_EXTENSION = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"],
]);

const EXTENSION_TO_MIME_TYPE = new Map<string, string>([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
]);

function buildAbsolutePath(relativePath: string) {
  return path.join(getStorageRoot(), relativePath);
}

function normalizeOriginalFileName(fileName: string) {
  const trimmedFileName = fileName.trim();

  if (!trimmedFileName) {
    return "logo";
  }

  return path.basename(trimmedFileName);
}

function resolveBrandingLogoFile(params: {
  fileName: string;
  mimeType?: string | null;
}) {
  const normalizedMimeType = (params.mimeType ?? "").trim().toLowerCase();
  const fileExtension = path.extname(params.fileName).trim().toLowerCase();

  if (normalizedMimeType) {
    const extensionFromMimeType = MIME_TYPE_TO_EXTENSION.get(normalizedMimeType);

    if (!extensionFromMimeType) {
      throw new Error("Envie a logo em SVG, PNG, JPG ou WEBP.");
    }

    return {
      mimeType: normalizedMimeType,
      extension: extensionFromMimeType,
    };
  }

  const mimeTypeFromExtension = EXTENSION_TO_MIME_TYPE.get(fileExtension);

  if (!mimeTypeFromExtension) {
    throw new Error("Envie a logo em SVG, PNG, JPG ou WEBP.");
  }

  return {
    mimeType: mimeTypeFromExtension,
    extension: fileExtension === ".jpeg" ? "jpg" : fileExtension.slice(1),
  };
}

function parseStoredLogoPathFromUrl(logoPath?: string | null) {
  if (!logoPath) {
    return null;
  }

  try {
    const parsedUrl = new URL(logoPath, "http://localhost");

    if (!parsedUrl.pathname.startsWith(`${BRANDING_LOGO_ROUTE_PREFIX}/`)) {
      return null;
    }

    const encodedPath = parsedUrl.pathname.slice(`${BRANDING_LOGO_ROUTE_PREFIX}/`.length);

    if (!encodedPath) {
      return null;
    }

    const segments = encodedPath.split("/").map((segment) => decodeURIComponent(segment));

    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      return null;
    }

    return segments.join("/");
  } catch {
    return null;
  }
}

export function buildBrandingLogoPublicPath(storagePath: string) {
  const encodedPath = storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${BRANDING_LOGO_ROUTE_PREFIX}/${encodedPath}`;
}

export function extractStoredBrandingLogoPath(logoPath?: string | null) {
  return parseStoredLogoPathFromUrl(logoPath);
}

export function getBrandingLogoMimeType(storagePath: string) {
  const extension = path.extname(storagePath).toLowerCase();
  return EXTENSION_TO_MIME_TYPE.get(extension) ?? "application/octet-stream";
}

export async function persistBrandingLogoFile(params: {
  scope: "global" | "team";
  teamId?: string;
  fileName: string;
  fileBytes: Uint8Array;
  mimeType?: string | null;
  previousLogoPath?: string | null;
}) {
  const buffer = Buffer.from(params.fileBytes);

  if (!buffer.byteLength) {
    throw new Error("O arquivo de logo enviado esta vazio.");
  }

  if (buffer.byteLength > MAX_BRANDING_LOGO_SIZE_BYTES) {
    throw new Error("A logo ultrapassa o limite de 5 MB.");
  }

  const normalizedFileName = normalizeOriginalFileName(params.fileName);
  const resolvedLogoFile = resolveBrandingLogoFile({
    fileName: normalizedFileName,
    mimeType: params.mimeType,
  });

  const ownerDirectory =
    params.scope === "global"
      ? "global"
      : params.teamId
        ? path.posix.join("team", params.teamId)
        : "team";
  const relativePath = path.posix.join(
    BRANDING_LOGO_DIRECTORY,
    ownerDirectory,
    `${randomUUID()}.${resolvedLogoFile.extension}`,
  );
  const absolutePath = buildAbsolutePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  const previousStoragePath = parseStoredLogoPathFromUrl(params.previousLogoPath);

  if (previousStoragePath && previousStoragePath !== relativePath) {
    await unlink(buildAbsolutePath(previousStoragePath)).catch(() => {});
  }

  return {
    logoPath: buildBrandingLogoPublicPath(relativePath),
    storagePath: relativePath,
    mimeType: resolvedLogoFile.mimeType,
  };
}

export async function readStoredBrandingLogo(storagePath: string) {
  return readFile(buildAbsolutePath(storagePath));
}

export async function deleteStoredBrandingLogo(logoPath?: string | null) {
  const storagePath = parseStoredLogoPathFromUrl(logoPath);

  if (!storagePath) {
    return;
  }

  await unlink(buildAbsolutePath(storagePath)).catch(() => {});
}
