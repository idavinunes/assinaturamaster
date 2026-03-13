import path from "node:path";

const DEFAULT_STORAGE_ROOT_DIR = "./storage";

export function getStorageRoot() {
  const configuredStorageRoot = process.env.STORAGE_ROOT_DIR?.trim();
  const storageRootDir = configuredStorageRoot || DEFAULT_STORAGE_ROOT_DIR;

  return path.resolve(process.cwd(), storageRootDir);
}
