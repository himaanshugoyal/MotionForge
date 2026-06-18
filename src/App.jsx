import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Upload, 
  Video, 
  Type, 
  Sparkles, 
  Download, 
  Copy, 
  Plus, 
  Trash2, 
  Settings, 
  Code, 
  Smartphone, 
  Monitor, 
  Crop,
  Layers,
  ChevronRight,
  Check,
  VideoOff
} from 'lucide-react';
import { PRESET_TEMPLATES } from './constants/presets';
import { exportVideo } from './utils/exporter';

const SAMPLE_VIDEOS = [
  {
    id: 'sample-ai-presenter',
    name: 'Talking Head Presenter',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-man-holding-a-smartphone-in-his-hand-40507-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=84&q=80'
  },
  {
    id: 'sample-cyberpunk',
    name: 'Cyberpunk Neon Street',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-city-street-with-neon-lights-at-night-42250-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1515621061946-eff1c2a352bd?auto=format&fit=crop&w=150&h=84&q=80'
  },
  {
    id: 'sample-code',
    name: 'Developer IDE Stream',
    url: 'https://assets.mixkit.co/videos/preview/mixkit-code-running-on-a-computer-screen-43024-large.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=150&h=84&q=80'
  }
];

export default function App() {
  // Video and Playback State
  const [videoUrl, setVideoUrl] = useState(SAMPLE_VIDEOS[0].url);
  const [videoDuration, setVideoDuration] = useState(10);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('landscape'); // landscape | portrait | square

  // Crop / Trim Range
  const [cropStart, setCropStart] = useState(0);
  const [cropEnd, setCropEnd] = useState(10);

  // Overlays State
  const [overlays, setOverlays] = useState([
    {
      id: 'neon-welcome',
      name: 'Neon Glow Title',
      text: 'CREATIVE REEL',
      start: 1.0,
      duration: 4.0,
      fontSize: 56,
      textColor: '#ffffff',
      accentColor: '#a855f7',
      x: 50,
      y: 45,
      trackIndex: 1,
      animationType: 'neon'
    },
    {
      id: 'spring-intro',
      name: 'Remotion Spring Label',
      text: 'NEW REEL 🚀',
      start: 5.5,
      duration: 3.5,
      fontSize: 22,
      textColor: '#000000',
      accentColor: '#06b6d4',
      x: 50,
      y: 75,
      trackIndex: 2,
      animationType: 'spring'
    }
  ]);

  const [selectedOverlayId, setSelectedOverlayId] = useState('neon-welcome');
  const [activeRightTab, setActiveRightTab] = useState('properties'); // properties | code | export
  const [activeCodeTab, setActiveCodeTab] = useState('hyperframes'); // hyperframes | remotion
  const [copiedText, setCopiedText] = useState(false);

  // Render / Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Refs
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Selected Overlay details
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);

  // Sync video timeline playback loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      // Loop video back to cropStart if it goes past cropEnd
      if (video.currentTime >= cropEnd) {
        video.currentTime = cropStart;
        if (!isPlaying) {
          video.pause();
        }
      }
    };

    const handleLoadedMetadata = () => {
      const duration = video.duration || 10;
      setVideoDuration(duration);
      setCropStart(0);
      setCropEnd(duration);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [cropStart, cropEnd, isPlaying]);

  // Handle Play/Pause
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // If playhead is out of crop bounds, reset to crop start
      if (video.currentTime < cropStart || video.currentTime >= cropEnd) {
        video.currentTime = cropStart;
      }
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(err => console.log('Playback error:', err));
    }
  };

  const handleReset = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = cropStart;
    setCurrentTime(cropStart);
  };

  // Video Upload helper
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setIsPlaying(false);
    }
  };

  // Preset Template Adder
  const handleAddPreset = (preset) => {
    // Generate unique ID
    const newId = `${preset.id}-${Date.now()}`;
    const newOverlay = {
      id: newId,
      name: preset.name,
      text: preset.defaultText,
      start: parseFloat((currentTime).toFixed(1)),
      duration: preset.defaultDuration,
      fontSize: preset.defaultFontSize,
      textColor: preset.defaultTextColor,
      accentColor: preset.defaultAccentColor,
      x: preset.defaultX,
      y: preset.defaultY,
      trackIndex: overlays.length + 1,
      animationType: preset.animationType
    };

    // Clamp timing bounds inside video duration
    if (newOverlay.start + newOverlay.duration > videoDuration) {
      newOverlay.duration = Math.max(1, videoDuration - newOverlay.start);
    }

    setOverlays([...overlays, newOverlay]);
    setSelectedOverlayId(newId);
  };

  // Property Editor change handler
  const handleUpdateOverlay = (key, value) => {
    setOverlays(prev => prev.map(o => {
      if (o.id === selectedOverlayId) {
        return { ...o, [key]: value };
      }
      return o;
    }));
  };

  const handleDeleteOverlay = (id) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
    if (selectedOverlayId === id) {
      setSelectedOverlayId(null);
    }
  };

  // On-canvas dragging handler
  const handleOverlayMouseDown = (e, overlayId) => {
    e.preventDefault();
    setSelectedOverlayId(overlayId);
    
    const container = playerContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    
    const handleMouseMove = (moveEvent) => {
      const newX = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const newY = ((moveEvent.clientY - rect.top) / rect.height) * 100;
      
      const clampedX = Math.max(0, Math.min(100, Math.round(newX)));
      const clampedY = Math.max(0, Math.min(100, Math.round(newY)));
      
      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, x: clampedX, y: clampedY } : o));
    };
    
    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Scrub bar helper
  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Exporter activation
  const handleExport = async () => {
    if (!videoRef.current) return;
    setIsExporting(true);
    setExportProgress(0);

    // Render configuration resolution based on aspect ratio choice
    let renderWidth = 1920;
    let renderHeight = 1080;
    if (aspectRatio === 'portrait') {
      renderWidth = 1080;
      renderHeight = 1920;
    } else if (aspectRatio === 'square') {
      renderWidth = 1080;
      renderHeight = 1080;
    }

    try {
      const result = await exportVideo({
        videoElement: videoRef.current,
        overlays: overlays,
        startTime: cropStart,
        endTime: cropEnd,
        width: renderWidth,
        height: renderHeight,
        onProgress: (progress) => {
          setExportProgress(progress);
        }
      });

      // Download compiled blob
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Video export failed. Make sure your browser supports MediaRecorder canvas capture.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Generated code selector helper
  const getGeneratedCode = () => {
    if (!selectedOverlay) return '// Select an overlay preset to generate code';
    
    const template = PRESET_TEMPLATES.find(t => t.animationType === selectedOverlay.animationType);
    if (!template) return '// Template not found';

    if (activeCodeTab === 'hyperframes') {
      return template.hyperframeCode(selectedOverlay);
    } else {
      return template.remotionCode(selectedOverlay);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getGeneratedCode());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="app-container">
      {/* HEADER SECTION */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="brand-name">MotionForge AI</span>
          <span style={{ fontSize: '10px', background: 'hsl(var(--accent-purple)/0.2)', color: 'hsl(var(--accent-purple))', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
            HYPERFRAMES & REMOTION
          </span>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Aspect Ratio Selector */}
          <div style={{ display: 'flex', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px', padding: '2px' }}>
            <button 
              className={`control-btn ${aspectRatio === 'landscape' ? 'active-play' : ''}`} 
              onClick={() => setAspectRatio('landscape')}
              title="Landscape 16:9"
              style={{ width: '28px', height: '28px', borderRadius: '6px' }}
            >
              <Monitor size={14} />
            </button>
            <button 
              className={`control-btn ${aspectRatio === 'portrait' ? 'active-play' : ''}`} 
              onClick={() => setAspectRatio('portrait')}
              title="Portrait 9:16 (Reels/Shorts)"
              style={{ width: '28px', height: '28px', borderRadius: '6px' }}
            >
              <Smartphone size={14} />
            </button>
            <button 
              className={`control-btn ${aspectRatio === 'square' ? 'active-play' : ''}`} 
              onClick={() => setAspectRatio('square')}
              title="Square 1:1"
              style={{ width: '28px', height: '28px', borderRadius: '6px' }}
            >
              <Crop size={14} />
            </button>
          </div>

          <button 
            className="action-btn"
            onClick={() => setActiveRightTab('export')}
          >
            <Download size={14} />
            Export Render
          </button>
        </div>
      </header>

      {/* WORKSPACE CONTENT */}
      <div className="app-workspace">
        
        {/* LEFT SIDEBAR - Videos and Graphic Presets */}
        <aside className="sidebar-left">
          {/* Media Section */}
          <div>
            <h3 className="sidebar-title">
              <Video size={14} />
              1. Video Assets
            </h3>
            
            {/* Custom Upload Card */}
            <div className="upload-card" onClick={() => fileInputRef.current?.click()}>
              <Upload size={20} style={{ color: 'hsl(var(--accent-purple))' }} />
              <div>
                <p style={{ fontWeight: '600', fontSize: '12px' }}>Upload local video</p>
                <p style={{ fontSize: '10px', color: 'hsl(var(--text-muted))' }}>MP4, WebM or MOV</p>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleVideoUpload} 
                accept="video/*" 
                style={{ display: 'none' }} 
              />
            </div>

            {/* Preloaded Samples List */}
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginBottom: '8px', fontWeight: 'bold' }}>Sample library</p>
              <div className="media-grid">
                {SAMPLE_VIDEOS.map((item) => (
                  <div 
                    key={item.id} 
                    className={`media-item ${videoUrl === item.url ? 'active' : ''}`}
                    onClick={() => {
                      setVideoUrl(item.url);
                      setIsPlaying(false);
                    }}
                  >
                    <img src={item.thumbnail} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div className="media-item-label">
                      <span>{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Graphic Presets List */}
          <div>
            <h3 className="sidebar-title">
              <Sparkles size={14} />
              2. Add Graphics
            </h3>
            <div className="presets-list">
              {PRESET_TEMPLATES.map((preset) => (
                <div 
                  key={preset.id} 
                  className="preset-card"
                  onClick={() => handleAddPreset(preset)}
                >
                  <div className="preset-info">
                    <span className="preset-name">{preset.name}</span>
                    <span className="preset-desc">{preset.description}</span>
                  </div>
                  <span className="preset-preview-badge">
                    {preset.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER PLAYER & TIMELINE BAR */}
        <main className="center-work-area">
          {/* Canvas Preview Area */}
          <div className="canvas-viewport">
            <div className={`player-container ${aspectRatio}`} ref={playerContainerRef}>
              <video 
                ref={videoRef}
                src={videoUrl}
                className="main-video"
                playsInline
                muted
              />

              {/* Overlays Canvas layer */}
              <div className="canvas-overlays-container">
                {overlays.map((overlay) => {
                  const active = currentTime >= overlay.start && currentTime <= (overlay.start + overlay.duration);
                  if (!active) return null;

                  const overlayStyles = {
                    left: `${overlay.x}%`,
                    top: `${overlay.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.textColor,
                    fontFamily: overlay.animationType === 'cyberpunk' ? 'Space Grotesk, monospace' : 'Inter, sans-serif',
                    zIndex: overlay.trackIndex,
                    ...overlay.style
                  };

                  // Inject Accent colors for template preview CSS variables
                  if (overlay.animationType === 'neon') {
                    overlayStyles['--neon-color'] = overlay.accentColor;
                  } else if (overlay.animationType === 'spring') {
                    overlayStyles['backgroundColor'] = overlay.accentColor;
                    overlayStyles['padding'] = '6px 14px';
                    overlayStyles['borderRadius'] = '50px';
                    overlayStyles['whiteSpace'] = 'nowrap';
                  } else if (overlay.animationType === 'cyberpunk') {
                    overlayStyles['borderLeft'] = `4px solid ${overlay.accentColor}`;
                    overlayStyles['backgroundColor'] = 'rgba(0,0,0,0.8)';
                    overlayStyles['padding'] = '6px 12px';
                    overlayStyles['borderRadius'] = '0 4px 4px 0';
                    overlayStyles['textTransform'] = 'uppercase';
                  } else if (overlay.animationType === 'fade') {
                    overlayStyles['transform'] = 'translateX(-50%)';
                    overlayStyles['width'] = '80%';
                    overlayStyles['textAlign'] = 'center';
                  }

                  return (
                    <div
                      key={overlay.id}
                      className={`overlay-element template-${overlay.animationType} ${selectedOverlayId === overlay.id ? 'selected' : ''}`}
                      style={overlayStyles}
                      onMouseDown={(e) => handleOverlayMouseDown(e, overlay.id)}
                    >
                      {overlay.animationType === 'fade' ? (
                        <span style={{ backgroundColor: 'rgba(0,0,0,0.75)', padding: '4px 10px', borderRadius: '6px' }}>
                          {overlay.text}
                        </span>
                      ) : overlay.animationType === 'progress' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '220px' }}>
                          <span style={{ fontSize: '10px' }}>{overlay.text}</span>
                          <div className="template-progress-bar">
                            <div className="template-progress-fill" style={{
                              width: `${Math.min(100, ((currentTime - overlay.start) / overlay.duration) * 100)}%`,
                              background: overlay.accentColor
                            }}></div>
                          </div>
                        </div>
                      ) : (
                        overlay.text
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Overlay Floating Player Controls */}
            <div className="playback-controls">
              <button className="control-btn" onClick={handleReset} title="Reset to Trim Start">
                <RotateCcw size={16} />
              </button>
              <button className={`control-btn ${isPlaying ? 'active-play' : ''}`} onClick={togglePlay}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div className="time-display">
                {currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s
              </div>
            </div>
          </div>

          {/* Timeline & Track Layers Editor */}
          <div className="timeline-panel">
            <div className="timeline-header">
              <div className="timeline-tabs">
                <span className="timeline-tab active">
                  <Layers size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Composition Tracks
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'hsl(var(--text-muted))' }}>Trim limits:</span>
                <input 
                  type="number" 
                  value={cropStart.toFixed(1)} 
                  step="0.5" 
                  min="0" 
                  max={cropEnd}
                  onChange={(e) => setCropStart(Math.max(0, parseFloat(e.target.value)))}
                  style={{ width: '50px', padding: '2px 4px', fontSize: '10px' }} 
                />
                <span style={{ fontSize: '10px' }}>to</span>
                <input 
                  type="number" 
                  value={cropEnd.toFixed(1)} 
                  step="0.5" 
                  min={cropStart} 
                  max={videoDuration}
                  onChange={(e) => setCropEnd(Math.min(videoDuration, parseFloat(e.target.value)))}
                  style={{ width: '50px', padding: '2px 4px', fontSize: '10px' }} 
                />
              </div>
            </div>

            <div className="timeline-body">
              {/* Scrub/Crop Timeline Track */}
              <div className="timeline-track-container">
                <div className="timeline-bar-wrapper">
                  {/* Current Playhead */}
                  <div 
                    className="playhead" 
                    style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                  >
                    <div className="playhead-handle"></div>
                  </div>

                  {/* Crop Trim Region Overlay */}
                  <div 
                    className="timeline-crop-overlay"
                    style={{
                      left: `${(cropStart / videoDuration) * 100}%`,
                      width: `${((cropEnd - cropStart) / videoDuration) * 100}%`
                    }}
                  >
                    <div 
                      className="crop-handle" 
                      title="Trim start limit"
                      style={{ transform: 'translateX(-50%)' }}
                    ></div>
                    <div 
                      className="crop-handle" 
                      title="Trim end limit"
                      style={{ transform: 'translateX(50%)' }}
                    ></div>
                  </div>

                  {/* Range Slider for scrubbing */}
                  <input 
                    type="range"
                    min="0"
                    max={videoDuration}
                    step="0.05"
                    value={currentTime}
                    onChange={handleScrubChange}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer',
                      zIndex: 80
                    }}
                  />
                </div>
              </div>

              {/* Individual Graphic Layers Tracks */}
              <div className="timeline-layers">
                {overlays.map((layer) => {
                  const left = (layer.start / videoDuration) * 100;
                  const width = (layer.duration / videoDuration) * 100;

                  return (
                    <div key={layer.id} className="layer-row">
                      <span className="layer-name">{layer.text || layer.name}</span>
                      <div className="layer-track">
                        <div 
                          className={`layer-block ${selectedOverlayId === layer.id ? 'selected' : ''}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`
                          }}
                          onClick={() => setSelectedOverlayId(layer.id)}
                        >
                          {layer.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {overlays.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', padding: '10px 0', fontSize: '12px' }}>
                    No graphic overlays added yet. Choose a preset template above to enhance video.
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR - Properties, Export, Code View */}
        <aside className="sidebar-right">
          {/* Tab Selector */}
          <div className="tabs-container">
            <button 
              className={`tab-btn ${activeRightTab === 'properties' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('properties')}
            >
              <Settings size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Properties
            </button>
            <button 
              className={`tab-btn ${activeRightTab === 'code' ? 'active' : ''}`}
              onClick={() => setActiveRightTab('code')}
            >
              <Code size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Code Exports
            </button>
          </div>

          <div className="sidebar-tab-content">
            
            {/* PROPERTIES EDITOR PANEL */}
            {activeRightTab === 'properties' && (
              <>
                {selectedOverlay ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyBetween: 'center', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'hsl(var(--accent-purple))' }}>
                        {selectedOverlay.name} Settings
                      </span>
                      <button 
                        onClick={() => handleDeleteOverlay(selectedOverlay.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                      >
                        <Trash2 size={12} />
                        Delete
                      </button>
                    </div>

                    <div className="form-group">
                      <label>Text Content</label>
                      <input 
                        type="text" 
                        value={selectedOverlay.text} 
                        onChange={(e) => handleUpdateOverlay('text', e.target.value)}
                      />
                    </div>

                    <div className="row-inputs">
                      <div className="form-group">
                        <label>Font Size (px)</label>
                        <input 
                          type="number" 
                          min="10"
                          max="120"
                          value={selectedOverlay.fontSize} 
                          onChange={(e) => handleUpdateOverlay('fontSize', parseInt(e.target.value) || 12)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Text Color</label>
                        <input 
                          type="text" 
                          value={selectedOverlay.textColor} 
                          onChange={(e) => handleUpdateOverlay('textColor', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Accent Color</label>
                      <input 
                        type="text" 
                        value={selectedOverlay.accentColor} 
                        onChange={(e) => handleUpdateOverlay('accentColor', e.target.value)}
                      />
                    </div>

                    <div className="row-inputs">
                      <div className="form-group">
                        <label>Start Time (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0"
                          max={videoDuration}
                          value={selectedOverlay.start} 
                          onChange={(e) => handleUpdateOverlay('start', Math.max(0, parseFloat(e.target.value)) || 0)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Duration (s)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          min="0.5"
                          max={videoDuration}
                          value={selectedOverlay.duration} 
                          onChange={(e) => handleUpdateOverlay('duration', Math.max(0.5, parseFloat(e.target.value)) || 1)}
                        />
                      </div>
                    </div>

                    <div className="row-inputs">
                      <div className="form-group">
                        <label>Position X (%)</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={selectedOverlay.x} 
                          onChange={(e) => handleUpdateOverlay('x', parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Position Y (%)</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={selectedOverlay.y} 
                          onChange={(e) => handleUpdateOverlay('y', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>

                    <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', fontStyle: 'italic', marginTop: '10px' }}>
                      💡 Tip: You can drag overlays directly on the canvas player to position them visually.
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 10px', color: 'hsl(var(--text-muted))' }}>
                    <Layers size={24} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p style={{ fontSize: '12px' }}>Select an overlay on the player canvas or timeline to view its properties.</p>
                  </div>
                )}
              </>
            )}

            {/* DUAL CODE EXPORTS PANEL */}
            {activeRightTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px', padding: '2px' }}>
                  <button 
                    className={`control-btn ${activeCodeTab === 'hyperframes' ? 'active-play' : ''}`}
                    onClick={() => setActiveCodeTab('hyperframes')}
                    style={{ flex: 1, height: '28px', fontSize: '11px', borderRadius: '6px' }}
                  >
                    HyperFrames HTML
                  </button>
                  <button 
                    className={`control-btn ${activeCodeTab === 'remotion' ? 'active-play' : ''}`}
                    onClick={() => setActiveCodeTab('remotion')}
                    style={{ flex: 1, height: '28px', fontSize: '11px', borderRadius: '6px' }}
                  >
                    Remotion React
                  </button>
                </div>

                <div className="code-panel">
                  <button className="copy-btn" onClick={handleCopyCode} title="Copy code">
                    {copiedText ? <Check size={14} style={{ color: 'hsl(var(--accent-green))' }} /> : <Copy size={14} />}
                  </button>
                  <code className="code-content">{getGeneratedCode()}</code>
                </div>

                <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                  {activeCodeTab === 'hyperframes' ? (
                    <span>
                      🌐 <strong>HeyGen HyperFrames code:</strong> Timed elements with HTML5 data parameters. Integrates directly into CLI compiler output.
                    </span>
                  ) : (
                    <span>
                      ⚛️ <strong>Remotion React code:</strong> Perfect template syntax ready to paste into your standard Remotion project composition.
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* EXPORT AND BAKE COMPOSITION RENDER PANEL */}
            {activeRightTab === 'export' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Bake & Render Video</h4>
                  <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                    Render the video composition in the client's browser, capturing and combining video tracks, text styling, badges, and progress bar elements.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span>Active Trim:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{(cropEnd - cropStart).toFixed(1)}s</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span>Total Overlays:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{overlays.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Export Dimensions:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {aspectRatio === 'landscape' ? '1920x1080 (16:9)' : aspectRatio === 'portrait' ? '1080x1920 (9:16)' : '1080x1080 (1:1)'}
                    </span>
                  </div>
                </div>

                {isExporting ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>Compositing Frames...</span>
                      <span>{exportProgress}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${exportProgress}%`, height: '100%', background: 'linear-gradient(90deg, hsl(var(--accent-purple)), hsl(var(--accent-cyan)))' }}></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="action-btn"
                    onClick={handleExport}
                    style={{ width: '100%' }}
                  >
                    <Download size={16} />
                    Start Local Browser Compile
                  </button>
                )}
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}
