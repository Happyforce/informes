"use server";

import { requireAdmin } from "@/lib/auth";
import { ReportError, findStagedUpload, signUploadFor, type StagedUpload } from "@/lib/reports";

/** Signed URL for the /subir page (admin session required). */
export async function signUploadPageAction(
  uploadId: string,
  fileName: string
): Promise<StagedUpload | { error: string }> {
  try {
    await requireAdmin();
    return await signUploadFor(uploadId, fileName);
  } catch (e) {
    return {
      error: e instanceof ReportError ? e.message : "No se pudo preparar la subida.",
    };
  }
}

export async function uploadStatusAction(uploadId: string) {
  await requireAdmin();
  const f = await findStagedUpload(uploadId);
  return f ? { fileName: f.stagedPath.split("/").pop(), sizeBytes: f.sizeBytes } : null;
}
