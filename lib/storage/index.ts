export interface StorageFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
}

export const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateUploadFile(file: { mimeType: string; size: number }) {
  if (!ALLOWED_DOC_TYPES.includes(file.mimeType as any)) {
    throw new Error(`Unsupported file type: ${file.mimeType}. Allowed formats: JPG, PNG, WEBP, PDF.`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size ${(file.size / (1024 * 1024)).toFixed(2)} MB exceeds 5 MB limit.`);
  }
  return true;
}

export interface StorageProvider {
  saveFile(companyId: string, folder: string, fileName: string, buffer: Buffer): Promise<{ fileKey: string; publicUrl?: string }>;
  getFile(fileKey: string): Promise<Buffer>;
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export class LocalPrivateStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = "./storage/private") {
    this.baseDir = baseDir;
  }

  async saveFile(companyId: string, folder: string, fileName: string, buffer: Buffer) {
    const targetDir = join(this.baseDir, companyId, folder);
    await mkdir(targetDir, { recursive: true });
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = join(targetDir, safeName);
    await writeFile(filePath, buffer);
    const fileKey = `${companyId}/${folder}/${safeName}`;
    return { fileKey };
  }

  async getFile(fileKey: string) {
    const filePath = join(this.baseDir, fileKey);
    return readFile(filePath);
  }
}
