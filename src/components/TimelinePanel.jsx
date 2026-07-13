import React, { useMemo, useRef, useState } from 'react';
import { Layers, SkipBack, Play, Pause, RotateCcw, Scissors, Video, Magnet, Wand2, Link } from 'lucide-react';
import { getProjectDuration } from '../models/project';
import { findActiveClip, getClipsEnd, VIDEO_DRAG_MIME } from '../models/videoClip';

export function formatTimecode(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const whole = Math.floor(rem);
  const frames = Math.floor((rem - whole) * 30);
  return `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
}

function renderClipWaveform(clip) {
  if (!clip.peaks) {
    return <div className="tl-clip-wave" aria-hidden />;
  }

  if (clip.peaks === 'loading') {
    return (
      <div 
        className="tl-clip-wave loading-wave" 
        aria-hidden 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '10px', 
          fontSize: '7px', 
          color: 'hsl(var(--accent-cyan))', 
          fontWeight: 'bold',
          background: 'hsl(200 25% 12% / 0.8)',
          letterSpacing: '0.5px'
        }}
      >
        <span>ANALYZING AUDIO...</span>
      </div>
    );
  }

  if (!Array.isArray(clip.peaks) || clip.peaks.length === 0) {
    return <div className="tl-clip-wave" aria-hidden />;
  }

  const totalPeaks = clip.peaks.length;
  const startIdx = Math.floor((clip.sourceIn / clip.sourceDuration) * totalPeaks);
  const endIdx = Math.ceil((clip.sourceOut / clip.sourceDuration) * totalPeaks);
  const visiblePeaks = clip.peaks.slice(Math.max(0, startIdx), Math.min(totalPeaks, endIdx));

  if (visiblePeaks.length === 0) {
    return <div className="tl-clip-wave" aria-hidden />;
  }

  const width = 1000;
  const height = 100;
  const centerY = height / 2;
  const step = width / (visiblePeaks.length - 1 || 1);
  
  let topPoints = [];
  let bottomPoints = [];
  
  visiblePeaks.forEach((p, idx) => {
    const x = idx * step;
    const amplitude = p * (height / 2 - 2);
    topPoints.push(`${x},${centerY - amplitude}`);
    bottomPoints.unshift(`${x},${centerY + amplitude}`);
  });
  
  const d = `M ${topPoints.join(' L ')} L ${bottomPoints.join(' L ')} Z`;

  return (
    <div className="tl-clip-wave-graph" style={{ height: '10px', borderTop: '1px solid hsl(0 0% 0% / 0.25)', overflow: 'hidden', background: 'hsl(200 25% 12%)' }}>
      <svg viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d={d} fill="hsl(145 70% 45% / 0.75)" />
      </svg>
    </div>
  );
}

function buildRulerTicks(duration) {
  const d = Math.max(duration || 1, 0.1);
  const step = d <= 10 ? 0.5 : d <= 30 ? 1 : d <= 90 ? 2 : 5;
  const ticks = [];
  for (let t = 0; t <= d + 0.001; t += step) {
    ticks.push({
      time: Math.min(t, d),
      major: t === 0 || Math.abs(t % (step >= 2 ? step : 1)) < 0.001 || step >= 2
    });
  }
  if (ticks[ticks.length - 1]?.time < d - 0.05) {
    ticks.push({ time: d, major: true });
  }
  return ticks;
}

function formatRulerLabel(time) {
  if (time >= 60) {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return time % 1 === 0 ? `${time}s` : time.toFixed(1);
}

/**
 * Professional timeline with Video (V1) track + scenes + overlays.
 * Supports drop, trim edges, body-drag move, and split at playhead.
 */
export default function TimelinePanel({
  videoDuration,
  currentTime,
  cropStart,
  cropEnd,
  overlays = [],
  project,
  videoClips = [],
  selectedOverlayId,
  selectedSceneId,
  selectedVideoClipId,
  onScrub,
  onSelectOverlay,
  onSelectScene,
  onSelectVideoClip,
  onCropStart,
  onCropEnd,
  onDropVideo,
  onTrimVideoClip,
  onMoveVideoClip,
  onSplitVideoClip,
  onAutoTrimSilence,
  onAutoGenerateGraphics,
  isRippleEnabled,
  onToggleRipple
}) {
  const videoTrackRef = useRef(null);
  const [dragOverVideo, setDragOverVideo] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const interactionRef = useRef(null);

  const duration = Math.max(
    videoDuration || 0,
    getProjectDuration(project) || 0,
    getClipsEnd(videoClips) || 0,
    cropEnd || 0,
    0.1
  );
  const ticks = useMemo(() => buildRulerTicks(duration), [duration]);
  const playheadPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  const canSplit = useMemo(() => {
    const clip =
      (selectedVideoClipId && videoClips.find((c) => c.id === selectedVideoClipId)) ||
      findActiveClip(videoClips, currentTime);
    if (!clip) return false;
    const local = currentTime - clip.timelineStart;
    return local >= 0.2 && local <= clip.duration - 0.2;
  }, [videoClips, selectedVideoClipId, currentTime]);

  const sceneBlocks = useMemo(() => {
    let offset = 0;
    return (project?.scenes || []).map((scene) => {
      const block = {
        id: scene.id,
        title: scene.title,
        template: scene.template,
        start: offset,
        duration: Number(scene.duration) || 4
      };
      offset += block.duration;
      return block;
    });
  }, [project?.scenes]);

  const parseDropPayload = (e) => {
    const raw =
      e.dataTransfer.getData(VIDEO_DRAG_MIME) ||
      e.dataTransfer.getData('application/json') ||
      e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const pxPerSec = () => {
    const el = videoTrackRef.current;
    if (!el) return 1;
    return el.getBoundingClientRect().width / duration;
  };

  const timeFromClientX = (clientX) => {
    const el = videoTrackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return pct * duration;
  };

  const snapTime = (t) => {
    if (!snapEnabled) return Math.max(0, t);
    const points = [0, cropStart, cropEnd, currentTime];
    videoClips.forEach((c) => {
      points.push(c.timelineStart, c.timelineStart + c.duration);
    });
    const threshold = 0.35;
    let best = t;
    let bestDist = threshold;
    for (const p of points) {
      const d = Math.abs(t - p);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return Math.max(0, best);
  };

  const handleVideoDrop = (e) => {
    e.preventDefault();
    setDragOverVideo(false);
    const payload = parseDropPayload(e);
    if (!payload?.url) return;
    const timelineStart = snapTime(timeFromClientX(e.clientX));
    onDropVideo?.(payload, timelineStart);
  };

  const endInteraction = () => {
    interactionRef.current = null;
    window.removeEventListener('pointermove', onInteractionMove);
    window.removeEventListener('pointerup', endInteraction);
  };

  const onInteractionMove = (ev) => {
    const state = interactionRef.current;
    if (!state) return;
    const delta = (ev.clientX - state.startX) / pxPerSec();

    if (state.mode === 'trim') {
      onTrimVideoClip?.(state.clipId, state.edge, delta, state.origin);
      return;
    }

    if (state.mode === 'move') {
      const nextStart = snapTime(state.origin.timelineStart + delta);
      onMoveVideoClip?.(state.clipId, nextStart, state.origin);
    }
  };

  const startTrim = (e, clipId, edge) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = videoClips.find((c) => c.id === clipId);
    if (!clip || !onTrimVideoClip) return;
    interactionRef.current = {
      mode: 'trim',
      clipId,
      edge,
      startX: e.clientX,
      origin: { ...clip }
    };
    onSelectVideoClip?.(clipId);
    window.addEventListener('pointermove', onInteractionMove);
    window.addEventListener('pointerup', endInteraction);
  };

  const startMove = (e, clipId) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const clip = videoClips.find((c) => c.id === clipId);
    if (!clip || !onMoveVideoClip) return;
    interactionRef.current = {
      mode: 'move',
      clipId,
      startX: e.clientX,
      origin: { ...clip }
    };
    onSelectVideoClip?.(clipId);
    window.addEventListener('pointermove', onInteractionMove);
    window.addEventListener('pointerup', endInteraction);
  };

  const handleSplit = () => {
    if (!canSplit) return;
    onSplitVideoClip?.(currentTime);
  };

  const isEmpty =
    videoClips.length === 0 && overlays.length === 0 && sceneBlocks.length === 0;

  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <div className="timeline-tabs">
          <span className="timeline-tab active">
            <Layers size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Timeline
          </span>
          <span className="timeline-fit-hint">Fit · {duration.toFixed(1)}s</span>
          <div className="timeline-tools">
            <button
              type="button"
              className={`tl-tool-btn ${snapEnabled ? 'active' : ''}`}
              title="Snap to edges"
              onClick={() => setSnapEnabled((v) => !v)}
            >
              <Magnet size={13} />
            </button>
            <button
              type="button"
              className={`tl-tool-btn ${isRippleEnabled ? 'active' : ''}`}
              title="Ripple Edit (Shift clips when trimming/deleting)"
              onClick={() => onToggleRipple && onToggleRipple()}
            >
              <Link size={13} />
            </button>
            <button
              type="button"
              className={`tl-tool-btn split ${canSplit ? '' : 'disabled'}`}
              title="Split at playhead (S)"
              disabled={!canSplit}
              onClick={handleSplit}
            >
              <Scissors size={13} />
              Split
            </button>
            <button
              type="button"
              className={`tl-tool-btn auto-trim ${selectedVideoClipId ? '' : 'disabled'}`}
              title="Auto Trim Silences (Magic)"
              disabled={!selectedVideoClipId}
              onClick={() => onAutoTrimSilence && onAutoTrimSilence()}
            >
              <Wand2 size={13} />
              Auto Trim
            </button>
            <button
              type="button"
              className={`tl-tool-btn auto-trim ${selectedVideoClipId ? '' : 'disabled'}`}
              title="Auto Generate Graphics from Speech"
              disabled={!selectedVideoClipId}
              onClick={() => onAutoGenerateGraphics && onAutoGenerateGraphics()}
              style={{ color: 'hsl(var(--accent-purple))', borderColor: 'rgba(168, 85, 247, 0.4)' }}
            >
              <Wand2 size={13} />
              Auto-GFX
            </button>
          </div>
        </div>
        <div className="timeline-trim-fields">
          <span className="timeline-trim-label">In</span>
          <input
            type="number"
            value={Number(cropStart).toFixed(1)}
            step="0.1"
            min="0"
            max={cropEnd}
            onChange={(e) => onCropStart(Math.max(0, parseFloat(e.target.value) || 0))}
            className="timeline-tc-input"
          />
          <span className="timeline-trim-label">Out</span>
          <input
            type="number"
            value={Number(cropEnd).toFixed(1)}
            step="0.1"
            min={cropStart}
            max={duration}
            onChange={(e) => onCropEnd(Math.min(duration, parseFloat(e.target.value) || duration))}
            className="timeline-tc-input"
          />
        </div>
      </div>

      <div className="timeline-body pro-timeline-body">
        <div className="tl-grid">
          <div className="tl-gutter">
            <div className="tl-gutter-ruler-spacer" />
            <div className="tl-gutter-master-spacer" title="Master trim">Master</div>
            <div className={`tl-gutter-label video-track ${selectedVideoClipId ? 'active' : ''}`}>
              <Video size={11} />
              <span>Video 1</span>
            </div>
            {sceneBlocks.length > 0 && (
              <div className="tl-gutter-label">Scenes</div>
            )}
            {overlays.map((layer, i) => (
              <div
                key={layer.id}
                className={`tl-gutter-label ${selectedOverlayId === layer.id ? 'active' : ''}`}
                title={layer.text || layer.name || `Track ${i + 1}`}
              >
                {layer.name || layer.text || `L${i + 1}`}
              </div>
            ))}
            {isEmpty && (
              <div className="tl-gutter-label muted">Drop video</div>
            )}
          </div>

          <div className="tl-tracks">
            <div className="tl-playhead" style={{ left: `${playheadPct}%` }}>
              <button
                type="button"
                className={`tl-playhead-cut ${canSplit ? 'ready' : ''}`}
                title={canSplit ? 'Split clip at playhead' : 'Move playhead onto a clip to split'}
                disabled={!canSplit}
                onClick={handleSplit}
              >
                <Scissors size={11} />
              </button>
              <div className="tl-playhead-head" />
            </div>

            <div className="tl-ruler">
              {ticks.map((tick) => (
                <div
                  key={`t-${tick.time}`}
                  className={`tl-ruler-tick ${tick.major ? 'major' : ''}`}
                  style={{ left: `${(tick.time / duration) * 100}%` }}
                >
                  {tick.major && (
                    <span className="tl-ruler-label">{formatRulerLabel(tick.time)}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="tl-master">
              <div
                className="tl-trim-region"
                style={{
                  left: `${(cropStart / duration) * 100}%`,
                  width: `${(Math.max(0, cropEnd - cropStart) / duration) * 100}%`
                }}
              >
                <span className="tl-trim-handle start" title="Composition in" />
                <span className="tl-trim-handle end" title="Composition out" />
              </div>
              <input
                type="range"
                className="tl-scrub-input"
                min="0"
                max={duration}
                step="0.05"
                value={Math.min(currentTime, duration)}
                onChange={onScrub}
              />
            </div>

            {/* Video V1 track — drop / move / trim */}
            <div
              ref={videoTrackRef}
              className={`tl-track-row tl-video-track ${dragOverVideo ? 'drag-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                setDragOverVideo(true);
              }}
              onDragLeave={() => setDragOverVideo(false)}
              onDrop={handleVideoDrop}
            >
              {videoClips.length === 0 && (
                <div className="tl-drop-hint">Drag videos here · trim edges · drag body to move · Split to cut</div>
              )}
              {videoClips.map((clip) => (
                <div
                  key={clip.id}
                  role="button"
                  tabIndex={0}
                  className={`tl-clip video pro ${selectedVideoClipId === clip.id ? 'selected' : ''}`}
                  style={{
                    left: `${(clip.timelineStart / duration) * 100}%`,
                    width: `${(clip.duration / duration) * 100}%`
                  }}
                  title={`${clip.name} · drag to move · edges to trim`}
                  onPointerDown={(e) => startMove(e, clip.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelectVideoClip?.(clip.id);
                  }}
                >
                  <span
                    className="tl-clip-edge left"
                    onPointerDown={(e) => startTrim(e, clip.id, 'left')}
                    title="Trim in"
                  />
                  <div className="tl-clip-body">
                    <div className="tl-clip-header">
                      <Video size={10} />
                      <span className="tl-clip-label">{clip.name}</span>
                    </div>
                    <div className="tl-clip-filmstrip" aria-hidden />
                    {renderClipWaveform(clip)}
                  </div>
                  <span
                    className="tl-clip-edge right"
                    onPointerDown={(e) => startTrim(e, clip.id, 'right')}
                    title="Trim out"
                  />
                </div>
              ))}
            </div>

            {sceneBlocks.length > 0 && (
              <div className="tl-track-row">
                {sceneBlocks.map((scene) => (
                  <button
                    type="button"
                    key={scene.id}
                    className={`tl-clip scene ${selectedSceneId === scene.id ? 'selected' : ''}`}
                    style={{
                      left: `${(scene.start / duration) * 100}%`,
                      width: `${(scene.duration / duration) * 100}%`
                    }}
                    title={`${scene.title} (${scene.duration.toFixed(1)}s)`}
                    onClick={() => onSelectScene?.(scene.id)}
                  >
                    <span className="tl-clip-label">{scene.title}</span>
                  </button>
                ))}
              </div>
            )}

            {overlays.map((layer) => (
              <div key={layer.id} className="tl-track-row">
                <button
                  type="button"
                  className={`tl-clip overlay ${selectedOverlayId === layer.id ? 'selected' : ''}`}
                  style={{
                    left: `${(layer.start / duration) * 100}%`,
                    width: `${(layer.duration / duration) * 100}%`
                  }}
                  title={layer.text || layer.name}
                  onClick={() => onSelectOverlay?.(layer.id)}
                >
                  <span className="tl-clip-label">{layer.name || layer.text}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransportDock({
  isPlaying,
  currentTime,
  duration,
  showHyperFramesPreview,
  onPlay,
  onReset,
  onSplit,
  canSplit
}) {
  const total = Math.max(duration || 0, 0.1);
  return (
    <div className="transport-dock">
      <div className="transport-left">
        <button type="button" className="control-btn" onClick={onReset} title="Go to in-point">
          <SkipBack size={15} />
        </button>
        <button
          type="button"
          className={`control-btn transport-play ${isPlaying ? 'active-play' : ''}`}
          onClick={onPlay}
          title={showHyperFramesPreview ? 'Scrub timeline (use HF player for motion play)' : 'Play / Pause'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button type="button" className="control-btn" onClick={onReset} title="Reset">
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          className={`control-btn ${canSplit ? '' : 'is-disabled'}`}
          onClick={onSplit}
          disabled={!canSplit}
          title="Split clip at playhead (S)"
        >
          <Scissors size={14} />
        </button>
      </div>
      <div className="transport-timecode">
        <span className="tc-current">{formatTimecode(currentTime)}</span>
        <span className="tc-sep">/</span>
        <span className="tc-total">{formatTimecode(total)}</span>
      </div>
      <div className="transport-right">
        <span className={`transport-mode-pill ${showHyperFramesPreview ? 'hf' : 'canvas'}`}>
          {showHyperFramesPreview ? 'HyperFrames' : 'Canvas'}
        </span>
      </div>
    </div>
  );
}
