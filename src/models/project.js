import { createScene, totalDuration } from './scene.js';

/**
 * Create a MotionForge project document (source of truth for the editor).
 */
export function createProject(partial = {}) {
  const aspectRatio = partial.aspectRatio || 'landscape';
  const scenes = Array.isArray(partial.scenes) && partial.scenes.length
    ? partial.scenes.map((s) => createScene(s))
    : [createScene({ title: 'Intro', template: 'title-card' })];

  return {
    id: partial.id || `proj-${Date.now()}`,
    name: partial.name || 'Untitled Project',
    aspectRatio,
    scenes,
    assets: Array.isArray(partial.assets) ? partial.assets : [],
    sourceMeta: partial.sourceMeta || null,
    brand: partial.brand || {
      colors: ['#0a0a0f', '#67e8f9', '#a855f7', '#ffffff'],
      fonts: ['Outfit', 'Inter']
    },
    backgroundVideoUrl: partial.backgroundVideoUrl || null,
    createdAt: partial.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getProjectDuration(project) {
  return totalDuration(project?.scenes || []);
}

export function getAspectDimensions(aspectRatio = 'landscape') {
  if (aspectRatio === 'portrait') return { width: 1080, height: 1920 };
  if (aspectRatio === 'square') return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

export function updateScene(project, sceneId, patch) {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    scenes: project.scenes.map((s) => (s.id === sceneId ? createScene({ ...s, ...patch }) : s))
  };
}

export function reorderScenes(project, fromIndex, toIndex) {
  const scenes = [...project.scenes];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= scenes.length || toIndex >= scenes.length) {
    return project;
  }
  const [moved] = scenes.splice(fromIndex, 1);
  scenes.splice(toIndex, 0, moved);
  return { ...project, scenes, updatedAt: new Date().toISOString() };
}

export function duplicateScene(project, sceneId) {
  const idx = project.scenes.findIndex((s) => s.id === sceneId);
  if (idx < 0) return project;
  const copy = createScene({
    ...project.scenes[idx],
    id: undefined,
    title: `${project.scenes[idx].title} Copy`
  });
  const scenes = [...project.scenes];
  scenes.splice(idx + 1, 0, copy);
  return { ...project, scenes, updatedAt: new Date().toISOString() };
}

export function removeScene(project, sceneId) {
  const scenes = project.scenes.filter((s) => s.id !== sceneId);
  return {
    ...project,
    scenes: scenes.length ? scenes : [createScene({ title: 'Intro', template: 'title-card' })],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Convert legacy overlay timeline into a single-scene project (compat bridge).
 */
export function projectFromOverlays({ overlays = [], aspectRatio = 'landscape', videoDuration = 8, videoUrl = null, brand } = {}) {
  const layers = overlays.map((o, i) => ({
    id: o.id || `layer-${i}`,
    type: o.animationType || 'fade',
    text: o.text || '',
    start: o.start || 0,
    duration: o.duration || 3,
    fontSize: o.fontSize || 48,
    textColor: o.textColor || '#ffffff',
    accentColor: o.accentColor || '#a855f7',
    x: o.x ?? 50,
    y: o.y ?? 50,
    trackIndex: o.trackIndex || i + 1
  }));

  return createProject({
    aspectRatio,
    backgroundVideoUrl: videoUrl,
    brand,
    scenes: [
      createScene({
        title: 'Composition',
        template: 'legacy-overlays',
        duration: videoDuration,
        background: videoUrl
          ? { type: 'video', value: videoUrl }
          : { type: 'color', value: '#0a0a0f' },
        layers
      })
    ]
  });
}

/**
 * Flatten project scenes into legacy overlay list for the existing canvas editor.
 */
export function overlaysFromProject(project) {
  const overlays = [];
  let offset = 0;
  for (const scene of project.scenes || []) {
    for (const layer of scene.layers || []) {
      overlays.push({
        id: layer.id,
        name: layer.text?.slice(0, 24) || scene.title,
        text: layer.text || scene.title,
        start: offset + (layer.start || 0),
        duration: layer.duration || Math.min(3, scene.duration),
        fontSize: layer.fontSize || 48,
        textColor: layer.textColor || '#ffffff',
        accentColor: layer.accentColor || project.brand?.colors?.[1] || '#67e8f9',
        x: layer.x ?? 50,
        y: layer.y ?? 40,
        trackIndex: layer.trackIndex || overlays.length + 1,
        animationType: layer.type || 'fade',
        sceneId: scene.id
      });
    }
    // Scene-level title as neon if no layers
    if (!scene.layers?.length && scene.title) {
      overlays.push({
        id: `${scene.id}-title`,
        name: scene.title,
        text: scene.title,
        start: offset + 0.3,
        duration: Math.max(2, scene.duration - 0.6),
        fontSize: 64,
        textColor: '#ffffff',
        accentColor: project.brand?.colors?.[1] || '#67e8f9',
        x: 50,
        y: 45,
        trackIndex: overlays.length + 1,
        animationType: 'neon',
        sceneId: scene.id
      });
    }
    offset += scene.duration || 4;
  }
  return overlays;
}
