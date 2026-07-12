import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Persist an uploaded file and return a content-brief-friendly asset descriptor.
 */
export async function saveUpload(file, { typeHint = 'image' } = {}) {
  await ensureDir(UPLOADS_ROOT);
  const id = randomUUID();
  const ext = path.extname(file.originalname || '') || guessExt(file.mimetype);
  const filename = `${id}${ext}`;
  const absPath = path.join(UPLOADS_ROOT, filename);
  await fs.writeFile(absPath, file.buffer);

  const mime = file.mimetype || 'application/octet-stream';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || ext.toLowerCase() === '.pdf';

  return {
    id,
    type: isPdf ? 'document' : isImage ? (typeHint === 'screenshot' ? 'screenshot' : 'image') : 'file',
    filename: file.originalname || filename,
    storedName: filename,
    mimeType: mime,
    size: file.size,
    path: absPath,
    publicUrl: `/api/assets/${filename}`,
    createdAt: new Date().toISOString()
  };
}

function guessExt(mime = '') {
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('pdf')) return '.pdf';
  return '.bin';
}

export async function buildImageBrief(asset, { title, notes } = {}) {
  return {
    title: title || asset.filename.replace(/\.[^.]+$/, '') || 'Uploaded visual',
    bullets: [
      'Visual source provided as screenshot/image',
      notes || 'Animate with ken-burns and kinetic title overlays'
    ].filter(Boolean),
    sections: [
      {
        heading: 'Visual Story',
        points: [
          'Open on the uploaded visual',
          'Highlight key UI or product zones',
          'Close with a clear CTA'
        ]
      }
    ],
    assets: [
      {
        type: asset.type,
        path: asset.publicUrl,
        filename: asset.storedName,
        mimeType: asset.mimeType
      }
    ],
    brand: {
      colors: ['#0a0a0f', '#67e8f9', '#ffffff'],
      fonts: ['Outfit', 'Inter']
    },
    sourceType: 'screenshot'
  };
}
