/**
 * Hash a file using SHA-256 in the browser.
 * The file never leaves the device — only the hash is used.
 */
export async function hashFile(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  if (onProgress) onProgress(50);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  if (onProgress) onProgress(100);
  return new Uint8Array(hashBuffer);
}

/** Convert a Uint8Array to a hex string */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Convert a hex string to a Uint8Array */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/** Format file size in human-readable form */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
