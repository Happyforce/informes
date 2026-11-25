// Browser-side upload: ask the server for a signed URL, then PUT the file
// straight to Supabase Storage with progress. The file never goes through
// our server actions (Vercel caps request bodies at 4.5 MB).

import { prepareUploadAction } from "@/app/admin/actions";
import { fileTypeFor } from "@/lib/report-files";

export async function uploadToStaging(
  file: File,
  onProgress: (fraction: number) => void
): Promise<string> {
  const type = fileTypeFor(file.name);
  if (!type) throw new Error("Tipo de fichero no admitido.");

  const prepared = await prepareUploadAction(file.name);
  if ("error" in prepared) throw new Error(prepared.error);

  await putFile(prepared.uploadUrl, file, type.contentType, onProgress);
  onProgress(1);
  return prepared.stagedPath;
}

/**
 * PUT a file to a Supabase signed upload URL with progress. `metadata` is
 * stored with the object (read back by the MCP check_upload tool).
 */
export function putFile(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  metadata?: Record<string, unknown>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.setRequestHeader("x-upsert", "true");
    if (metadata) {
      const bytes = new TextEncoder().encode(JSON.stringify(metadata));
      xhr.setRequestHeader("x-metadata", btoa(String.fromCharCode(...bytes)));
    }
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detail = xhr.responseText;
      try {
        detail = JSON.parse(xhr.responseText).message ?? detail;
      } catch {}
      reject(
        new Error(
          xhr.status === 413 || /exceeded the maximum allowed size/i.test(detail)
            ? "El fichero supera el tamaño máximo permitido (50 MB). Comprímelo (p. ej. vídeo a 1080p) y vuelve a intentarlo."
            : `La subida falló (${xhr.status}): ${detail}`
        )
      );
    };
    xhr.onerror = () => reject(new Error("La subida falló por un error de red."));
    xhr.send(file);
  });
}
