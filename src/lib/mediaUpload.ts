/**
 * Upload direct vers Cloudflare R2 via l'URL pré-signée fournie par le serveur.
 * Aucun secret R2 n'est exposé au navigateur.
 */
export interface UploadedMedia {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  kind: 'image' | 'video' | 'audio';
  status: 'uploaded';
  publicUrl: string | null;
}

interface PresignResponse {
  media: {
    id: string;
    key: string;
    uploadUrl: string;
    publicUrl: string | null;
    expiresIn: number;
    contentType: string;
    size: number;
  };
}

export async function uploadMedia(file: File, folder?: string): Promise<UploadedMedia> {
  const presignResponse = await fetch('/api/media/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      size: file.size,
      folder,
    }),
  });

  if (!presignResponse.ok) {
    const body = await presignResponse.json().catch(() => ({}));
    throw new Error(body.error || 'Impossible de préparer l’upload.');
  }

  const { media } = (await presignResponse.json()) as PresignResponse;
  const uploadResponse = await fetch(media.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadResponse.ok) {
    await fetch(`/api/media/${media.id}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => undefined);
    throw new Error(`Échec de l’upload (${uploadResponse.status}).`);
  }

  const completeResponse = await fetch(`/api/media/${media.id}/complete`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!completeResponse.ok) {
    throw new Error('Le fichier a été envoyé mais n’a pas pu être finalisé.');
  }

  const result = (await completeResponse.json()) as { media: UploadedMedia };
  return result.media;
}
