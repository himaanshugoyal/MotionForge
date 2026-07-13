/**
 * Timeline video clip model (Premiere-style V1 track).
 */

const MIN_CLIP_DURATION = 0.2;

export function createVideoClip(partial = {}) {
  const sourceDuration = Math.max(Number(partial.sourceDuration) || 0, MIN_CLIP_DURATION);
  let sourceIn = Math.max(0, Number(partial.sourceIn) || 0);
  let sourceOut = Number(partial.sourceOut);
  if (!Number.isFinite(sourceOut) || sourceOut <= sourceIn) {
    sourceOut = sourceDuration;
  }
  sourceOut = Math.min(sourceOut, sourceDuration);
  sourceIn = Math.min(sourceIn, Math.max(0, sourceOut - MIN_CLIP_DURATION));

  const duration = Math.max(sourceOut - sourceIn, MIN_CLIP_DURATION);

  return {
    id: partial.id || `vclip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    assetId: partial.assetId || null,
    name: partial.name || 'Video Clip',
    url: partial.url || '',
    timelineStart: Math.max(0, Number(partial.timelineStart) || 0),
    duration,
    sourceIn,
    sourceOut,
    sourceDuration,
    peaks: partial.peaks || null
  };
}

export function getClipsEnd(clips = []) {
  return clips.reduce((max, c) => Math.max(max, (c.timelineStart || 0) + (c.duration || 0)), 0);
}

export function findActiveClip(clips = [], time = 0) {
  return clips.find(
    (c) => time >= c.timelineStart && time < c.timelineStart + c.duration
  ) || null;
}

export function sourceTimeForClip(clip, timelineTime) {
  if (!clip) return 0;
  const local = Math.max(0, timelineTime - clip.timelineStart);
  return Math.min(clip.sourceOut, clip.sourceIn + local);
}

/** Suggest insert time: playhead, or append after last clip if playhead is past end. */
export function suggestInsertTime(clips = [], playhead = 0) {
  const end = getClipsEnd(clips);
  if (playhead >= end - 0.05) return end;
  return Math.max(0, playhead);
}

export function duplicateClip(clip, insertAt = null) {
  if (!clip) return null;
  const start = insertAt != null ? insertAt : clip.timelineStart + clip.duration;
  return createVideoClip({
    ...clip,
    id: undefined,
    name: `${clip.name} Copy`,
    timelineStart: start
  });
}

/**
 * Trim from left edge (changes sourceIn and timelineStart, keeps sourceOut).
 * deltaTimeline: how much the left edge moved (positive = later start / shorter).
 */
export function trimClipLeft(clip, deltaTimeline) {
  const next = { ...clip };
  const maxShrink = clip.duration - MIN_CLIP_DURATION;
  const applied = Math.max(-clip.sourceIn, Math.min(deltaTimeline, maxShrink));
  next.timelineStart = clip.timelineStart + applied;
  next.sourceIn = clip.sourceIn + applied;
  next.duration = next.sourceOut - next.sourceIn;
  return createVideoClip(next);
}

/**
 * Trim from right edge (changes sourceOut / duration).
 * deltaTimeline: how much the right edge moved (positive = longer).
 */
export function trimClipRight(clip, deltaTimeline) {
  const next = { ...clip };
  const maxGrow = clip.sourceDuration - clip.sourceOut;
  const maxShrink = -(clip.duration - MIN_CLIP_DURATION);
  const applied = Math.max(maxShrink, Math.min(deltaTimeline, maxGrow));
  next.sourceOut = clip.sourceOut + applied;
  next.duration = next.sourceOut - next.sourceIn;
  return createVideoClip(next);
}

export function updateClipTrim(clip, { sourceIn, sourceOut }) {
  return createVideoClip({
    ...clip,
    sourceIn: sourceIn != null ? sourceIn : clip.sourceIn,
    sourceOut: sourceOut != null ? sourceOut : clip.sourceOut
  });
}

/** Slide clip on the timeline without changing source trim. */
export function moveClip(clip, newTimelineStart) {
  if (!clip) return null;
  return createVideoClip({
    ...clip,
    timelineStart: Math.max(0, Number(newTimelineStart) || 0)
  });
}

/**
 * Split a clip at an absolute timeline time.
 * Returns [left, right] or null if playhead is not inside the clip (with margin).
 */
export function splitClipAt(clip, timelineTime) {
  if (!clip) return null;
  const local = timelineTime - clip.timelineStart;
  if (local < MIN_CLIP_DURATION || local > clip.duration - MIN_CLIP_DURATION) {
    return null;
  }
  const splitSource = clip.sourceIn + local;
  const left = createVideoClip({
    ...clip,
    id: clip.id,
    sourceOut: splitSource
  });
  const right = createVideoClip({
    ...clip,
    id: undefined,
    name: clip.name,
    timelineStart: timelineTime,
    sourceIn: splitSource,
    sourceOut: clip.sourceOut
  });
  return [left, right];
}

export { MIN_CLIP_DURATION };

export const VIDEO_DRAG_MIME = 'application/x-motionforge-video';
