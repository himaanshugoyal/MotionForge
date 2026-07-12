import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES_ROOT = path.resolve(__dirname, '..', 'captures');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function runCommand(command, args, { cwd, env, timeoutMs = 180000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: process.platform === 'win32',
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `Exit code ${code}`));
    });
  });
}

/**
 * Try HyperFrames CLI capture; fall back to Chrome CDP screenshot + HTML fetch.
 */
export async function captureWebsite(rawUrl) {
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  await ensureDir(CAPTURES_ROOT);
  const id = randomUUID();
  const outDir = path.join(CAPTURES_ROOT, id);
  await ensureDir(outDir);

  let captureMethod = 'hyperframes';
  try {
    await runCommand('npx', ['hyperframes', 'capture', targetUrl, '-o', outDir, '--max-screenshots', '8'], {
      cwd: path.resolve(__dirname, '..', '..'),
      env: {
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH ||
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      },
      timeoutMs: 240000
    });
  } catch (err) {
    console.warn('[ingest/url] hyperframes capture failed, using Chrome fallback:', err.message);
    captureMethod = 'chrome-fallback';
    await chromeFallbackCapture(targetUrl, outDir);
  }

  const brief = await buildBriefFromCaptureDir(outDir, targetUrl, captureMethod);
  return { id, outDir, brief, captureMethod };
}

async function chromeFallbackCapture(targetUrl, outDir) {
  const puppeteer = await import('puppeteer-core');
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    const meta = await page.evaluate(() => {
      const getMeta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((h) => h.textContent.trim())
        .filter(Boolean)
        .slice(0, 12);
      const paragraphs = Array.from(document.querySelectorAll('p'))
        .map((p) => p.textContent.trim())
        .filter((t) => t.length > 40)
        .slice(0, 8);
      const colors = Array.from(document.querySelectorAll('body, header, a, button'))
        .slice(0, 40)
        .map((el) => getComputedStyle(el).color)
        .filter(Boolean);
      return {
        title: document.title || 'Untitled',
        description: getMeta('meta[name="description"]') || getMeta('meta[property="og:description"]'),
        headings,
        paragraphs,
        colors
      };
    });

    const shotPath = path.join(outDir, 'viewport-0.png');
    await page.screenshot({ path: shotPath, fullPage: false });

    // Additional scroll depths
    const height = await page.evaluate(() => document.body.scrollHeight);
    const steps = Math.min(4, Math.max(1, Math.ceil(height / 900)));
    for (let i = 1; i < steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), i * 900);
      await new Promise((r) => setTimeout(r, 400));
      await page.screenshot({ path: path.join(outDir, `viewport-${i}.png`), fullPage: false });
    }

    await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
    await fs.writeFile(
      path.join(outDir, 'CLAUDE.md'),
      `# Captured site\n\nURL capture fallback.\n\nTitle: ${meta.title}\n\n${meta.description}\n\n## Headings\n${meta.headings.map((h) => `- ${h}`).join('\n')}\n`,
      'utf8'
    );
  } finally {
    await browser.close();
  }
}

async function buildBriefFromCaptureDir(outDir, targetUrl, captureMethod) {
  const files = await walkFiles(outDir);
  const images = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  let meta = {};
  const metaPath = files.find((f) => /meta\.json$/i.test(f));
  if (metaPath) {
    try {
      meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    } catch {
      meta = {};
    }
  }

  let claudeMd = '';
  const mdPath = files.find((f) => /CLAUDE\.md$/i.test(path.basename(f)));
  if (mdPath) {
    claudeMd = await fs.readFile(mdPath, 'utf8');
  }

  const publicAssets = [];
  for (const img of images.slice(0, 12)) {
    const rel = path.relative(outDir, img).replace(/\\/g, '/');
    const captureId = path.basename(outDir);
    publicAssets.push({
      type: 'screenshot',
      path: `/api/captures/${captureId}/${rel}`,
      filename: path.basename(img),
      absolutePath: img
    });
  }

  const headings = meta.headings || extractHeadingsFromMarkdown(claudeMd);
  const title = meta.title || headings[0] || new URL(targetUrl).hostname;
  const colors = normalizeColors(meta.colors || meta.palette || []);

  return {
    title,
    url: targetUrl,
    bullets: (meta.paragraphs || []).slice(0, 5).map((p) => p.slice(0, 140)),
    sections: groupHeadings(headings),
    assets: publicAssets.map(({ absolutePath, ...rest }) => rest),
    brand: {
      colors: colors.length ? colors : ['#0a0a0f', '#67e8f9', '#a855f7', '#ffffff'],
      fonts: meta.fonts || ['Outfit', 'Inter']
    },
    sourceType: 'website',
    captureMethod,
    rawNotes: claudeMd.slice(0, 4000)
  };
}

function extractHeadingsFromMarkdown(md = '') {
  return md
    .split('\n')
    .map((l) => l.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 2 && l.length < 120)
    .slice(0, 12);
}

function groupHeadings(headings = []) {
  if (!headings.length) {
    return [{ heading: 'Overview', points: ['Key product highlights', 'Benefits', 'Call to action'] }];
  }
  return headings.slice(0, 6).map((h) => ({
    heading: h,
    points: [`Explain: ${h}`, 'Support with a short visual beat']
  }));
}

function normalizeColors(input) {
  const out = [];
  const push = (c) => {
    if (!c || typeof c !== 'string') return;
    const hex = rgbToHex(c) || (c.startsWith('#') ? c : null);
    if (hex && !out.includes(hex)) out.push(hex);
  };
  if (Array.isArray(input)) input.forEach(push);
  else if (input && typeof input === 'object') Object.values(input).forEach(push);
  return out.slice(0, 8);
}

function rgbToHex(value) {
  const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  const to = (n) => Number(n).toString(16).padStart(2, '0');
  return `#${to(m[1])}${to(m[2])}${to(m[3])}`;
}

async function walkFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(full));
    else files.push(full);
  }
  return files;
}
