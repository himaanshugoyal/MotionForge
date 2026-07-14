import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  createProjectWorkspace,
  startRender,
  getJob,
  sanitizeJob,
  renderHelloWorld,
  JOBS_ROOT
} from './render/job.js';
import { captureWebsite } from './ingest/url.js';
import { saveUpload, buildImageBrief, UPLOADS_ROOT } from './ingest/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES_ROOT = path.resolve(__dirname, 'captures');
const PORT = Number(process.env.PORT || 8787);

process.env.PUPPETEER_EXECUTABLE_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 }
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'motionforge-render',
    node: process.version,
    chrome: process.env.PUPPETEER_EXECUTABLE_PATH
  });
});

/** Hello-world toolchain check */
app.post('/api/render/hello', async (_req, res) => {
  try {
    const job = await renderHelloWorld();
    res.status(202).json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Create a project workspace from HTML (+ optional base64 assets / project JSON)
 * Body: { html, project?, assets?: [{ filename, data, encoding? }] }
 */
app.post('/api/projects', async (req, res) => {
  try {
    const { html, project, assets } = req.body || {};
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ error: 'html string is required' });
    }
    const workspace = await createProjectWorkspace({ html, project, assets });
    res.status(201).json(sanitizeJob(workspace));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Start HyperFrames producer render for an existing job, or create+render in one shot.
 * Body: { jobId? } OR { html, project?, assets?, quality?, fps? }
 */
app.post('/api/render', async (req, res) => {
  try {
    const { jobId, html, project, assets, quality = 'high', fps = 30 } = req.body || {};
    let id = jobId;

    if (!id) {
      if (!html) return res.status(400).json({ error: 'Provide jobId or html' });
      const workspace = await createProjectWorkspace({ html, project, assets });
      id = workspace.id;
    }

    const job = await startRender(id, { quality, fps });
    res.status(202).json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/render/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(sanitizeJob(job));
});

app.get('/api/render/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'completed') {
    return res.status(409).json({ error: `Job status is ${job.status}`, job: sanitizeJob(job) });
  }
  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'Output file missing' });
  }
  res.download(job.outputPath, `motionforge-${job.id}.mp4`);
});

/** Website capture → content brief + screenshot assets */
app.post('/api/ingest/url', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    const result = await captureWebsite(url);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/** Image / screenshot / PDF upload */
app.post('/api/ingest/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    const typeHint = req.body?.typeHint || 'image';
    const asset = await saveUpload(req.file, { typeHint });
    const brief = asset.type === 'document'
      ? {
          title: asset.filename,
          bullets: ['Document uploaded — extract text on client and generate scenes'],
          sections: [],
          assets: [{ type: 'document', path: asset.publicUrl, filename: asset.storedName, mimeType: asset.mimeType }],
          brand: { colors: ['#0a0a0f', '#67e8f9', '#ffffff'], fonts: ['Outfit'] },
          sourceType: 'document'
        }
      : await buildImageBrief(asset, { title: req.body?.title, notes: req.body?.notes });
    res.status(201).json({ asset, brief });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Transcribe audio (word timestamps) using OpenAI Whisper.
 * Body: { audioBase64, audioMimeType?, language?, prompt?, apiKey? }
 */
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, audioMimeType = 'audio/wav', language, prompt, apiKey } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 is required' });
    }

    const resolvedKey = apiKey || process.env.OPENAI_API_KEY;
    if (!resolvedKey) {
      return res.status(400).json({
        error: 'OpenAI API key missing. Provide apiKey in request or set OPENAI_API_KEY on server.'
      });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const fileBlob = new Blob([audioBuffer], { type: audioMimeType || 'audio/wav' });
    const form = new FormData();
    form.append('model', 'whisper-1');
    form.append('file', fileBlob, `audio.${(audioMimeType || 'audio/wav').split('/')[1] || 'wav'}`);
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('timestamp_granularities[]', 'segment');
    if (language && typeof language === 'string') {
      form.append('language', language);
    }
    if (prompt && typeof prompt === 'string') {
      form.append('prompt', prompt);
    }

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resolvedKey}`
      },
      body: form
    });

    const raw = await whisperRes.json().catch(() => ({}));
    if (!whisperRes.ok) {
      return res.status(whisperRes.status).json({
        error: raw?.error?.message || `Transcription failed (${whisperRes.status})`
      });
    }

    const words = normalizeWords(raw.words, raw.segments);
    const segments = normalizeSegments(raw.segments);
    const text = typeof raw.text === 'string' ? raw.text.trim() : words.map((w) => w.text).join(' ').trim();

    res.json({ text, words, segments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Transcription failed' });
  }
});

app.use('/api/assets', express.static(UPLOADS_ROOT));
app.use('/api/captures', express.static(CAPTURES_ROOT));
app.use('/api/jobs', express.static(JOBS_ROOT));

app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`MotionForge render API on http://localhost:${PORT}`);
});

function normalizeWords(rawWords = [], rawSegments = []) {
  const cleaned = Array.isArray(rawWords)
    ? rawWords
        .map((w) => ({
          text: String(w.word || '').trim(),
          start: Number(w.start),
          end: Number(w.end)
        }))
        .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end) && w.end > w.start)
    : [];

  if (cleaned.length > 0) {
    return cleaned;
  }

  // Fallback: synthesize words from segment timings when word timestamps are absent.
  const synthesized = [];
  for (const segment of Array.isArray(rawSegments) ? rawSegments : []) {
    const segStart = Number(segment.start);
    const segEnd = Number(segment.end);
    const segText = String(segment.text || '').trim();
    if (!segText || !Number.isFinite(segStart) || !Number.isFinite(segEnd) || segEnd <= segStart) continue;

    const parts = segText.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const step = (segEnd - segStart) / parts.length;
    parts.forEach((part, idx) => {
      synthesized.push({
        text: part,
        start: segStart + idx * step,
        end: segStart + (idx + 1) * step
      });
    });
  }

  return synthesized;
}

function normalizeSegments(rawSegments = []) {
  if (!Array.isArray(rawSegments)) return [];
  return rawSegments
    .map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      text: String(s.text || '').trim()
    }))
    .filter((s) => s.text && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
}
