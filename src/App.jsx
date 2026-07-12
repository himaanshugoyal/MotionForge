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
  VideoOff,
  Globe,
  FileText,
  Database,
  Lock,
  ChevronDown
} from 'lucide-react';
import { PRESET_TEMPLATES, CODE_BOILERPLATES } from './constants/presets';
import { exportVideo } from './utils/exporter';
import { scrapeWebsite, generateAIComposition } from './utils/aiService';
import { parseCSV, mapCSVToTimeline } from './utils/csvParser';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '@hyperframes/player';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SAMPLE_VIDEOS = [
  {
    id: 'sample-dog',
    name: 'Playful Dog',
    url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=150&h=84&q=80'
  },
  {
    id: 'sample-elephants',
    name: 'Elephants Wild',
    url: 'https://res.cloudinary.com/demo/video/upload/elephants.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=150&h=84&q=80'
  },
  {
    id: 'sample-turtle',
    name: 'Sea Turtle Swim',
    url: 'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1559583985-c80d8ad9b29f?auto=format&fit=crop&w=150&h=84&q=80'
  }
];

const MODEL_OPTIONS = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.5-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
};

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
  
  // Tabs Navigation
  const [leftTab, setLeftTab] = useState('assets'); // assets | ai | csv | boilerplates
  const [activeRightTab, setActiveRightTab] = useState('properties'); // properties | code | export
  const [activeCodeTab, setActiveCodeTab] = useState('hyperframes'); // hyperframes | remotion | boilerplate
  
  // API Configurations State
  const [apiProvider, setApiProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [apiModel, setApiModel] = useState('gemini-1.5-flash');
  const [showConfig, setShowConfig] = useState(false);

  // AI Generation Inputs
  const [aiPrompt, setAiPrompt] = useState('Analyze webpage layout and turn it into a product reveal intro video with bold motion titles.');
  const [webpageUrl, setWebpageUrl] = useState('');
  const [rawHtmlPaste, setRawHtmlPaste] = useState('');
  const [scrapedDataText, setScrapedDataText] = useState('');
  const [isCrawling, setIsCrawling] = useState(false);
  const [pdfBase64, setPdfBase64] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // CSV Inputs State
  const [csvContent, setCsvContent] = useState('');
  const [csvTemplate, setCsvTemplate] = useState('captions'); // captions | data-slides
  
  // Boilerplates display code
  const [selectedBoilerplate, setSelectedBoilerplate] = useState(null);

  // Render / Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [copiedText, setCopiedText] = useState(false);

  // HyperFrames Integration State
  const [showHyperFramesPreview, setShowHyperFramesPreview] = useState(false);
  const [hfPreviewUrl, setHfPreviewUrl] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const csvInputRef = useRef(null);

  // Selected Overlay details
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);

  // Sync API model dropdown when provider changes
  useEffect(() => {
    setApiModel(MODEL_OPTIONS[apiProvider][0]);
  }, [apiProvider]);

  // Load API config from localStorage
  useEffect(() => {
    const savedProvider = localStorage.getItem('mf_provider');
    const savedKey = localStorage.getItem('mf_key');
    const savedModel = localStorage.getItem('mf_model');
    if (savedProvider) setApiProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setApiModel(savedModel);
  }, []);

  // Save API config helper
  const handleSaveAPIConfig = () => {
    localStorage.setItem('mf_provider', apiProvider);
    localStorage.setItem('mf_key', apiKey);
    localStorage.setItem('mf_model', apiModel);
    setShowConfig(false);
    alert('API key stored securely in your browser!');
  };

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

  const generateFullCompositionHTML = () => {
    const overlaysHTML = overlays.map(overlay => {
      const template = PRESET_TEMPLATES.find(t => t.animationType === overlay.animationType);
      return template ? template.hyperframeCode(overlay) : '';
    }).join('\n');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HyperFrames Preview</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <style>
    body { margin: 0; background: #000; overflow: hidden; color: #fff; width: 100vw; height: 100vh; }
    .clip { opacity: 0; position: absolute; transform-origin: center; }
    #video-bg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; object-fit: cover; }
  </style>
</head>
<body>
  <div id="root" data-composition-id="preview" data-width="1920" data-height="1080" style="position: relative; width: 100%; height: 100%;">
    <!-- Background Video -->
    <video id="video-bg" class="clip" data-start="0" data-duration="${videoDuration}" src="${videoUrl}" loop muted playsinline></video>
    
    <!-- Graphic Overlays -->
    ${overlaysHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  };

  const toggleHyperFramesPreview = () => {
    if (showHyperFramesPreview) {
      setShowHyperFramesPreview(false);
      if (hfPreviewUrl) URL.revokeObjectURL(hfPreviewUrl);
      setHfPreviewUrl(null);
    } else {
      setHfPreviewUrl(generateFullCompositionHTML());
      setShowHyperFramesPreview(true);
    }
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

  // Website Crawling Handler
  const handleCrawlWebsite = async () => {
    if (!webpageUrl) {
      alert('Please enter a target website URL first!');
      return;
    }
    setIsCrawling(true);
    setScrapedDataText('');
    try {
      const resultText = await scrapeWebsite(webpageUrl);
      setScrapedDataText(resultText);
      alert('Website crawled successfully! Ready to generate composition.');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsCrawling(false);
    }
  };

  // PDF file Base64 parser and text extractor
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPdfFileName(file.name);
      
      const base64Reader = new FileReader();
      base64Reader.onloadend = () => {
        // Strip the mime prefix to get pure base64 bytes
        const base64String = base64Reader.result.split(',')[1];
        setPdfBase64(base64String);
      };
      base64Reader.readAsDataURL(file);

      const bufferReader = new FileReader();
      bufferReader.onloadend = async () => {
        try {
          const typedarray = new Uint8Array(bufferReader.result);
          const loadingTask = pdfjsLib.getDocument({ data: typedarray });
          const pdf = await loadingTask.promise;
          let fullText = '';
          const maxPages = Math.min(pdf.numPages, 10);
          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          const finalPdfText = fullText.trim();
          setPdfText(finalPdfText);
          console.log("Successfully extracted text from PDF. Character count:", finalPdfText.length);
        } catch (err) {
          console.error("Failed to parse PDF text:", err);
          alert("Client-side PDF text extraction failed: " + err.message);
        }
      };
      bufferReader.readAsArrayBuffer(file);
    }
  };

  // Trigger AI Pipeline
  const handleTriggerAI = async () => {
    if (!apiKey) {
      alert('Please configure and save your API Key in settings first!');
      setShowConfig(true);
      return;
    }

    if (pdfBase64 && !pdfText) {
      console.warn("PDF was uploaded but text is empty. Wait for parsing or check for parsing errors.");
    }

    setAiLoading(true);
    try {
      // Use crawled URL text, pasted HTML, or PDF base64 if present
      const combinedPageText = scrapedDataText || rawHtmlPaste;
      
      const composition = await generateAIComposition({
        provider: apiProvider,
        model: apiModel,
        apiKey: apiKey,
        promptText: aiPrompt,
        fileBase64: pdfBase64,
        pdfText: pdfText,
        webpageText: combinedPageText
      });

      // Load parsed visual state into the dashboard
      setAspectRatio(composition.aspectRatio || 'landscape');
      setVideoDuration(composition.videoDuration || 10);
      setOverlays(composition.overlays || []);
      setCropStart(0);
      setCropEnd(composition.videoDuration || 10);
      
      if (composition.overlays.length > 0) {
        setSelectedOverlayId(composition.overlays[0].id);
      }
      
      alert('AI Composition generated successfully! Overlay tracks populated.');
    } catch (err) {
      console.error(err);
      alert(`AI Generation failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Offline CSV upload handler
  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  // Map CSV data to tracks offline
  const handleLoadCSVTimeline = () => {
    if (!csvContent) {
      alert('Please paste CSV content or upload a file first.');
      return;
    }
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      alert('No data rows found in CSV.');
      return;
    }
    const generatedOverlays = mapCSVToTimeline(rows, csvTemplate, videoDuration);
    setOverlays(generatedOverlays);
    if (generatedOverlays.length > 0) {
      setSelectedOverlayId(generatedOverlays[0].id);
    }
    alert(`Imported ${generatedOverlays.length} timed tracks from CSV!`);
  };

  // Boilerplate loader
  const handleLoadBoilerplate = (bp) => {
    setSelectedBoilerplate(bp);
    setActiveRightTab('code');
    setActiveCodeTab('boilerplate');
  };

  // Exporter Activation
  const handleExport = async () => {
    if (!videoRef.current) return;
    setIsExporting(true);
    setExportProgress(0);

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
    if (activeCodeTab === 'boilerplate') {
      return selectedBoilerplate ? selectedBoilerplate.code : '// Select a boilerplate from templates tab';
    }

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
            STUDIO PRO
          </span>
        </div>

        {/* Global Controls */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Key Settings Toggle */}
          <button 
            className="action-btn secondary"
            onClick={() => setShowConfig(!showConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Lock size={14} />
            API Keys
          </button>

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

      {/* API KEYS CONFIGURATION OVERLAY MODAL */}
      {showConfig && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-panel" style={{ width: '420px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>API Configuration</h3>
              <button 
                onClick={() => setShowConfig(false)}
                style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '12px' }}
              >
                Close
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
              Enter your own API key to power layouts directly. Keys are stored locally in your browser cache.
            </p>

            <div className="form-group">
              <label>AI Provider</label>
              <select value={apiProvider} onChange={(e) => setApiProvider(e.target.value)}>
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="claude">Anthropic Claude</option>
              </select>
            </div>

            <div className="form-group">
              <label>Model selection</label>
              <select value={apiModel} onChange={(e) => setApiModel(e.target.value)}>
                {MODEL_OPTIONS[apiProvider].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Secret API Key</label>
              <input 
                type="password" 
                placeholder="Paste API Key here" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            {apiProvider === 'claude' && (
              <p style={{ fontSize: '10px', color: 'hsl(var(--accent-pink))', lineHeight: '1.3' }}>
                ⚠️ Note: Claude direct browser calls are limited by CORS. Gemini or OpenAI is recommended for instant browser results.
              </p>
            )}

            <button className="action-btn" onClick={handleSaveAPIConfig}>
              Save Config
            </button>
          </div>
        </div>
      )}

      {/* WORKSPACE CONTENT */}
      <div className="app-workspace">
        
        {/* LEFT SIDEBAR - Videos, AI, CSV Data and Boilerplates */}
        <aside className="sidebar-left" style={{ padding: '0px' }}>
          {/* Internal Sidebar Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid hsl(var(--border-color))' }}>
            <button 
              className={`tab-btn ${leftTab === 'assets' ? 'active' : ''}`}
              onClick={() => setLeftTab('assets')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Video size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              Assets
            </button>
            <button 
              className={`tab-btn ${leftTab === 'ai' ? 'active' : ''}`}
              onClick={() => setLeftTab('ai')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Sparkles size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              AI Maker
            </button>
            <button 
              className={`tab-btn ${leftTab === 'csv' ? 'active' : ''}`}
              onClick={() => setLeftTab('csv')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Database size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              CSV Data
            </button>
            <button 
              className={`tab-btn ${leftTab === 'boilerplates' ? 'active' : ''}`}
              onClick={() => setLeftTab('boilerplates')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Code size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              Templates
            </button>
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', flex: 1 }}>
            
            {/* ASSETS TAB */}
            {leftTab === 'assets' && (
              <>
                <div>
                  <h3 className="sidebar-title">
                    <Video size={14} />
                    1. Video Assets
                  </h3>
                  
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

                <div>
                  <h3 className="sidebar-title">
                    <Plus size={14} />
                    2. Add Overlay Presets
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
              </>
            )}

            {/* AI ASSISTANT TAB */}
            {leftTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="sidebar-title" style={{ margin: 0 }}>
                    <Sparkles size={14} />
                    AI Timeline Builder
                  </h3>
                  <button 
                    onClick={() => setShowConfig(true)}
                    style={{ background: 'transparent', border: 'none', color: 'hsl(var(--accent-purple))', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                  >
                    Set Keys
                  </button>
                </div>

                {/* Webpage Crawler Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                  <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <Globe size={12} style={{ color: 'hsl(var(--accent-cyan))' }} />
                    Crawl Website Link
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      placeholder="e.g. www.heygen.com" 
                      value={webpageUrl}
                      onChange={(e) => setWebpageUrl(e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', fontSize: '12px' }}
                    />
                    <button 
                      className="action-btn secondary"
                      onClick={handleCrawlWebsite}
                      disabled={isCrawling}
                      style={{ padding: '0 10px', fontSize: '11px' }}
                    >
                      {isCrawling ? 'Crawling...' : 'Crawl'}
                    </button>
                  </div>
                  {scrapedDataText && (
                    <div style={{ fontSize: '10px', color: 'hsl(var(--accent-green))', marginTop: '6px', fontWeight: '600' }}>
                      ✓ Webpage scraped successfully ({scrapedDataText.length} chars)
                    </div>
                  )}
                  
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>Or Paste Raw Page HTML</summary>
                    <textarea 
                      placeholder="Paste webpage text or HTML source code here..."
                      rows="3"
                      value={rawHtmlPaste}
                      onChange={(e) => setRawHtmlPaste(e.target.value)}
                      style={{ width: '100%', marginTop: '6px', background: 'hsl(var(--bg-main))', color: '#fff', fontSize: '11px', border: '1px solid hsl(var(--border-color))', borderRadius: '4px', padding: '6px' }}
                    />
                  </details>
                </div>

                {/* PDF Document Upload */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                  <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <FileText size={12} style={{ color: 'hsl(var(--accent-purple))' }} />
                    PDF Document Input
                  </label>
                  <div 
                    className="upload-card"
                    onClick={() => pdfInputRef.current?.click()}
                    style={{ padding: '12px', cursor: 'pointer' }}
                  >
                    <Upload size={14} style={{ color: 'hsl(var(--accent-purple))' }} />
                    <span style={{ fontSize: '11px', fontWeight: '500' }}>
                      {pdfFileName ? pdfFileName : 'Upload PDF Document'}
                    </span>
                    <input 
                      type="file"
                      ref={pdfInputRef}
                      onChange={handlePdfUpload}
                      accept="application/pdf"
                      style={{ display: 'none' }}
                    />
                  </div>
                </div>

                {/* Prompt Details */}
                <div className="form-group">
                  <label>Creative Goal Prompt</label>
                  <textarea 
                    rows="3"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>

                {aiLoading ? (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '12px', marginBottom: '6px' }}>Generating composition overlays...</div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div className="template-progress-fill" style={{ width: '60%', height: '100%' }}></div>
                    </div>
                  </div>
                ) : (
                  <button className="action-btn" onClick={handleTriggerAI}>
                    <Sparkles size={14} />
                    Generate Cinematic Intro
                  </button>
                )}
              </div>
            )}

            {/* CSV DATA IMPORT TAB */}
            {leftTab === 'csv' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="sidebar-title">
                  <Database size={14} />
                  Spreadsheet CSV Mappings
                </h3>
                <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                  Upload a CSV data sheet. It will automatically space rows across the video duration to create structured graphics.
                </p>

                <div className="upload-card" onClick={() => csvInputRef.current?.click()} style={{ padding: '20px' }}>
                  <Upload size={20} style={{ color: 'hsl(var(--accent-cyan))' }} />
                  <p style={{ fontSize: '12px', fontWeight: 'bold' }}>Load .csv File</p>
                  <input 
                    type="file"
                    ref={csvInputRef}
                    onChange={handleCsvUpload}
                    accept=".csv"
                    style={{ display: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label>Or Paste CSV Text</label>
                  <textarea 
                    rows="4" 
                    placeholder="e.g.&#10;Q1 Sales, $12K&#10;Q2 Sales, $18K&#10;Q3 Sales, $24K" 
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    style={{ fontSize: '11px', fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group">
                  <label>Template Type</label>
                  <select value={csvTemplate} onChange={(e) => setCsvTemplate(e.target.value)}>
                    <option value="captions">Sequential Captions (Subtitles)</option>
                    <option value="data-slides">Progressive Data Slides (Progress Bars)</option>
                  </select>
                </div>

                <button className="action-btn" onClick={handleLoadCSVTimeline}>
                  <Plus size={14} />
                  Generate Data Overlays
                </button>
              </div>
            )}

            {/* BOILERPLATES TEMPLATES TAB */}
            {leftTab === 'boilerplates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 className="sidebar-title">
                  <Code size={14} />
                  Code Boilerplate Templates
                </h3>
                <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                  Select one of the boilerplates to load complete code structures ready for HyperFrames CLI compilation or Remotion projects.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {CODE_BOILERPLATES.map((bp) => (
                    <div 
                      key={bp.id} 
                      className="preset-card"
                      onClick={() => handleLoadBoilerplate(bp)}
                      style={{ borderLeft: `3px solid ${bp.language === 'html' ? 'hsl(var(--accent-purple))' : 'hsl(var(--accent-cyan))'}` }}
                    >
                      <div className="preset-info">
                        <span className="preset-name">{bp.name}</span>
                        <span className="preset-desc">{bp.description}</span>
                      </div>
                      <span className="preset-preview-badge">
                        {bp.language.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* CENTER PLAYER & TIMELINE BAR */}
        <main className="center-work-area">
          {/* Canvas Preview Area */}
          <div className="canvas-viewport">
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
              <button 
                className="action-btn" 
                style={{ background: showHyperFramesPreview ? '#ef4444' : 'hsl(var(--accent-purple))' }}
                onClick={toggleHyperFramesPreview}
              >
                <Sparkles size={14} />
                {showHyperFramesPreview ? 'Exit HyperFrames Player' : 'Live HyperFrames Preview'}
              </button>
            </div>

            {showHyperFramesPreview ? (
              <div className={`player-container ${aspectRatio}`} style={{ display: 'flex', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                <hyperframes-player 
                  src={hfPreviewUrl} 
                  controls 
                  style={{ width: '100%', height: '100%' }}
                ></hyperframes-player>
              </div>
            ) : (
              <>
                <div className={`player-container ${aspectRatio}`} ref={playerContainerRef}>
              <video 
                ref={videoRef}
                src={videoUrl}
                className="main-video"
                playsInline
                muted
                crossOrigin="anonymous"
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
            </>
            )}
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                      💡 Tip: Drag overlay elements directly on the canvas player to visually position them.
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
                    style={{ flex: 1, height: '28px', fontSize: '10px', borderRadius: '6px' }}
                  >
                    HyperFrames HTML
                  </button>
                  <button 
                    className={`control-btn ${activeCodeTab === 'remotion' ? 'active-play' : ''}`}
                    onClick={() => setActiveCodeTab('remotion')}
                    style={{ flex: 1, height: '28px', fontSize: '10px', borderRadius: '6px' }}
                  >
                    Remotion React
                  </button>
                  {selectedBoilerplate && (
                    <button 
                      className={`control-btn ${activeCodeTab === 'boilerplate' ? 'active-play' : ''}`}
                      onClick={() => setActiveCodeTab('boilerplate')}
                      style={{ flex: 1, height: '28px', fontSize: '10px', borderRadius: '6px' }}
                    >
                      Template Code
                    </button>
                  )}
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
                  ) : activeCodeTab === 'remotion' ? (
                    <span>
                      ⚛️ <strong>Remotion React code:</strong> Perfect template syntax ready to paste into your standard Remotion project composition.
                    </span>
                  ) : (
                    <span>
                      📋 <strong>Active Code Boilerplate:</strong> A comprehensive code structure ready to copy-paste.
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
