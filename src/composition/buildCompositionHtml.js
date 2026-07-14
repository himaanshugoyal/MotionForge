import { getAspectDimensions, getProjectDuration } from '../models/project.js';
import { renderSceneHtml, sceneStyles, sceneScripts } from '../constants/sceneTemplates.js';
import { PRESET_TEMPLATES } from '../constants/presets.js';

/**
 * Build a full HyperFrames HTML document from a project (multi-scene).
 * Falls back to legacy overlay HTML when project uses legacy-overlays only.
 */
export function buildCompositionHtml(project, options = {}) {
  const { width, height } = getAspectDimensions(project.aspectRatio || 'landscape');
  const duration = Math.max(getProjectDuration(project), options.minDuration || 1);
  const brand = project.brand || {};
  const accent = brand.colors?.[1] || '#67e8f9';
  const bgVideo = project.backgroundVideoUrl;
  const baseUrl = (options.baseUrl || '').replace(/\/$/, '');
  const gsapSrc = options.gsapSrc || (baseUrl ? `${baseUrl}/gsap.min.js` : '/gsap.min.js');

  let cursor = 0;
  const scenesHtml = (project.scenes || []).map((scene, index) => {
    const normalized = absolutizeSceneAssets(scene, baseUrl);
    const html = renderSceneHtml(normalized, {
      globalStart: cursor,
      index,
      width,
      height,
      brand,
      accent
    });
    cursor += scene.duration || 4;
    return html;
  }).join('\n');

  const extraOverlayHtml = buildLegacyOverlayTracks(project);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(project.name || 'MotionForge Composition')}</title>
  <script src="${escapeAttr(gsapSrc)}"></script>
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      color: #fff;
      font-family: system-ui, 'Segoe UI', sans-serif;
    }
    #root {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #0a0a0f;
    }
    .scene {
      position: absolute;
      inset: 0;
      opacity: 0;
      overflow: hidden;
    }
    /* If GSAP never loads (blob preview), still show content */
    .scene.is-static-preview,
    .scene.is-static-preview [data-anim] {
      opacity: 1 !important;
      transform: none !important;
    }
    .clip { opacity: 0; position: absolute; transform-origin: center; }
    #video-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: ${bgVideo ? '1' : '0'};
    }
    ${sceneStyles()}
  </style>
</head>
<body>
  <div id="root"
       data-composition-id="${escapeAttr(project.id || 'motionforge')}"
       data-start="0"
       data-duration="${duration.toFixed(2)}"
       data-width="${width}"
       data-height="${height}">
    ${bgVideo ? `<video id="video-bg" class="clip" data-start="0" data-duration="${duration.toFixed(2)}" data-track-index="0" src="${escapeAttr(absolutizeUrl(bgVideo, baseUrl))}" playsinline></video>` : ''}
    ${scenesHtml}
    ${extraOverlayHtml}
  </div>
  <script>
    ${sceneScripts()}
  </script>
