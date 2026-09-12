import * as FileSystem from "expo-file-system/legacy";
import type { ContextItemType } from "@/types/contextItem";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".heic", ".heif", ".svg", ".bmp"];
const AUDIO_EXTS = [".m4a", ".mp3", ".wav", ".aac", ".caf", ".ogg", ".webm"];
const DOCUMENT_EXTS = [".pdf", ".doc", ".docx", ".txt", ".md", ".rtf", ".csv", ".xlsx", ".xls", ".ppt", ".pptx"];

function extensionOf(filename?: string): string {
  if (!filename) return "";
  const cleaned = filename.split("?")[0].split("#")[0];
  const idx = cleaned.lastIndexOf(".");
  return idx >= 0 ? cleaned.slice(idx).toLowerCase() : "";
}

/**
 * Infer vault item type from the file itself, never from which picker button was tapped.
 * SVG is classified as image (it is visually an image) even though the bytes are XML.
 */
export function inferContextItemType(mimeType?: string, filename?: string): ContextItemType {
  const mime = (mimeType || "").toLowerCase().trim();
  const ext = extensionOf(filename);

  if (mime.startsWith("image/") || IMAGE_EXTS.includes(ext)) {
    return "image";
  }
  if (mime.startsWith("audio/") || AUDIO_EXTS.includes(ext)) {
    return "audio";
  }
  if (
    mime === "application/pdf" ||
    mime.includes("msword") ||
    mime.includes("officedocument") ||
    mime.includes("text/") ||
    mime.includes("markdown") ||
    DOCUMENT_EXTS.includes(ext)
  ) {
    return "document";
  }

  return "document";
}

export type DocumentFormat = "pdf" | "docx" | "txt" | "md" | "other";

export function inferDocumentFormat(mimeType?: string, filename?: string): DocumentFormat {
  const mime = (mimeType || "").toLowerCase();
  const ext = extensionOf(filename);
  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (mime.includes("word") || ext === ".doc" || ext === ".docx") return "docx";
  if (ext === ".md" || mime.includes("markdown")) return "md";
  if (mime.startsWith("text/") || ext === ".txt" || ext === ".csv" || ext === ".rtf") return "txt";
  return "other";
}

export function isAppOwnedUri(uri?: string | null): boolean {
  if (!uri) return false;
  const doc = FileSystem.documentDirectory;
  const cache = FileSystem.cacheDirectory;
  if (doc && uri.startsWith(doc)) return true;
  if (cache && uri.startsWith(cache)) return true;
  if (uri.includes("/stride-vault/")) return true;
  return false;
}

function safeFileName(name: string): string {
  const trimmed = name.trim() || `file_${Date.now()}`;
  const lastDot = trimmed.lastIndexOf(".");
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const ext = lastDot > 0 ? trimmed.slice(lastDot) : "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return `${cleaned || "file"}${ext}`;
}

/**
 * Copy a picked file into Stride's document directory when the source is readable.
 * Returns the original URI if the copy cannot be performed.
 */
export async function copyIntoVaultStorage(uri: string, filename: string): Promise<string> {
  const doc = FileSystem.documentDirectory;
  if (!doc || !uri) return uri;

  try {
    const dir = `${doc}stride-vault`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const dest = `${dir}/${Date.now()}_${safeFileName(filename)}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.warn("[Vault] Could not copy file into app storage", err);
    return uri;
  }
}

export async function renameOwnedFile(uri: string, newTitle: string): Promise<string | null> {
  if (!isAppOwnedUri(uri)) return null;
  try {
    const slash = uri.lastIndexOf("/");
    if (slash < 0) return null;
    const dir = uri.slice(0, slash + 1);
    const currentName = decodeURIComponent(uri.slice(slash + 1));
    const currentExt = extensionOf(currentName);
    const nextBase = newTitle.replace(/[/\\?%*:|"<>]/g, "_").trim() || "renamed";
    const hasExt = extensionOf(nextBase);
    const nextName = hasExt ? nextBase : `${nextBase}${currentExt}`;
    const dest = `${dir}${nextName}`;
    if (dest === uri) return uri;
    await FileSystem.moveAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.warn("[Vault] File rename failed", err);
    return null;
  }
}

export async function deleteOwnedFile(uri?: string): Promise<boolean> {
  if (!uri || !isAppOwnedUri(uri)) return false;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch (err) {
    console.warn("[Vault] File delete failed", err);
    return false;
  }
}

const MAX_IMAGE_EDGE = 1280;
const JPEG_COMPRESS = 0.7;

export type PreparedImagePayload = {
  imageBase64: string;
  mimeType: string;
};

/**
 * Resize/compress when possible, then read bytes as base64 for the Edge Function.
 * SVG and other formats the manipulator cannot handle fall back to a raw base64 read.
 */
export async function prepareImageForAi(
  uri: string,
  mimeType?: string
): Promise<PreparedImagePayload> {
  const originalMime = (mimeType || "image/jpeg").toLowerCase();

  try {
    const ImageManipulator = await import("expo-image-manipulator");
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_EDGE } }],
      {
        compress: JPEG_COMPRESS,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );
    if (result.base64) {
      return { imageBase64: result.base64, mimeType: "image/jpeg" };
    }
  } catch (err) {
    console.warn("[Vault] Image resize skipped, reading original bytes", err);
  }

  const encoding =
    (FileSystem as { EncodingType?: { Base64: string } }).EncodingType?.Base64 ?? "base64";
  const imageBase64 = await FileSystem.readAsStringAsync(uri, { encoding: encoding as "base64" });
  if (!imageBase64) {
    throw new Error("Could not read image bytes");
  }
  return { imageBase64, mimeType: originalMime || "image/jpeg" };
}
