/** Uploading and downloading files (receipts, imports). Requests carry the same bearer token and organization header as the JSON client. */
import { ApiError } from "./api";
import { API_BASE_URL } from "./supabase-auth";

async function failure(res: Response): Promise<ApiError> {
  let body: { error?: { code?: string; message?: string } } | null = null;
  try { body = await res.json(); } catch { /* not JSON */ }
  return new ApiError(body?.error?.code ?? "error", body?.error?.message ?? "Something went wrong.", res.status);
}

export async function uploadFile<T>(token: string, path: string, file: File, org: string): Promise<T> {
  const form = new FormData();
  form.append("file", file, file.name);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": org }, body: form, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new ApiError("unreachable", "Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

export async function fetchBlob(token: string, path: string, org: string): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": org } });
  if (!res.ok) throw await failure(res);
  return res.blob();
}

/** Phone photos are often 4-8 MB: shrink them in the browser (longest side 1600 px, JPEG) so uploads are quick and under the limit. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < 600_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const prettySize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
