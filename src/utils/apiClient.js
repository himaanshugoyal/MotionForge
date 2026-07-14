/**
 * Frontend client for the MotionForge render / ingest API.
 * Uses Vite proxy (/api → localhost:8787).
 */

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function checkApiHealth() {
  const res = await fetch('/api/health');
  return parseJson(res);
}

export async function createProjectOnServer({ html, project, assets }) {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, project, assets })
  });
  return parseJson(res);
}

/**
 * Start a HyperFrames producer render. Returns job record; poll until completed.
 */
export async function startHyperFramesRender({ html, project, assets, quality = 'high', fps = 30, jobId }) {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, project, assets, quality, fps, jobId })
  });
  return parseJson(res);
}

export async function getRenderStatus(jobId) {
  const res = await fetch(`/api/render/${jobId}`);
  return parseJson(res);
}

export async function pollRenderUntilDone(jobId, { onProgress, intervalMs = 1200, timeoutMs = 15 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getRenderStatus(jobId);
    if (onProgress) onProgress(job);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(job.error || 'Render failed');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Render timed out');
}

export function downloadRender(jobId, filename = 'motionforge-render.mp4') {
  const a = document.createElement('a');
  a.href = `/api/render/${jobId}/download`;
  a.download = filename;
  a.click();
}

export async function ingestUrl(url) {
  const res = await fetch('/api/ingest/url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
  return parseJson(res);
}

export async function ingestUpload(file, { typeHint = 'image', title, notes } = {}) {
  const form = new FormData();
  form.append('file', file);
  form.append('typeHint', typeHint);
  if (title) form.append('title', title);
  if (notes) form.append('notes', notes);
  const res = await fetch('/api/ingest/upload', {
    method: 'POST',
    body: form
  });
  return parseJson(res);
}

export async function transcribeAudio({ audioBase64, audioMimeType = 'audio/wav', language = '', prompt = '', apiKey = '' }) {
  const res = await fetch('/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, audioMimeType, language, prompt, apiKey })
  });
  return parseJson(res);
}