</body>
</html>`;
}

/**
 * Compatibility: build HTML from legacy overlays + optional video (old App path).
 */
export function buildCompositionHtmlFromOverlays({
  overlays = [],
  videoUrl = null,
  videoDuration = 8,
  aspectRatio = 'landscape',
  name = 'MotionForge Preview',
  baseUrl = '',
  gsapSrc = null
} = {}) {
  const { width, height } = getAspectDimensions(aspectRatio);
  const origin = (baseUrl || '').replace(/\/$/, '');
  const scriptSrc = gsapSrc || (origin ? `${origin}/gsap.min.js` : '/gsap.min.js');
  const overlaysHTML = overlays.map((overlay) => {
    const template = PRESET_TEMPLATES.find((t) => t.animationType === overlay.animationType);
    return template ? template.hyperframeCode(overlay) : '';
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(name)}</title>
  <script src="${escapeAttr(scriptSrc)}"></script>
  <style>
    body { margin: 0; background: #000; overflow: hidden; color: #fff; width: 100vw; height: 100vh; font-family: system-ui, sans-serif; }
    .clip { opacity: 0; position: absolute; transform-origin: center; }
    .clip.is-static-preview { opacity: 1 !important; }
    #video-bg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
    .template-neon { text-shadow: 0 0 12px var(--neon-color, #a855f7), 0 0 28px var(--neon-color, #a855f7); }
  </style>
</head>
<body>
  <div id="root" data-composition-id="preview" data-start="0" data-duration="${Number(videoDuration).toFixed(2)}" data-width="${width}" data-height="${height}" style="position:relative;width:${width}px;height:${height}px;">
    ${videoUrl ? `<video id="video-bg" class="clip" data-start="0" data-duration="${Number(videoDuration).toFixed(2)}" data-track-index="0" src="${escapeAttr(absolutizeUrl(videoUrl, origin))}" playsinline></video>` : ''}
    ${overlaysHTML}
  </div>
  <script>
    window.__timelines = window.__timelines || {};
    (function () {
      var root = document.getElementById('root');
      var id = (root && root.getAttribute('data-composition-id')) || 'preview';
      if (typeof gsap === 'undefined') {
        if (root) root.setAttribute('data-no-timeline', 'true');
        document.querySelectorAll('.clip').forEach(function (el) {
          el.classList.add('is-static-preview');
          el.style.opacity = '1';
        });
        return;
      }
      var tl = gsap.timeline({ paused: true });
      document.querySelectorAll('.clip').forEach(function (el) {
        var start = parseFloat(el.getAttribute('data-start') || '0');
        tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.45 }, start);
      });
      window.__timelines[id] = tl;
    })();
  </script>
</body>
</html>`;
}

function absolutizeUrl(url, baseUrl) {
  if (!url || !baseUrl) return url || '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;
  if (url.startsWith('/')) return `${baseUrl}${url}`;
  return url;
}

function absolutizeSceneAssets(scene, baseUrl) {
  if (!baseUrl || !scene) return scene;
  const next = { ...scene };
  if (next.imageUrl) next.imageUrl = absolutizeUrl(next.imageUrl, baseUrl);
  if (next.background?.value) {
    next.background = {
      ...next.background,
      value: absolutizeUrl(next.background.value, baseUrl)
    };
  }
  return next;
}

/**
 * Rewrite root-relative asset/script URLs so blob: HyperFrames previews can load them.
 */
export function prepareHtmlForBrowserPreview(html, origin) {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  if (!base) return html;
  return String(html)
    .replace(/src=["']\/gsap\.min\.js["']/g, `src="${base}/gsap.min.js"`)
    .replace(/src=["'](\/api\/[^"']+)["']/g, `src="${base}$1"`)
    .replace(/url\((['"]?)(\/api\/[^'")]+)\1\)/g, `url($1${base}$2$1)`);
}

function buildLegacyOverlayTracks(project) {
  let offset = 0;
  const chunks = [];
  for (const scene of project.scenes || []) {
    if (scene.template === 'legacy-overlays' && scene.layers?.length) {
      for (const layer of scene.layers) {
        const overlay = {
          ...layer,
          start: offset + (layer.start || 0),
          animationType: layer.type,
          trackIndex: layer.trackIndex || 2
        };
        const template = PRESET_TEMPLATES.find((t) => t.animationType === overlay.animationType);
        if (template) chunks.push(template.hyperframeCode(overlay));
      }
    }
    offset += scene.duration || 4;
  }

  // Global overlays rendered on top of full composition timeline.
  for (const layer of project.globalOverlays || []) {
    const overlay = {
      ...layer,
      start: layer.start || 0,
      animationType: layer.animationType || layer.type,
      trackIndex: layer.trackIndex || 2
    };
    const template = PRESET_TEMPLATES.find((t) => t.animationType === overlay.animationType);
    if (template) chunks.push(template.hyperframeCode(overlay));
  }

  return chunks.join('\n');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str = '') {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/** Blob URL helper for in-browser hyperframes-player preview */
export function compositionToBlobUrl(html) {
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
