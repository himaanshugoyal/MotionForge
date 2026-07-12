import React, { useMemo } from 'react';
import { Layers, SkipBack, Play, Pause, RotateCcw } from 'lucide-react';
import { getProjectDuration } from '../models/project';

export function formatTimecode(seconds = 0) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  const whole = Math.floor(rem);
  const frames = Math.floor((rem - whole) * 30);
  return `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${String(frames).padStart(2, '0')}`;
}

function buildRulerTicks(duration) {
  const d = Math.max(duration || 1, 0.1);
  const step = d <= 10 ? 0.5 : d <= 30 ? 1 : 2;
  const ticks = [];
  for (let t = 0; t <= d + 0.001; t += step) {
    ticks.push({
      time: Math.min(t, d),
      major: t === 0 || Math.abs(t % 1) < 0.001 || step >= 1
    });
  }
  if (ticks[ticks.length - 1]?.time < d - 0.05) {
    ticks.push({ time: d, major: true });
  }
  return ticks;
}

/**
 * Professional timeline: gutter + ruler + scene/overlay tracks + shared playhead.
 */
export default function TimelinePanel({
  videoDuration,
  currentTime,
  cropStart,
  cropEnd,
  overlays,
  project,
  selectedOverlayId,
  selectedSceneId,
  onScrub,
  onSelectOverlay,
  onSelectScene,
  onCropStart,
  onCropEnd
}) {
  const duration = Math.max(
    videoDuration || 0,
    getProjectDuration(project) || 0,
    0.1
  );
  const ticks = useMemo(() => buildRulerTicks(duration), [duration]);
  const playheadPct = Math.min(100, Math.max(0, (currentTime / duration) * 100));

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

  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <div className="timeline-tabs">
          <span className="timeline-tab active">
            <Layers size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Timeline
          </span>
          <span className="timeline-fit-hint">Fit · {duration.toFixed(1)}s</span>
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
          {/* Gutter column */}
          <div className="tl-gutter">
            <div className="tl-gutter-ruler-spacer" />
            <div className="tl-gutter-master-spacer" title="Master trim">Master</div>
            {sceneBlocks.length > 0 && (
              <div className="tl-gutter-label">Scenes</div>
            )}
            {overlays.map((layer, i) => (
              <div
                key={layer.id}
                className={`tl-gutter-label ${selectedOverlayId === layer.id ? 'active' : ''}`}
                title={layer.text || layer.name || `Track ${i + 1}`}
              >
                {layer.name || layer.text || `V${i + 1}`}
              </div>
            ))}
            {overlays.length === 0 && sceneBlocks.length === 0 && (
              <div className="tl-gutter-label muted">Empty</div>
            )}
          </div>

          {/* Tracks column */}
          <div className="tl-tracks">
            <div
              className="tl-playhead"
              style={{ left: `${playheadPct}%` }}
            >
              <div className="tl-playhead-head" />
            </div>

            {/* Ruler */}
            <div className="tl-ruler">
              {ticks.map((tick) => (
                <div
                  key={`t-${tick.time}`}
                  className={`tl-ruler-tick ${tick.major ? 'major' : ''}`}
                  style={{ left: `${(tick.time / duration) * 100}%` }}
                >
                  {tick.major && (
                    <span className="tl-ruler-label">{tick.time % 1 === 0 ? `${tick.time}s` : tick.time.toFixed(1)}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Master trim strip */}
            <div className="tl-master">
              <div
                className="tl-trim-region"
                style={{
                  left: `${(cropStart / duration) * 100}%`,
                  width: `${(Math.max(0, cropEnd - cropStart) / duration) * 100}%`
                }}
              >
                <span className="tl-trim-handle start" title="Trim in" />
                <span className="tl-trim-handle end" title="Trim out" />
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

            {/* Scenes lane */}
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

            {/* Overlay lanes */}
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

            {overlays.length === 0 && sceneBlocks.length === 0 && (
              <div className="tl-empty">Add scenes or overlays to populate the timeline.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Transport dock between monitor and timeline */
export function TransportDock({
  isPlaying,
  currentTime,
  duration,
  showHyperFramesPreview,
  onPlay,
  onReset
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
