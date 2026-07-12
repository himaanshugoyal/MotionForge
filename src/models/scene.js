/**
 * Scene model for multi-scene HyperFrames compositions.
 */

export const SCENE_TEMPLATES = [
  'title-card',
  'bullet-explainer',
  'screenshot-kenburns',
  'quote',
  'cta-outro',
  'legacy-overlays'
];

export function createScene(partial = {}) {
  const template = SCENE_TEMPLATES.includes(partial.template)
    ? partial.template
    : (partial.template || 'title-card');

  return {
    id: partial.id || `scene-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: partial.title || 'Untitled Scene',
    duration: Number(partial.duration) > 0 ? Number(partial.duration) : defaultDuration(template),
    template,
    background: normalizeBackground(partial.background),
    layers: Array.isArray(partial.layers) ? partial.layers.map(normalizeLayer) : [],
    transition: partial.transition || 'fade',
    subtitle: partial.subtitle || '',
    bullets: Array.isArray(partial.bullets) ? partial.bullets : [],
    imageUrl: partial.imageUrl || null,
    accentColor: partial.accentColor || null
  };
}

function defaultDuration(template) {
  switch (template) {
    case 'title-card': return 3.5;
    case 'bullet-explainer': return 5;
    case 'screenshot-kenburns': return 5.5;
    case 'quote': return 4;
    case 'cta-outro': return 3.5;
    default: return 4;
  }
}

function normalizeBackground(bg) {
  if (!bg) return { type: 'gradient', value: 'radial-gradient(ellipse at 30% 20%, #1a1040 0%, #0a0a0f 60%)' };
  if (typeof bg === 'string') {
    if (bg.startsWith('http') || bg.startsWith('blob:') || bg.startsWith('/')) {
      return { type: 'image', value: bg };
    }
    if (bg.includes('gradient')) return { type: 'gradient', value: bg };
    return { type: 'color', value: bg };
  }
  return {
    type: bg.type || 'color',
    value: bg.value || '#0a0a0f'
  };
}

function normalizeLayer(layer = {}) {
  return {
    id: layer.id || `layer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: layer.type || layer.animationType || 'fade',
    text: layer.text || '',
    start: Number(layer.start) || 0,
    duration: Number(layer.duration) || 3,
    fontSize: Number(layer.fontSize) || 48,
    textColor: layer.textColor || '#ffffff',
    accentColor: layer.accentColor || '#67e8f9',
    x: layer.x ?? 50,
    y: layer.y ?? 50,
    trackIndex: layer.trackIndex || 1
  };
}

export function totalDuration(scenes = []) {
  return scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
}

export function sceneAtTime(scenes = [], time = 0) {
  let t = 0;
  for (const scene of scenes) {
    const end = t + (scene.duration || 0);
    if (time >= t && time < end) {
      return { scene, localTime: time - t, globalStart: t };
    }
    t = end;
  }
  const last = scenes[scenes.length - 1];
  return last
    ? { scene: last, localTime: last.duration, globalStart: Math.max(0, t - last.duration) }
    : null;
}
