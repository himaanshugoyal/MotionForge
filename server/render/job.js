import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createRenderJob, executeRenderJob } from '@hyperframes/producer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const JOBS_ROOT = path.resolve(__dirname, '..', 'jobs');

const jobs = new Map();

export function getJob(id) {
  return jobs.get(id) || null;
}

export function listJobs() {
  return Array.from(jobs.values()).map(({ abortController, ...rest }) => rest);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Create a job workspace and write composition HTML (+ optional assets).
 */
export async function createProjectWorkspace({ html, assets = [], project = null }) {
  const id = randomUUID();
  const dir = path.join(JOBS_ROOT, id);
  const assetsDir = path.join(dir, 'assets');
  const vendorDir = path.join(dir, 'vendor');
  await ensureDir(assetsDir);
  await ensureDir(vendorDir);

  // Bundle GSAP locally — CDN fetch often fails behind SSL/firewall during compile
  const gsapSrc = path.resolve(__dirname, '..', 'templates', 'vendor', 'gsap.min.js');
  try {
    await fs.copyFile(gsapSrc, path.join(vendorDir, 'gsap.min.js'));
  } catch (err) {
    console.warn('[render] could not copy local GSAP:', err.message);
  }

  const localizedHtml = String(html || '')
    .replace(/https?:\/\/[^"'/]+\/gsap\.min\.js/g, './vendor/gsap.min.js')
    .replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/[^"']+\/gsap\.min\.js/g, './vendor/gsap.min.js')
    .replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/gsap[^"']*\/gsap\.min\.js/g, './vendor/gsap.min.js')
    .replace(/src=["']\/gsap\.min\.js["']/g, 'src="./vendor/gsap.min.js"');

  if (!localizedHtml.trim()) {
    throw new Error('html must be a non-empty string');
  }

  const htmlPath = path.join(dir, 'index.html');
  await fs.writeFile(htmlPath, localizedHtml, 'utf8');

  if (project) {
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(project, null, 2), 'utf8');
  }

  for (const asset of assets) {
    if (!asset?.filename || !asset?.data) continue;
    const safeName = path.basename(asset.filename).replace(/[^\w.\-]+/g, '_');
    const dest = path.join(assetsDir, safeName);
    const buffer = Buffer.isBuffer(asset.data)
      ? asset.data
      : Buffer.from(asset.data, asset.encoding === 'base64' ? 'base64' : 'utf8');
    await fs.writeFile(dest, buffer);
  }

  const record = {
    id,
    status: 'ready',
    createdAt: new Date().toISOString(),
    dir,
    htmlPath,
    outputPath: path.join(dir, 'output.mp4'),
    progress: 0,
    error: null,
    downloadUrl: null
  };
  jobs.set(id, record);
  return record;
}

/**
 * Render a workspace with @hyperframes/producer.
 */
export async function startRender(jobId, { quality = 'high', fps = 30 } = {}) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status === 'rendering') throw new Error('Job is already rendering');

  job.status = 'rendering';
  job.progress = 0;
  job.error = null;
  job.startedAt = new Date().toISOString();

  const abortController = new AbortController();
  job.abortController = abortController;

  const renderJob = createRenderJob({
    fps,
    quality,
    format: 'mp4',
    workers: 1,
    hdrMode: 'force-sdr'
  });

  // Fire-and-forget; callers poll GET /api/render/:id
  (async () => {
    try {
      await executeRenderJob(
        renderJob,
        job.dir,
        job.outputPath,
        (renderJobState, message) => {
          // ProgressCallback signature: (job, message) — progress is 0..1 on the job
          const pct = Number(renderJobState?.progress);
          if (Number.isFinite(pct)) {
            job.progress = Math.max(0, Math.min(100, Math.round((pct <= 1 ? pct * 100 : pct))));
          } else if (typeof message === 'string' && /(\d+)%/.test(message)) {
            job.progress = Number(message.match(/(\d+)%/)[1]);
          }
          if (message) job.statusMessage = message;
        },
        abortController.signal
      );
      job.status = 'completed';
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.downloadUrl = `/api/render/${job.id}/download`;
    } catch (err) {
      job.status = 'failed';
      job.error = err?.message || String(err);
      console.error(`[render] job ${job.id} failed:`, err);
    } finally {
      delete job.abortController;
    }
  })();

  return sanitizeJob(job);
}

export function sanitizeJob(job) {
  if (!job) return null;
  const { abortController, ...rest } = job;
  return rest;
}

/**
 * Quick hello-world render used to verify the toolchain.
 */
export async function renderHelloWorld() {
  const templatePath = path.resolve(__dirname, '..', 'templates', 'hello.html');
  const html = await fs.readFile(templatePath, 'utf8');
  const workspace = await createProjectWorkspace({ html });
  // Copy hello template vendor already handled; ensure gsap present
  return startRender(workspace.id, { quality: 'draft', fps: 30 });
}
