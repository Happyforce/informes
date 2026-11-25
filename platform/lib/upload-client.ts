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

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", prepared.uploadUrl);
    xhr.setRequestHeader("Content-Type", type.contentType);
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
            ? "El fichero supera el tamaño máximo permitido por el almacenamiento. Comprímelo (p. ej. vídeo a 1080p) y vuelve a intentarlo."
            : `La subida falló (${xhr.status}): ${detail}`
        )
      );
    };
    xhr.onerror = () => reject(new Error("La subida falló por un error de red."));
    xhr.send(file);
  });

  onProgress(1);
  return prepared.stagedPath;
}
