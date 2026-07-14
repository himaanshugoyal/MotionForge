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
  ChevronDown,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Clapperboard,
  Undo,
  Redo
} from 'lucide-react';
import { PRESET_TEMPLATES, CODE_BOILERPLATES } from './constants/presets';
import { exportVideo } from './utils/exporter';
import { scrapeWebsite, generateAIComposition, briefFromPdfText, enhanceAIPrompt, analyzeSpeechAndGenerateGraphics } from './utils/aiService';
import { parseCSV, mapCSVToTimeline } from './utils/csvParser';
import {
  createProject,
  getProjectDuration,
  projectFromOverlays,
  updateScene,
  reorderScenes,
  duplicateScene,
  removeScene
} from './models/project';
import { createScene } from './models/scene';
import {
  buildCompositionHtml,
  buildCompositionHtmlFromOverlays,
  compositionToBlobUrl,
  prepareHtmlForBrowserPreview
} from './composition/buildCompositionHtml';
import {
  startHyperFramesRender,
  pollRenderUntilDone,
  downloadRender,
  ingestUrl,
  ingestUpload,
  checkApiHealth
} from './utils/apiClient';
import TimelinePanel, { TransportDock, formatTimecode } from './components/TimelinePanel';
import {
  createVideoClip,
  findActiveClip,
  sourceTimeForClip,
  suggestInsertTime,
  duplicateClip,
  trimClipLeft,
  trimClipRight,
  updateClipTrim,
  moveClip,
  splitClipAt,
  getClipsEnd,
  VIDEO_DRAG_MIME
} from './models/videoClip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import '@hyperframes/player';
import { fetchAndDecodePeaks, detectAudioSegments, extractAudioAsWavBase64 } from './utils/audioWaveform';
import toast, { Toaster } from 'react-hot-toast';

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
  gemini: ['gemini-2.5-flash', 'gemini-2.0-flash'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
  claude: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229']
};

const DEFAULT_MODELS = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-5',
  claude: 'claude-3-5-sonnet-20241022'
};

const AUTO_GFX_GEMINI_MODEL = DEFAULT_MODELS.gemini;

function getDefaultModelForProvider(provider) {
  return DEFAULT_MODELS[provider] || MODEL_OPTIONS[provider]?.[0] || '';
}

function getValidModelForProvider(provider, model) {
  const available = MODEL_OPTIONS[provider] || [];
  return available.includes(model) ? model : getDefaultModelForProvider(provider);
}

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
  const [leftTab, setLeftTab] = useState('assets'); // assets | ai | scenes | csv | boilerplates
  const [activeRightTab, setActiveRightTab] = useState('properties'); // properties | code | export
  const [activeCodeTab, setActiveCodeTab] = useState('hyperframes'); // hyperframes | remotion | boilerplate
  
  // API Configurations State
  const [apiProvider, setApiProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState(() => {
    return import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('mf_key') || '';
  });
  const [apiModel, setApiModel] = useState(() => getDefaultModelForProvider('gemini'));
  const [showConfig, setShowConfig] = useState(false);
  const [timelineVisibility, setTimelineVisibility] = useState({
    videoTrack: true,
    scenesTrack: true,
    overlays: {}
  });

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
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const [contentBrief, setContentBrief] = useState(null);
  const [screenshotAsset, setScreenshotAsset] = useState(null);
  const [imageBase64, setImageBase64] = useState('');
  const [imageMimeType, setImageMimeType] = useState('image/png');
  const [serverOnline, setServerOnline] = useState(false);

  // Multi-scene HyperFrames project
  const [project, setProject] = useState(() => createProject({
    name: 'MotionForge Project',
    aspectRatio: 'landscape',
    scenes: [
      createScene({ title: 'CREATIVE REEL', subtitle: 'MotionForge HyperFrames', template: 'title-card', duration: 3.5 }),
      createScene({ title: 'What you get', template: 'bullet-explainer', bullets: ['Document & URL ingest', 'Editable scenes', 'Frame-accurate MP4'], duration: 5 }),
      createScene({ title: 'Ship the story', subtitle: 'Export MP4', template: 'cta-outro', duration: 3 })
    ]
  }));
  const [selectedSceneId, setSelectedSceneId] = useState(null);
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [videoClips, setVideoClips] = useState([]);
  const [selectedVideoClipId, setSelectedVideoClipId] = useState(null);
  const [selectedVideoClipIds, setSelectedVideoClipIds] = useState([]);
  const [isRippleEnabled, setIsRippleEnabled] = useState(true);
  const activeClipIdRef = useRef(null);
  const videoClipsRef = useRef(videoClips);
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  videoClipsRef.current = videoClips;
  isPlayingRef.current = isPlaying;
  currentTimeRef.current = currentTime;

  // Undo/Redo History State
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const lastSavedStateRef = useRef(null);
  const timeoutRef = useRef(null);
  const isUndoRedoRef = useRef(false);

  // Initialize the last saved state ref
  useEffect(() => {
    if (!lastSavedStateRef.current) {
      lastSavedStateRef.current = {
        project,
        videoClips,
        overlays,
        aspectRatio,
        videoUrl
      };
    }
  }, [project, videoClips, overlays, aspectRatio, videoUrl]);

  // Watch for state changes to save to history (with debounce)
  useEffect(() => {
    if (isUndoRedoRef.current) return;

    const currentState = {
      project,
      videoClips,
      overlays,
      aspectRatio,
      videoUrl
    };

    if (!lastSavedStateRef.current) {
      lastSavedStateRef.current = currentState;
      return;
    }

    const changed = 
      project !== lastSavedStateRef.current.project ||
      videoClips !== lastSavedStateRef.current.videoClips ||
      overlays !== lastSavedStateRef.current.overlays ||
      aspectRatio !== lastSavedStateRef.current.aspectRatio ||
      videoUrl !== lastSavedStateRef.current.videoUrl;

    if (!changed) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const stateToPush = lastSavedStateRef.current;
      setPast(prev => [...prev.slice(-99), stateToPush]);
      setFuture([]); // Clear redo stack on new action
      lastSavedStateRef.current = currentState;
      timeoutRef.current = null;
    }, 500);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [project, videoClips, overlays, aspectRatio, videoUrl]);

  // Forces any pending debounced change to be committed immediately
  const commitPendingHistory = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      const stateToPush = lastSavedStateRef.current;
      setPast(prev => [...prev.slice(-99), stateToPush]);
      setFuture([]);
      // Sync last saved state to the current state
      lastSavedStateRef.current = {
        project,
        videoClips,
        overlays,
        aspectRatio,
        videoUrl
      };
    }
  };

  const handleUndo = () => {
    if (past.length === 0) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    isUndoRedoRef.current = true;

    const previousState = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentState = {
      project,
      videoClips,
      overlays,
      aspectRatio,
      videoUrl
    };

    setPast(newPast);
    setFuture(prev => [currentState, ...prev]);

    setProject(previousState.project);
    setVideoClips(previousState.videoClips);
    setOverlays(previousState.overlays);
    setAspectRatio(previousState.aspectRatio);
    setVideoUrl(previousState.videoUrl);

    lastSavedStateRef.current = previousState;

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  };

  const handleRedo = () => {
    if (future.length === 0) return;

    isUndoRedoRef.current = true;

    const nextState = future[0];
    const newFuture = future.slice(1);
    const currentState = {
      project,
      videoClips,
      overlays,
      aspectRatio,
      videoUrl
    };

    setPast(prev => [...prev, currentState]);
    setFuture(newFuture);

    setProject(nextState.project);
    setVideoClips(nextState.videoClips);
    setOverlays(nextState.overlays);
    setAspectRatio(nextState.aspectRatio);
    setVideoUrl(nextState.videoUrl);

    lastSavedStateRef.current = nextState;

    setTimeout(() => {
      isUndoRedoRef.current = false;
    }, 0);
  };

  // CSV Inputs State
  const [csvContent, setCsvContent] = useState('');
  const [csvTemplate, setCsvTemplate] = useState('captions'); // captions | data-slides
  
  // Boilerplates display code
  const [selectedBoilerplate, setSelectedBoilerplate] = useState(null);

  // Render / Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [copiedText, setCopiedText] = useState(false);
  const [isHfRendering, setIsHfRendering] = useState(false);
  const [hfRenderProgress, setHfRenderProgress] = useState(0);
  const [hfRenderStatus, setHfRenderStatus] = useState('');

  // HyperFrames Integration State
  const [showHyperFramesPreview, setShowHyperFramesPreview] = useState(false);
  const [hfPreviewUrl, setHfPreviewUrl] = useState(null);

  // Refs
  const hfPlayerRef = useRef(null);
  const videoRef = useRef(null);
  const playerContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const screenshotInputRef = useRef(null);
  const loadingUrlsRef = useRef(new Set());
  const isMountedRef = useRef(true);

  // Selected Overlay / Video clip details
  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId);
  const selectedScene = (project.scenes || []).find((s) => s.id === selectedSceneId) || project.scenes?.[0];
  const selectedVideoClip = videoClips.find((c) => c.id === selectedVideoClipId) || null;
  const activeSelectedVideoClips = selectedVideoClipIds
    .map((id) => videoClips.find((c) => c.id === id))
    .filter(Boolean);

  const compositionDuration = Math.max(
    getClipsEnd(videoClips),
    getProjectDuration(project),
    videoClips.length ? 0 : videoDuration,
    cropEnd,
    0.1
  );

  const isOverlayVisibleInTimeline = (overlayId) => timelineVisibility.overlays[overlayId] !== false;

  const toggleVideoTrackVisibility = () => {
    setTimelineVisibility((prev) => ({
      ...prev,
      videoTrack: !prev.videoTrack
    }));
  };

  const toggleScenesTrackVisibility = () => {
    setTimelineVisibility((prev) => ({
      ...prev,
      scenesTrack: !prev.scenesTrack
    }));
  };

  const toggleOverlayVisibility = (overlayId) => {
    setTimelineVisibility((prev) => ({
      ...prev,
      overlays: {
        ...prev.overlays,
        [overlayId]: prev.overlays[overlayId] === false ? true : false
      }
    }));
  };

  const handleProviderChange = (nextProvider) => {
    setApiProvider(nextProvider);
    setApiModel(getDefaultModelForProvider(nextProvider));
  };

  const resolveApiModel = () => {
    const validModel = getValidModelForProvider(apiProvider, apiModel);
    if (validModel !== apiModel) {
      setApiModel(validModel);
    }
    return validModel;
  };

  // Sync API model dropdown and API key when provider changes
  useEffect(() => {
    const envKey = 
      apiProvider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY :
      apiProvider === 'openai' ? import.meta.env.VITE_OPENAI_API_KEY :
      apiProvider === 'claude' ? import.meta.env.VITE_CLAUDE_API_KEY : '';
    if (envKey) {
      setApiKey(envKey);
    } else {
      setApiKey(localStorage.getItem('mf_key') || '');
    }
  }, [apiProvider]);

  // Load API config from localStorage
  useEffect(() => {
    const savedProvider = localStorage.getItem('mf_provider');
    const savedKey = localStorage.getItem('mf_key');
    const savedModel = localStorage.getItem('mf_model');

    const provider = MODEL_OPTIONS[savedProvider] ? savedProvider : 'gemini';
    const model = getValidModelForProvider(provider, savedModel);

    setApiProvider(provider);
    setApiModel(model);

    const envKey = 
      provider === 'gemini' ? import.meta.env.VITE_GEMINI_API_KEY :
      provider === 'openai' ? import.meta.env.VITE_OPENAI_API_KEY :
      provider === 'claude' ? import.meta.env.VITE_CLAUDE_API_KEY : '';
    if (envKey) {
      setApiKey(envKey);
    } else if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Probe render API health
  useEffect(() => {
    checkApiHealth()
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, []);

  // Mount state tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load audio peaks/waveforms for video clips dynamically
  useEffect(() => {
    const loadWaveforms = async () => {
      const missingClips = videoClips.filter(
        (c) => c.peaks === null && c.url && !loadingUrlsRef.current.has(c.id)
      );
      if (missingClips.length === 0) return;

      for (const clip of missingClips) {
        loadingUrlsRef.current.add(clip.id);

        // Set intermediate loading state
        setVideoClips((prev) =>
          prev.map((c) => (c.id === clip.id ? { ...c, peaks: 'loading' } : c))
        );

        fetchAndDecodePeaks(clip.url, 100)
          .then((peaks) => {
            if (!isMountedRef.current) return;
            loadingUrlsRef.current.delete(clip.id);
            setVideoClips((prev) =>
              prev.map((c) => (c.id === clip.id ? { ...c, peaks: peaks || [] } : c))
            );
          })
          .catch((err) => {
            if (!isMountedRef.current) return;
            loadingUrlsRef.current.delete(clip.id);
            setVideoClips((prev) =>
              prev.map((c) => (c.id === clip.id ? { ...c, peaks: [] } : c))
            );
          });
      }
    };
    loadWaveforms();
  }, [videoClips]);

  // Keep selected scene in sync
  useEffect(() => {
    if (!selectedSceneId && project.scenes?.[0]) {
      setSelectedSceneId(project.scenes[0].id);
    }
  }, [project.scenes, selectedSceneId]);

  // Keep selected clip ids in sync when clips are removed/replaced
  useEffect(() => {
    const clipIdSet = new Set(videoClips.map((c) => c.id));
    setSelectedVideoClipIds((prev) => prev.filter((id) => clipIdSet.has(id)));

    if (selectedVideoClipId && !clipIdSet.has(selectedVideoClipId)) {
      setSelectedVideoClipId(null);
    }
  }, [videoClips, selectedVideoClipId]);

  // Prune stale per-overlay visibility entries when overlays are removed/replaced
  useEffect(() => {
    const overlayIdSet = new Set(overlays.map((o) => o.id));
    setTimelineVisibility((prev) => {
      const staleIds = Object.keys(prev.overlays).filter((id) => !overlayIdSet.has(id));
      if (!staleIds.length) return prev;

      const nextOverlaysVisibility = { ...prev.overlays };
      staleIds.forEach((id) => delete nextOverlaysVisibility[id]);
      return {
        ...prev,
        overlays: nextOverlaysVisibility
      };
    });
  }, [overlays]);

  // Keep project aspect / background video aligned with editor
  useEffect(() => {
    setProject((prev) => ({
      ...prev,
      aspectRatio,
      backgroundVideoUrl: videoUrl,
      updatedAt: new Date().toISOString()
    }));
  }, [aspectRatio, videoUrl]);

  // Save API config helper
  const handleSaveAPIConfig = () => {
    const normalizedProvider = MODEL_OPTIONS[apiProvider] ? apiProvider : 'gemini';
    const normalizedModel = getValidModelForProvider(normalizedProvider, apiModel);

    if (normalizedProvider !== apiProvider) {
      setApiProvider(normalizedProvider);
    }
    if (normalizedModel !== apiModel) {
      setApiModel(normalizedModel);
    }

    localStorage.setItem('mf_provider', normalizedProvider);
    localStorage.setItem('mf_key', apiKey);
    localStorage.setItem('mf_model', normalizedModel);
    setShowConfig(false);
    toast.success('API key stored securely in your browser!');
  };

  // Bind video element — map source time → timeline when clips exist
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const clips = videoClipsRef.current;
      if (clips.length > 0) {
        const clip =
          clips.find((c) => c.id === activeClipIdRef.current) ||
          findActiveClip(clips, currentTimeRef.current);
        if (!clip) return;

        const local = video.currentTime - clip.sourceIn;
        setCurrentTime(clip.timelineStart + Math.max(0, local));

        if (video.currentTime >= clip.sourceOut - 0.04 && isPlayingRef.current) {
          const next = clips
            .filter((c) => c.timelineStart >= clip.timelineStart + clip.duration - 0.01 && c.id !== clip.id)
            .sort((a, b) => a.timelineStart - b.timelineStart)[0];
          if (next) {
            activeClipIdRef.current = next.id;
            const playNext = () => {
              video.currentTime = next.sourceIn;
              video.play().catch(() => {});
            };
            if (video.getAttribute('src') !== next.url) {
              video.src = next.url;
              video.load();
              video.addEventListener('loadeddata', function onReady() {
                playNext();
                video.removeEventListener('loadeddata', onReady);
              });
              setVideoUrl(next.url);
            } else {
              playNext();
            }
            setCurrentTime(next.timelineStart);
          } else {
            video.pause();
            setIsPlaying(false);
            setCurrentTime(clip.timelineStart + clip.duration);
          }
        }
        return;
      }
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (videoClipsRef.current.length > 0) return;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
      setVideoDuration(duration);
      setCropStart(0);
      setCropEnd(duration);
      setCurrentTime(0);
      video.currentTime = 0;
    };

    const handleError = () => {
      console.error('Video failed to load', video.error);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('error', handleError);

    if (videoClipsRef.current.length === 0 && video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl, showHyperFramesPreview]);

  // Resolve active timeline clip → drive monitor src / seek (Canvas scrub / idle)
  useEffect(() => {
    if (showHyperFramesPreview || videoClips.length === 0) return;
    const video = videoRef.current;
    if (!video) return;

    const clip = findActiveClip(videoClips, currentTime);
    if (!clip) {
      activeClipIdRef.current = null;
      return;
    }

    const target = sourceTimeForClip(clip, currentTime);
    const srcAttr = video.getAttribute('src');

    if (activeClipIdRef.current !== clip.id || srcAttr !== clip.url) {
      activeClipIdRef.current = clip.id;
      if (srcAttr !== clip.url) {
        const wasPlaying = isPlaying && !video.paused;
        video.src = clip.url;
        video.load();
        video.addEventListener('loadeddata', function onReady() {
          video.currentTime = target;
          if (wasPlaying) video.play().catch(() => {});
          video.removeEventListener('loadeddata', onReady);
        });
        if (videoUrl !== clip.url) setVideoUrl(clip.url);
        return;
      }
    }

    if (!isPlaying && Math.abs(video.currentTime - target) > 0.12) {
      video.currentTime = target;
    }
  }, [currentTime, videoClips, showHyperFramesPreview, isPlaying, videoUrl]);

  // Loop within trim range while playing (legacy single-video mode only)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || videoClips.length > 0) return;

    const onTimeUpdate = () => {
      if (video.currentTime >= cropEnd) {
        video.currentTime = cropStart;
      }
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [isPlaying, cropStart, cropEnd, videoClips.length]);

  // Extend master out-point when clips grow past it
  useEffect(() => {
    const end = getClipsEnd(videoClips);
    if (end > 0 && end > cropEnd) {
      setCropEnd(end);
    }
  }, [videoClips, cropEnd]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (showHyperFramesPreview) {
      if (hfPlayerRef.current) {
        if (isPlaying) {
          hfPlayerRef.current.pause();
          setIsPlaying(false);
        } else {
          hfPlayerRef.current.play();
          setIsPlaying(true);
        }
      }
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    if (videoClips.length > 0) {
      const clip = findActiveClip(videoClips, currentTime) || videoClips.slice().sort((a, b) => a.timelineStart - b.timelineStart)[0];
      if (!clip) return;
      if (currentTime < clip.timelineStart || currentTime >= clip.timelineStart + clip.duration) {
        setCurrentTime(clip.timelineStart);
      }
      activeClipIdRef.current = clip.id;
      const seekTo = sourceTimeForClip(clip, Math.max(currentTime, clip.timelineStart));
      const startPlay = () => {
        video.currentTime = seekTo;
        video.play().then(() => setIsPlaying(true)).catch((err) => console.log('Playback error:', err));
      };
      if (video.getAttribute('src') !== clip.url) {
        video.src = clip.url;
        video.load();
        video.addEventListener('loadeddata', function onReady() {
          startPlay();
          video.removeEventListener('loadeddata', onReady);
        });
        setVideoUrl(clip.url);
      } else {
        startPlay();
      }
      return;
    }

    if (video.currentTime < cropStart || video.currentTime >= cropEnd) {
      video.currentTime = cropStart;
    }
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(err => console.log('Playback error:', err));
  };

  const handleReset = () => {
    if (showHyperFramesPreview) {
      if (hfPlayerRef.current) {
        hfPlayerRef.current.pause();
        try { hfPlayerRef.current.currentTime = 0; } catch (e) {}
      }
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }

    const video = videoRef.current;
    if (videoClips.length > 0) {
      const first = videoClips.slice().sort((a, b) => a.timelineStart - b.timelineStart)[0];
      const t = first ? first.timelineStart : cropStart;
      setCurrentTime(t);
      if (video && first) {
        activeClipIdRef.current = first.id;
        if (video.getAttribute('src') !== first.url) {
          video.src = first.url;
          setVideoUrl(first.url);
        }
        video.currentTime = first.sourceIn;
      }
      return;
    }
    if (!video) return;
    video.currentTime = cropStart;
    setCurrentTime(cropStart);
  };

  const getCompositionHtmlString = (forPreview = false) => {
    const baseUrl = forPreview && typeof window !== 'undefined' ? window.location.origin : '';
    const hasScenes = Array.isArray(project.scenes) && project.scenes.length > 0
      && project.scenes.some((s) => s.template !== 'legacy-overlays');

    let html;
    if (hasScenes) {
      html = buildCompositionHtml({
        ...project,
        aspectRatio,
        backgroundVideoUrl: null
      }, { baseUrl });
    } else {
      html = buildCompositionHtmlFromOverlays({
        overlays,
        videoUrl,
        videoDuration,
        aspectRatio,
        name: project.name,
        baseUrl
      });
    }

    return forPreview ? prepareHtmlForBrowserPreview(html, baseUrl) : html;
  };

  const generateFullCompositionHTML = () => {
    return compositionToBlobUrl(getCompositionHtmlString(true));
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

  const refreshHyperFramesPreview = () => {
    if (hfPreviewUrl) URL.revokeObjectURL(hfPreviewUrl);
    const url = generateFullCompositionHTML();
    setHfPreviewUrl(url);
    setShowHyperFramesPreview(true);
  };

  // Video Upload helper — switch to Canvas, list the file, load blob without CORS flag
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    // allow re-uploading the same file later
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      toast.error('Please choose a video file (MP4, WebM, or MOV).');
      return;
    }

    const url = URL.createObjectURL(file);
    const id = `upload-${Date.now()}`;
    const entry = {
      id,
      name: file.name.replace(/\.[^.]+$/, '') || file.name,
      url,
      thumbnail: null,
      fileName: file.name,
      sourceDuration: null
    };

    setUploadedVideos((prev) => [entry, ...prev]);
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);

    // Exit HyperFrames so the uploaded clip is visible on the program monitor
    if (showHyperFramesPreview) {
      if (hfPreviewUrl) URL.revokeObjectURL(hfPreviewUrl);
      setHfPreviewUrl(null);
      setShowHyperFramesPreview(false);
    }

    // Probe duration even before the monitor video element binds
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    probe.onloadedmetadata = () => {
      const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 10;
      setVideoDuration(duration);
      setCropStart(0);
      setCropEnd((prev) => Math.max(prev, duration));
      setUploadedVideos((prev) =>
        prev.map((v) => (v.id === id ? { ...v, sourceDuration: duration } : v))
      );
      // Capture a thumbnail frame for the assets library
      try {
        probe.currentTime = Math.min(0.25, duration / 4);
      } catch {
        /* ignore */
      }
    };
    probe.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(probe, 0, 0, 160, 90);
        const thumb = canvas.toDataURL('image/jpeg', 0.7);
        setUploadedVideos((prev) =>
          prev.map((v) => (v.id === id ? { ...v, thumbnail: thumb } : v))
        );
      } catch {
        /* codec may block canvas read */
      }
    };
  };

  const selectVideoAsset = (url) => {
    setVideoUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    if (showHyperFramesPreview) {
      if (hfPreviewUrl) URL.revokeObjectURL(hfPreviewUrl);
      setHfPreviewUrl(null);
      setShowHyperFramesPreview(false);
    }
  };

  const probeSourceDuration = (url) =>
    new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.src = url;
      v.onloadedmetadata = () => {
        resolve(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10);
      };
      v.onerror = () => resolve(10);
    });

  const exitHyperFramesForCanvas = () => {
    if (!showHyperFramesPreview) return;
    if (hfPreviewUrl) URL.revokeObjectURL(hfPreviewUrl);
    setHfPreviewUrl(null);
    setShowHyperFramesPreview(false);
  };

  /** Insert a library asset onto the Video (V1) track */
  const insertVideoClip = async (asset, timelineStart = null) => {
    commitPendingHistory();
    if (!asset?.url) return null;
    const start =
      timelineStart != null
        ? Math.max(0, timelineStart)
        : suggestInsertTime(videoClipsRef.current, currentTimeRef.current);

    let sourceDuration = Number(asset.sourceDuration);
    if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) {
      sourceDuration = await probeSourceDuration(asset.url);
    }

    const clip = createVideoClip({
      assetId: asset.id || asset.assetId || null,
      name: asset.name || 'Video Clip',
      url: asset.url,
      timelineStart: start,
      sourceDuration,
      sourceIn: 0,
      sourceOut: sourceDuration
    });

    setVideoClips((prev) => [...prev, clip]);
    setSelectedVideoClipId(clip.id);
    setSelectedVideoClipIds([clip.id]);
    setSelectedOverlayId(null);
    setVideoUrl(asset.url);
    setIsPlaying(false);
    setCurrentTime(start);
    exitHyperFramesForCanvas();
    return clip;
  };

  const handleDropVideo = (payload, timelineStart) => {
    insertVideoClip(payload, timelineStart);
  };

  const handleAddAssetToTimeline = (e, asset) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    insertVideoClip(asset);
  };

  const handleAssetDragStart = (e, asset) => {
    const payload = JSON.stringify({
      url: asset.url,
      name: asset.name,
      sourceDuration: asset.sourceDuration || null,
      assetId: asset.id,
      id: asset.id
    });
    e.dataTransfer.setData(VIDEO_DRAG_MIME, payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleTrimVideoClip = (clipId, edge, delta, origin) => {
    setVideoClips((prev) => {
      let durationDiff = 0;
      let targetClipStart = 0;
      
      const newClips = prev.map((c) => {
        if (c.id !== clipId) return c;
        const base = origin || c;
        const newClip = edge === 'left' ? trimClipLeft(base, delta) : trimClipRight(base, delta);
        durationDiff = newClip.duration - base.duration;
        targetClipStart = base.timelineStart;
        return newClip;
      });

      if (!isRippleEnabled || durationDiff === 0) return newClips;

      return newClips.map(c => {
        if (c.id !== clipId && c.timelineStart > targetClipStart) {
          return { ...c, timelineStart: Math.max(0, c.timelineStart + durationDiff) };
        }
        return c;
      });
    });
  };

  const handleMoveVideoClip = (clipId, newTimelineStart, origin) => {
    setVideoClips((prev) =>
      prev.map((c) => {
        if (c.id !== clipId) return c;
        const base = origin || c;
        return moveClip(base, newTimelineStart);
      })
    );
  };

  const handleAutoGenerateGraphics = async () => {
    const targetClips = activeSelectedVideoClips.length
      ? activeSelectedVideoClips
      : (selectedVideoClipId ? videoClips.filter((c) => c.id === selectedVideoClipId) : []);
    const clipsWithAudio = targetClips.filter((clip) => clip?.url);
    if (!clipsWithAudio.length) return;
    
    if (apiProvider !== 'gemini') {
      toast.error('Auto-GFX requires the Gemini API. Please switch your provider in API Keys settings.');
      return;
    }
    if (!apiKey) {
      toast.error('Please configure your Gemini API Key first.');
      setShowConfig(true);
      return;
    }

    commitPendingHistory();
    setAiLoading(true);

    try {
      let totalGenerated = 0;
      let failedClips = 0;
      const accumulatedOverlays = [];

      for (let i = 0; i < clipsWithAudio.length; i += 1) {
        const clip = clipsWithAudio[i];
        try {
          toast(`Auto-GFX ${i + 1}/${clipsWithAudio.length}: extracting audio`, { icon: '🎧' });
          const audioBase64 = await extractAudioAsWavBase64(clip.url, clip.sourceIn, clip.sourceOut);
          if (!audioBase64) {
            throw new Error('Failed to extract audio from the clip.');
          }

          toast(`Auto-GFX ${i + 1}/${clipsWithAudio.length}: analyzing speech`, { icon: '🧠' });
          const generatedOverlays = await analyzeSpeechAndGenerateGraphics({
            apiKey,
            model: AUTO_GFX_GEMINI_MODEL,
            audioBase64
          });

          if (!generatedOverlays || generatedOverlays.length === 0) {
            continue;
          }

          const mappedOverlays = generatedOverlays.map((o) => ({
            ...o,
            id: `auto-gfx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            start: clip.timelineStart + (o.start || 0)
          }));

          totalGenerated += mappedOverlays.length;
          accumulatedOverlays.push(...mappedOverlays);
        } catch (err) {
          failedClips += 1;
          console.error(err);
        }
      }

      if (accumulatedOverlays.length) {
        setOverlays((prev) => [...prev, ...accumulatedOverlays]);
      }

      if (!totalGenerated) {
        toast.error('AI found no suitable moments for graphics in selected clips.');
      } else {
        toast.success(`Generated ${totalGenerated} synced graphics from ${clipsWithAudio.length} selected clip(s).`);
      }

      if (failedClips > 0) {
        toast.error(`Auto-GFX skipped ${failedClips} clip(s) due to processing errors.`);
      }
      
    } catch (err) {
      console.error(err);
      const errorMessage = err?.message || 'Unknown error';
      if (/not found|not supported|unsupported/i.test(errorMessage)) {
        toast.error(`Auto-GFX failed: selected Gemini model is unavailable. Forced model: ${AUTO_GFX_GEMINI_MODEL}.`);
      } else {
        toast.error(`Auto-GFX failed: ${errorMessage}`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAutoTrimSilence = async () => {
    if (!selectedVideoClipId) return;
    const clip = videoClips.find(c => c.id === selectedVideoClipId);
    if (!clip || !clip.url) return;
    
    commitPendingHistory();
    setAiLoading(true);
    
    try {
      const segments = await detectAudioSegments(clip.url, 0.03, 0.5, 0.2);
      if (!segments || segments.length === 0) {
        toast.error('No distinct silent segments found or audio could not be analyzed.');
        return;
      }
      
      const validSegments = segments
        .filter(s => s.start < clip.sourceOut && s.end > clip.sourceIn)
        .map(s => ({
          start: Math.max(s.start, clip.sourceIn),
          end: Math.min(s.end, clip.sourceOut)
        }));
        
      if (validSegments.length === 0) {
        toast.error('No valid audio segments within the current clip trim range.');
        return;
      }
      
      let currentTimelineOffset = clip.timelineStart;
      const newClips = validSegments.map(seg => {
        const duration = seg.end - seg.start;
        const newClip = createVideoClip({
          ...clip,
          id: undefined,
          sourceIn: seg.start,
          sourceOut: seg.end,
          timelineStart: currentTimelineOffset
        });
        currentTimelineOffset += duration;
        return newClip;
      });
      
      const newTotalDuration = currentTimelineOffset - clip.timelineStart;
      const shiftDelta = clip.duration - newTotalDuration;
      
      setVideoClips(prev => {
        const next = [];
        for (const c of prev) {
          if (c.id === clip.id) {
            next.push(...newClips);
          } else if (c.timelineStart >= clip.timelineStart + clip.duration - 0.01) {
            next.push({ ...c, timelineStart: Math.max(0, c.timelineStart - shiftDelta) });
          } else {
            next.push(c);
          }
        }
        return next;
      });
      
      setSelectedVideoClipId(newClips[0].id);
      setSelectedVideoClipIds(newClips.map((c) => c.id));
      
    } catch (err) {
      console.error(err);
      toast.error('Failed to auto-trim silences: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSplitVideoClip = (atTime = currentTime) => {
    commitPendingHistory();
    const t = Number(atTime);
    const clips = videoClipsRef.current;
    const target =
      (selectedVideoClipId && clips.find((c) => c.id === selectedVideoClipId)) ||
      findActiveClip(clips, t);
    if (!target) return;
    const parts = splitClipAt(target, t);
    if (!parts) return;
    const [left, right] = parts;
    setVideoClips((prev) => {
      const next = [];
      for (const c of prev) {
        if (c.id === target.id) {
          next.push(left, right);
        } else {
          next.push(c);
        }
      }
      return next;
    });
    setSelectedVideoClipId(right.id);
    setSelectedVideoClipIds([right.id]);
    setSelectedOverlayId(null);
    setActiveRightTab('properties');
  };

  const handleDuplicateVideoClip = () => {
    commitPendingHistory();
    if (!selectedVideoClip) return;
    const copy = duplicateClip(selectedVideoClip);
    setVideoClips((prev) => [...prev, copy]);
    setSelectedVideoClipId(copy.id);
    setSelectedVideoClipIds([copy.id]);
    setSelectedOverlayId(null);
  };

  const handleDeleteVideoClip = () => {
    commitPendingHistory();
    if (!selectedVideoClipId) return;
    
    setVideoClips((prev) => {
      const clipToDelete = prev.find(c => c.id === selectedVideoClipId);
      if (!clipToDelete) return prev;
      
      const filtered = prev.filter((c) => c.id !== selectedVideoClipId);
      if (!isRippleEnabled) return filtered;
      
      const shiftAmount = clipToDelete.duration;
      return filtered.map(c => {
        if (c.timelineStart >= clipToDelete.timelineStart) {
          return { ...c, timelineStart: Math.max(0, c.timelineStart - shiftAmount) };
        }
        return c;
      });
    });
    
    setSelectedVideoClipId(null);
    setSelectedVideoClipIds([]);
  };

  const handleUpdateVideoClipField = (key, value) => {
    if (!selectedVideoClipId) return;
    setVideoClips((prev) =>
      prev.map((c) => {
        if (c.id !== selectedVideoClipId) return c;
        if (key === 'sourceIn' || key === 'sourceOut') {
          return updateClipTrim(c, { [key]: parseFloat(value) || 0 });
        }
        if (key === 'timelineStart') {
          return createVideoClip({ ...c, timelineStart: Math.max(0, parseFloat(value) || 0) });
        }
        if (key === 'name') {
          return { ...c, name: value };
        }
        return c;
      })
    );
  };

  const handleSelectVideoClip = (id, options = {}) => {
    const { append = false } = options;

    if (append) {
      setSelectedVideoClipIds((prev) => {
        const exists = prev.includes(id);
        const next = exists ? prev.filter((clipId) => clipId !== id) : [...prev, id];

        if (exists && selectedVideoClipId === id) {
          setSelectedVideoClipId(next[next.length - 1] || null);
        } else {
          setSelectedVideoClipId(id);
        }

        return next;
      });
    } else {
      setSelectedVideoClipId(id);
      setSelectedVideoClipIds([id]);
    }

    setSelectedOverlayId(null);
    setActiveRightTab('properties');
  };

  // Keyboard: Delete clip, D = duplicate, S = split at playhead, Ctrl+Z = undo, Ctrl+Y/Ctrl+Shift+Z = redo
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

      // Ctrl+Z (or Cmd+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Ctrl+Y (or Cmd+Y)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === 's' || e.key === 'S') {
        const clips = videoClipsRef.current;
        if (!clips.length) return;
        e.preventDefault();
        handleSplitVideoClip(currentTimeRef.current);
        return;
      }

      if (!selectedVideoClipId) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteVideoClip();
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDuplicateVideoClip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedVideoClipId, past, future]);

  // Preset Template Adder
  const handleAddPreset = (preset) => {
    commitPendingHistory();
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
    commitPendingHistory();
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

  // Scrub bar helper — timeline clock; clip resolver seeks source media
  const handleScrubChange = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (videoClipsRef.current.length > 0) return;
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && time <= video.duration) {
      video.currentTime = time;
    }
  };

  // Website Crawling Handler — prefers server HyperFrames capture
  const handleCrawlWebsite = async () => {
    if (!webpageUrl) {
      toast.error('Please enter a target website URL first!');
      return;
    }
    setIsCrawling(true);
    setScrapedDataText('');
    try {
      try {
        const result = await ingestUrl(webpageUrl);
        setContentBrief(result.brief);
        setScrapedDataText(
          `URL CAPTURE (${result.captureMethod})\nTitle: ${result.brief.title}\nURL: ${result.brief.url}\n\n` +
          `Bullets:\n${(result.brief.bullets || []).map((b) => `- ${b}`).join('\n')}\n\n` +
          `Sections:\n${(result.brief.sections || []).map((s) => `- ${s.heading}`).join('\n')}\n\n` +
          `Assets: ${(result.brief.assets || []).length} screenshots`
        );
        if (result.brief.assets?.[0]?.path) {
          setScreenshotAsset(result.brief.assets[0]);
        }
        setServerOnline(true);
        toast.success('Website captured via render server. Screenshots + brand tokens ready.');
      } catch (serverErr) {
        console.warn('Server capture failed, falling back to CORS scrape:', serverErr);
        const resultText = await scrapeWebsite(webpageUrl);
        setScrapedDataText(resultText);
        setContentBrief(null);
        toast.success('Website crawled via browser proxy (server capture unavailable).');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCrawling(false);
    }
  };

  // Screenshot / image upload
  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const base64 = String(dataUrl).split(',')[1] || '';
        setImageBase64(base64);
        setImageMimeType(file.type || 'image/png');
      };
      reader.readAsDataURL(file);

      try {
        const { asset, brief } = await ingestUpload(file, { typeHint: 'screenshot', title: file.name });
        setScreenshotAsset(asset);
        setContentBrief(brief);
        setServerOnline(true);
        toast.success('Screenshot uploaded. It will drive ken-burns scenes on generate.');
      } catch {
        setScreenshotAsset({
          type: 'screenshot',
          filename: file.name,
          publicUrl: URL.createObjectURL(file)
        });
        setContentBrief({
          title: file.name.replace(/\.[^.]+$/, ''),
          bullets: ['Visual source provided as screenshot'],
          sections: [{ heading: 'Visual Story', points: ['Open on the visual', 'Highlight details', 'Close with CTA'] }],
          assets: [{ type: 'screenshot', path: file.name }],
          brand: { colors: ['#0a0a0f', '#67e8f9', '#ffffff'], fonts: ['Outfit'] },
          sourceType: 'screenshot'
        });
        toast.success('Screenshot loaded locally (upload API offline).');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // PDF file Base64 parser and text extractor
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPdfFileName(file.name);
      
      const base64Reader = new FileReader();
      base64Reader.onloadend = () => {
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
          setContentBrief(briefFromPdfText(finalPdfText, file.name));
          console.log("Successfully extracted text from PDF. Character count:", finalPdfText.length);
        } catch (err) {
          console.error("Failed to parse PDF text:", err);
          toast.error("Client-side PDF text extraction failed: " + err.message);
        }
      };
      bufferReader.readAsArrayBuffer(file);
    }
  };

  const handleEnhancePrompt = async () => {
    if (!apiKey) {
      toast.error('Please configure and save your API Key in settings first!');
      setShowConfig(true);
      return;
    }
    setIsEnhancingPrompt(true);
    try {
      const model = resolveApiModel();
      const enhanced = await enhanceAIPrompt({
        provider: apiProvider,
        model,
        apiKey,
        promptText: aiPrompt,
        pdfText,
        webpageText: scrapedDataText || rawHtmlPaste,
        contentBrief,
        imageBase64,
        imageMimeType,
        fileBase64: pdfBase64
      });
      if (enhanced) {
        setAiPrompt(enhanced);
        toast.success('Prompt enhanced successfully!');
      } else {
        toast.error('AI returned an empty prompt.');
      }
    } catch (err) {
      console.error(err);
      toast.error(`Enhancement failed: ${err.message}`);
    } finally {
      setIsEnhancingPrompt(false);
    }
  };

  // Trigger AI Pipeline
  const handleTriggerAI = async () => {
    commitPendingHistory();
    if (!apiKey) {
      toast.error('Please configure and save your API Key in settings first!');
      setShowConfig(true);
      return;
    }

    if (pdfBase64 && !pdfText) {
      console.warn("PDF was uploaded but text is empty. Wait for parsing or check for parsing errors.");
    }

    setAiLoading(true);
    try {
      const model = resolveApiModel();
      const combinedPageText = scrapedDataText || rawHtmlPaste;
      const brief = contentBrief || (pdfText ? briefFromPdfText(pdfText, pdfFileName) : null);

      const composition = await generateAIComposition({
        provider: apiProvider,
        model,
        apiKey: apiKey,
        promptText: aiPrompt,
        fileBase64: pdfBase64,
        pdfText: pdfText,
        webpageText: combinedPageText,
        contentBrief: brief,
        imageBase64: imageBase64 || null,
        imageMimeType
      });

      setAspectRatio(composition.aspectRatio || 'landscape');
      setVideoDuration(composition.videoDuration || 10);
      setOverlays(composition.overlays || []);
      setCropStart(0);
      setCropEnd(composition.videoDuration || 10);

      // Prefer screenshot URL from brief for ken-burns scenes
      const shotUrl = screenshotAsset?.publicUrl || screenshotAsset?.path || brief?.assets?.[0]?.path;
      const scenes = (composition.scenes || []).map((s) => createScene({
        ...s,
        imageUrl: s.template === 'screenshot-kenburns'
          ? (s.imageUrl || shotUrl || null)
          : s.imageUrl,
        background: s.template === 'screenshot-kenburns' && (s.imageUrl || shotUrl)
          ? { type: 'image', value: s.imageUrl || shotUrl }
          : s.background
      }));

      const nextProject = createProject({
        name: composition.name || 'AI Composition',
        aspectRatio: composition.aspectRatio || 'landscape',
        brand: composition.brand,
        scenes: scenes.length
          ? scenes
          : projectFromOverlays({
              overlays: composition.overlays,
              aspectRatio: composition.aspectRatio,
              videoDuration: composition.videoDuration,
              videoUrl
            }).scenes,
        assets: brief?.assets || [],
        sourceMeta: { brief, prompt: aiPrompt },
        backgroundVideoUrl: videoUrl
      });

      setProject(nextProject);
      setSelectedSceneId(nextProject.scenes[0]?.id || null);

      if (composition.overlays.length > 0) {
        setSelectedOverlayId(composition.overlays[0].id);
      }

      setLeftTab('scenes');
      toast.success('AI multi-scene composition ready. Edit scenes, preview HyperFrames, then render MP4.');
    } catch (err) {
      console.error(err);
      toast.error(`AI Generation failed: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleUpdateSelectedScene = (key, value) => {
    if (!selectedScene) return;
    setProject((prev) => updateScene(prev, selectedScene.id, { [key]: value }));
  };

  const handleAddScene = (template = 'title-card') => {
    commitPendingHistory();
    const scene = createScene({ title: 'New Scene', template });
    setProject((prev) => ({
      ...prev,
      scenes: [...prev.scenes, scene],
      updatedAt: new Date().toISOString()
    }));
    setSelectedSceneId(scene.id);
  };

  const handleMoveScene = (sceneId, direction) => {
    commitPendingHistory();
    const idx = project.scenes.findIndex((s) => s.id === sceneId);
    if (idx < 0) return;
    const to = direction === 'up' ? idx - 1 : idx + 1;
    setProject((prev) => reorderScenes(prev, idx, to));
  };

  const handleDuplicateScene = (sceneId) => {
    commitPendingHistory();
    setProject((p) => duplicateScene(p, sceneId));
  };

  const handleRemoveScene = (sceneId) => {
    commitPendingHistory();
    setProject((p) => removeScene(p, sceneId));
  };

  const handleSelectAspectRatio = (ratio) => {
    commitPendingHistory();
    setAspectRatio(ratio);
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
    commitPendingHistory();
    if (!csvContent) {
      toast.error('Please paste CSV content or upload a file first.');
      return;
    }
    const rows = parseCSV(csvContent);
    if (rows.length === 0) {
      toast.error('No data rows found in CSV.');
      return;
    }
    const generatedOverlays = mapCSVToTimeline(rows, csvTemplate, videoDuration);
    setOverlays(generatedOverlays);
    if (generatedOverlays.length > 0) {
      setSelectedOverlayId(generatedOverlays[0].id);
    }
    toast.success(`Imported ${generatedOverlays.length} timed tracks from CSV!`);
  };

  // Boilerplate loader
  const handleLoadBoilerplate = (bp) => {
    setSelectedBoilerplate(bp);
    setActiveRightTab('code');
    setActiveCodeTab('boilerplate');
  };

  // Browser draft export (MediaRecorder)
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
      toast.error('Video export failed. Make sure your browser supports MediaRecorder canvas capture.');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // HyperFrames producer MP4 render (primary)
  const handleHyperFramesRender = async () => {
    setIsHfRendering(true);
    setHfRenderProgress(0);
    setHfRenderStatus('Submitting composition…');
    try {
      const html = getCompositionHtmlString(true);
      const job = await startHyperFramesRender({
        html,
        project: {
          ...project,
          aspectRatio,
          duration: getProjectDuration(project) || videoDuration
        },
        quality: 'high',
        fps: 30
      });
      setServerOnline(true);
      setHfRenderStatus(`Rendering ${job.id.slice(0, 8)}…`);
      const done = await pollRenderUntilDone(job.id, {
        onProgress: (j) => {
          setHfRenderProgress(j.progress || 0);
          setHfRenderStatus(j.status === 'rendering' ? `Rendering… ${j.progress || 0}%` : j.status);
        }
      });
      downloadRender(done.id, `motionforge-${done.id.slice(0, 8)}.mp4`);
      setHfRenderStatus('Download started');
      toast.success('HyperFrames MP4 render complete.');
    } catch (err) {
      console.error(err);
      setServerOnline(false);
      toast.error(`HyperFrames render failed: ${err.message}\n\nMake sure the API is running (npm run dev) and Chrome/FFmpeg are available.`);
    } finally {
      setIsHfRendering(false);
    }
  };

  // Generated code selector helper
  const getGeneratedCode = () => {
    if (activeCodeTab === 'boilerplate') {
      return selectedBoilerplate ? selectedBoilerplate.code : '// Select a boilerplate from templates tab';
    }

    if (activeCodeTab === 'hyperframes') {
      if (!selectedOverlay) {
        return getCompositionHtmlString();
      }
      const template = PRESET_TEMPLATES.find(t => t.animationType === selectedOverlay.animationType);
      return template ? template.hyperframeCode(selectedOverlay) : getCompositionHtmlString();
    }

    if (!selectedOverlay) return '// Select an overlay preset to generate Remotion code';
    
    const template = PRESET_TEMPLATES.find(t => t.animationType === selectedOverlay.animationType);
    if (!template) return '// Template not found';
    return template.remotionCode(selectedOverlay);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getGeneratedCode());
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="app-container">
      <Toaster position="top-center" toastOptions={{ 
        style: { background: 'hsl(var(--bg-card))', color: '#fff', border: '1px solid hsl(var(--border-color))', fontSize: '13px' } 
      }} />
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

          {/* Undo / Redo Buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="control-btn"
              onClick={handleUndo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '6px',
                opacity: past.length === 0 ? 0.4 : 1,
                cursor: past.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Undo size={14} />
            </button>
            <button
              type="button"
              className="control-btn"
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
              style={{ 
                width: '28px', 
                height: '28px', 
                borderRadius: '6px',
                opacity: future.length === 0 ? 0.4 : 1,
                cursor: future.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Redo size={14} />
            </button>
          </div>

          {/* Aspect Ratio Selector */}
          <div style={{ display: 'flex', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px', padding: '2px' }}>
            <button 
              className={`control-btn ${aspectRatio === 'landscape' ? 'active-play' : ''}`} 
              onClick={() => handleSelectAspectRatio('landscape')}
              title="Landscape 16:9"
              style={{ width: '28px', height: '28px', borderRadius: '6px' }}
            >
              <Monitor size={14} />
            </button>
            <button 
              className={`control-btn ${aspectRatio === 'portrait' ? 'active-play' : ''}`} 
              onClick={() => handleSelectAspectRatio('portrait')}
              title="Portrait 9:16 (Reels/Shorts)"
              style={{ width: '28px', height: '28px', borderRadius: '6px' }}
            >
              <Smartphone size={14} />
            </button>
            <button 
              className={`control-btn ${aspectRatio === 'square' ? 'active-play' : ''}`} 
              onClick={() => handleSelectAspectRatio('square')}
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
              <select value={apiProvider} onChange={(e) => handleProviderChange(e.target.value)}>
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
              className={`tab-btn ${leftTab === 'scenes' ? 'active' : ''}`}
              onClick={() => setLeftTab('scenes')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Clapperboard size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              Scenes
            </button>
            <button 
              className={`tab-btn ${leftTab === 'csv' ? 'active' : ''}`}
              onClick={() => setLeftTab('csv')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Database size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              CSV
            </button>
            <button 
              className={`tab-btn ${leftTab === 'boilerplates' ? 'active' : ''}`}
              onClick={() => setLeftTab('boilerplates')}
              style={{ padding: '10px 4px', fontSize: '10px' }}
            >
              <Code size={12} style={{ display: 'block', margin: '0 auto 4px auto' }} />
              Code
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
                  
                  <label className="upload-card" htmlFor="mf-video-upload" style={{ cursor: 'pointer' }}>
                    <Upload size={20} style={{ color: 'hsl(var(--accent-purple))' }} />
                    <div>
                      <p style={{ fontWeight: '600', fontSize: '12px' }}>Upload local video</p>
                      <p style={{ fontSize: '10px', color: 'hsl(var(--text-muted))' }}>MP4, WebM or MOV</p>
                    </div>
                    <input 
                      id="mf-video-upload"
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleVideoUpload} 
                      accept="video/mp4,video/webm,video/quicktime,video/*" 
                      style={{ display: 'none' }} 
                    />
                  </label>

                  {uploadedVideos.length > 0 && (
                    <div style={{ marginTop: '14px' }}>
                      <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginBottom: '8px', fontWeight: 'bold' }}>Uploaded</p>
                      <div className="media-grid">
                        {uploadedVideos.map((item) => (
                          <div
                            key={item.id}
                            className={`media-item ${videoUrl === item.url ? 'active' : ''}`}
                            draggable
                            onDragStart={(e) => handleAssetDragStart(e, item)}
                            onClick={() => selectVideoAsset(item.url)}
                            title={`${item.fileName} — drag onto Video track`}
                          >
                            {item.thumbnail ? (
                              <img src={item.thumbnail} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#111' }}>
                                <Video size={22} style={{ color: 'hsl(var(--accent-cyan))' }} />
                              </div>
                            )}
                            <div className="media-item-label">
                              <span>{item.name}</span>
                            </div>
                            <button
                              type="button"
                              className="asset-add-btn"
                              title="Add to timeline"
                              onClick={(e) => handleAddAssetToTimeline(e, item)}
                            >
                              + Timeline
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '14px' }}>
                    <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', marginBottom: '8px', fontWeight: 'bold' }}>Sample library</p>
                    <div className="media-grid">
                      {SAMPLE_VIDEOS.map((item) => (
                        <div 
                          key={item.id} 
                          className={`media-item ${videoUrl === item.url ? 'active' : ''}`}
                          draggable
                          onDragStart={(e) => handleAssetDragStart(e, item)}
                          onClick={() => selectVideoAsset(item.url)}
                          title="Drag onto Video track"
                        >
                          <img src={item.thumbnail} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <div className="media-item-label">
                            <span>{item.name}</span>
                          </div>
                          <button
                            type="button"
                            className="asset-add-btn"
                            title="Add to timeline"
                            onClick={(e) => handleAddAssetToTimeline(e, item)}
                          >
                            + Timeline
                          </button>
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
                    Website Link (HyperFrames Capture)
                    <span style={{ marginLeft: 'auto', color: serverOnline ? 'hsl(var(--accent-green))' : 'hsl(var(--text-muted))' }}>
                      API {serverOnline ? 'online' : 'offline'}
                    </span>
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
                      {isCrawling ? 'Capturing...' : 'Capture'}
                    </button>
                  </div>
                  {scrapedDataText && (
                    <div style={{ fontSize: '10px', color: 'hsl(var(--accent-green))', marginTop: '6px', fontWeight: '600' }}>
                      ✓ Source ready ({scrapedDataText.length} chars)
                      {contentBrief?.assets?.length ? ` · ${contentBrief.assets.length} screenshots` : ''}
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

                {/* Screenshot / Image Upload */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid hsl(var(--border-color))' }}>
                  <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                    <ImageIcon size={12} style={{ color: 'hsl(var(--accent-cyan))' }} />
                    Website Screenshot / Image
                  </label>
                  <div 
                    className="upload-card"
                    onClick={() => screenshotInputRef.current?.click()}
                    style={{ padding: '12px', cursor: 'pointer' }}
                  >
                    <Upload size={14} style={{ color: 'hsl(var(--accent-cyan))' }} />
                    <span style={{ fontSize: '11px', fontWeight: '500' }}>
                      {screenshotAsset?.filename || screenshotAsset?.storedName || 'Upload Screenshot'}
                    </span>
                    <input 
                      type="file"
                      ref={screenshotInputRef}
                      onChange={handleScreenshotUpload}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      style={{ display: 'none' }}
                    />
                  </div>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ marginBottom: 0 }}>Creative Goal Prompt</label>
                    <button 
                      className="action-btn secondary" 
                      onClick={handleEnhancePrompt}
                      disabled={isEnhancingPrompt}
                      style={{ padding: '2px 8px', fontSize: '10px', height: '22px' }}
                      title="Auto-suggest or rewrite prompt based on uploaded context"
                    >
                      <Sparkles size={10} style={{ marginRight: '4px' }} />
                      {isEnhancingPrompt ? 'Enhancing...' : 'Enhance (AI)'}
                    </button>
                  </div>
                  <textarea 
                    rows="3"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                </div>

                {aiLoading ? (
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{ fontSize: '12px', marginBottom: '6px' }}>Generating multi-scene HyperFrames project...</div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div className="template-progress-fill" style={{ width: '60%', height: '100%' }}></div>
                    </div>
                  </div>
                ) : (
                  <button className="action-btn" onClick={handleTriggerAI}>
                    <Sparkles size={14} />
                    Generate Animated Video
                  </button>
                )}
              </div>
            )}

            {/* SCENES EDITOR TAB */}
            {leftTab === 'scenes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="sidebar-title" style={{ margin: 0 }}>
                    <Clapperboard size={14} />
                    Scene Timeline
                  </h3>
                  <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))' }}>
                    {getProjectDuration(project).toFixed(1)}s · {project.scenes.length} scenes
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    ['title-card', 'Title'],
                    ['bullet-explainer', 'Bullets'],
                    ['screenshot-kenburns', 'Ken Burns'],
                    ['quote', 'Quote'],
                    ['cta-outro', 'CTA']
                  ].map(([tpl, label]) => (
                    <button
                      key={tpl}
                      className="action-btn secondary"
                      style={{ padding: '4px 8px', fontSize: '10px' }}
                      onClick={() => handleAddScene(tpl)}
                    >
                      + {label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {project.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      onClick={() => setSelectedSceneId(scene.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${selectedScene?.id === scene.id ? 'hsl(var(--accent-cyan))' : 'hsl(var(--border-color))'}`,
                        background: selectedScene?.id === scene.id ? 'rgba(103,232,249,0.08)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 700 }}>{index + 1}. {scene.title}</div>
                          <div style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', marginTop: '2px' }}>
                            {scene.template} · {Number(scene.duration).toFixed(1)}s
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button className="control-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); handleMoveScene(scene.id, 'up'); }}>
                            <ArrowUp size={12} />
                          </button>
                          <button className="control-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); handleMoveScene(scene.id, 'down'); }}>
                            <ArrowDown size={12} />
                          </button>
                          <button className="control-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); handleDuplicateScene(scene.id); }}>
                            <Copy size={12} />
                          </button>
                          <button className="control-btn" style={{ width: 22, height: 22 }} onClick={(e) => { e.stopPropagation(); handleRemoveScene(scene.id); }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedScene && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '8px', borderTop: '1px solid hsl(var(--border-color))' }}>
                    <div className="form-group">
                      <label>Scene Title</label>
                      <input value={selectedScene.title} onChange={(e) => handleUpdateSelectedScene('title', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Subtitle / CTA</label>
                      <input value={selectedScene.subtitle || ''} onChange={(e) => handleUpdateSelectedScene('subtitle', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Template</label>
                      <select value={selectedScene.template} onChange={(e) => handleUpdateSelectedScene('template', e.target.value)}>
                        <option value="title-card">Title Card</option>
                        <option value="bullet-explainer">Bullet Explainer</option>
                        <option value="screenshot-kenburns">Screenshot Ken Burns</option>
                        <option value="quote">Quote</option>
                        <option value="cta-outro">CTA Outro</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Duration (s)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={selectedScene.duration}
                        onChange={(e) => handleUpdateSelectedScene('duration', parseFloat(e.target.value) || 3)}
                      />
                    </div>
                    {selectedScene.template === 'bullet-explainer' && (
                      <div className="form-group">
                        <label>Bullets (one per line)</label>
                        <textarea
                          rows="4"
                          value={(selectedScene.bullets || []).join('\n')}
                          onChange={(e) => handleUpdateSelectedScene('bullets', e.target.value.split('\n').filter(Boolean))}
                        />
                      </div>
                    )}
                    {(selectedScene.template === 'screenshot-kenburns') && (
                      <div className="form-group">
                        <label>Image URL</label>
                        <input
                          value={selectedScene.imageUrl || selectedScene.background?.value || ''}
                          onChange={(e) => {
                            handleUpdateSelectedScene('imageUrl', e.target.value);
                            handleUpdateSelectedScene('background', { type: 'image', value: e.target.value });
                          }}
                          placeholder="/api/assets/... or https://..."
                        />
                      </div>
                    )}
                    <div className="form-group">
                      <label>Accent Color</label>
                      <input
                        type="color"
                        value={selectedScene.accentColor || project.brand?.colors?.[1] || '#67e8f9'}
                        onChange={(e) => handleUpdateSelectedScene('accentColor', e.target.value)}
                      />
                    </div>
                    <button className="action-btn secondary" onClick={refreshHyperFramesPreview}>
                      <Play size={14} />
                      Preview in Program Monitor
                    </button>
                  </div>
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

        {/* CENTER — Program monitor + transport + timeline */}
        <main className="center-work-area">
          <section className="program-monitor">
            <div className="monitor-toolbar">
              <div className="monitor-mode-toggle">
                <button
                  type="button"
                  className={`monitor-mode-btn ${!showHyperFramesPreview ? 'active' : ''}`}
                  onClick={() => {
                    if (showHyperFramesPreview) toggleHyperFramesPreview();
                  }}
                >
                  Canvas
                </button>
                <button
                  type="button"
                  className={`monitor-mode-btn ${showHyperFramesPreview ? 'active' : ''}`}
                  onClick={() => {
                    if (!showHyperFramesPreview) refreshHyperFramesPreview();
                  }}
                >
                  HyperFrames
                </button>
              </div>
              <div className="monitor-toolbar-meta">
                <span className="monitor-aspect-badge">
                  {aspectRatio === 'landscape' ? '16:9' : aspectRatio === 'portrait' ? '9:16' : '1:1'}
                </span>
                <span>
                  {formatTimecode(currentTime)} / {formatTimecode(compositionDuration)}
                </span>
              </div>
            </div>

            <div className="program-stage">
              <div className={`program-frame ${aspectRatio}`} ref={!showHyperFramesPreview ? playerContainerRef : undefined}>
                {/* Keep video mounted always so uploads can bind metadata even in HyperFrames mode */}
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="main-video"
                  playsInline
                  preload="metadata"
                  {...(videoUrl.startsWith('http') ? { crossOrigin: 'anonymous' } : {})}
                  style={showHyperFramesPreview ? { position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' } : undefined}
                />
                {showHyperFramesPreview ? (
                  <hyperframes-player
                    ref={hfPlayerRef}
                    src={hfPreviewUrl}
                    controls
                    style={{ width: '100%', height: '100%' }}
                  ></hyperframes-player>
                ) : (
                  <div className="canvas-overlays-container">
                      {overlays.map((overlay) => {
                        if (!isOverlayVisibleInTimeline(overlay.id)) return null;
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
                )}
              </div>
            </div>
          </section>

          <TransportDock
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={compositionDuration}
            showHyperFramesPreview={showHyperFramesPreview}
            onPlay={togglePlay}
            onReset={handleReset}
            onSplit={() => handleSplitVideoClip(currentTime)}
            canSplit={(() => {
              const clip =
                (selectedVideoClipId && videoClips.find((c) => c.id === selectedVideoClipId)) ||
                findActiveClip(videoClips, currentTime);
              if (!clip) return false;
              const local = currentTime - clip.timelineStart;
              return local >= 0.2 && local <= clip.duration - 0.2;
            })()}
          />

          <TimelinePanel
            videoDuration={compositionDuration}
            currentTime={currentTime}
            cropStart={cropStart}
            cropEnd={cropEnd}
            overlays={overlays}
            project={project}
            videoClips={videoClips}
            selectedOverlayId={selectedOverlayId}
            selectedSceneId={selectedSceneId}
            selectedVideoClipId={selectedVideoClipId}
            selectedVideoClipIds={selectedVideoClipIds}
            onScrub={handleScrubChange}
            onSelectOverlay={(id) => {
              setSelectedOverlayId(id);
              setSelectedVideoClipId(null);
              setSelectedVideoClipIds([]);
            }}
            onSelectScene={(id) => {
              setSelectedSceneId(id);
              setLeftTab('scenes');
            }}
            onSelectVideoClip={handleSelectVideoClip}
            onCropStart={setCropStart}
            onCropEnd={setCropEnd}
            onDropVideo={handleDropVideo}
            onTrimVideoClip={handleTrimVideoClip}
            onMoveVideoClip={handleMoveVideoClip}
            onSplitVideoClip={handleSplitVideoClip}
            onAutoTrimSilence={handleAutoTrimSilence}
            onAutoGenerateGraphics={handleAutoGenerateGraphics}
            isRippleEnabled={isRippleEnabled}
            onToggleRipple={() => setIsRippleEnabled(!isRippleEnabled)}
            isVideoTrackVisible={timelineVisibility.videoTrack}
            isScenesTrackVisible={timelineVisibility.scenesTrack}
            isOverlayVisible={isOverlayVisibleInTimeline}
            onToggleVideoTrackVisibility={toggleVideoTrackVisibility}
            onToggleScenesTrackVisibility={toggleScenesTrackVisibility}
            onToggleOverlayVisibility={toggleOverlayVisibility}
          />
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
                {selectedVideoClip ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'hsl(var(--accent-cyan))' }}>
                        Video Clip
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={handleDuplicateVideoClip}
                          style={{ background: 'transparent', border: 'none', color: 'hsl(var(--accent-cyan))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                        >
                          <Copy size={12} />
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteVideoClip}
                          style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Name</label>
                      <input
                        type="text"
                        value={selectedVideoClip.name}
                        onChange={(e) => handleUpdateVideoClipField('name', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Timeline Start (s)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={Number(selectedVideoClip.timelineStart).toFixed(1)}
                        onChange={(e) => handleUpdateVideoClipField('timelineStart', e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label>Source In</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max={selectedVideoClip.sourceOut - 0.2}
                          value={Number(selectedVideoClip.sourceIn).toFixed(2)}
                          onChange={(e) => handleUpdateVideoClipField('sourceIn', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Source Out</label>
                        <input
                          type="number"
                          step="0.1"
                          min={selectedVideoClip.sourceIn + 0.2}
                          max={selectedVideoClip.sourceDuration}
                          value={Number(selectedVideoClip.sourceOut).toFixed(2)}
                          onChange={(e) => handleUpdateVideoClipField('sourceOut', e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                      <div>Duration on timeline: <strong style={{ color: 'hsl(var(--text-primary))' }}>{selectedVideoClip.duration.toFixed(2)}s</strong></div>
                      <div>Source length: {selectedVideoClip.sourceDuration.toFixed(2)}s</div>
                      <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                        Drag the clip body to move · edges to trim · Split (S) to cut at playhead.
                      </p>
                    </div>
                  </div>
                ) : selectedOverlay ? (
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
                    <p style={{ fontSize: '12px' }}>
                      Select a video clip or overlay on the timeline to edit properties. Drag assets onto the Video track to add clips.
                    </p>
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
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>HyperFrames MP4 Render</h4>
                  <p style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', lineHeight: '1.4' }}>
                    Frame-accurate render via @hyperframes/producer (Chrome + FFmpeg). Primary export for high-graphic animated videos.
                  </p>
                </div>

                <div style={{ padding: '16px', background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border-color))', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span>Scenes:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{project.scenes.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span>Composition Length:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{getProjectDuration(project).toFixed(1)}s</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                    <span>Overlays (canvas):</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{overlays.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>Export Dimensions:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                      {aspectRatio === 'landscape' ? '1920x1080 (16:9)' : aspectRatio === 'portrait' ? '1080x1920 (9:16)' : '1080x1080 (1:1)'}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '10px', color: serverOnline ? 'hsl(var(--accent-green))' : '#f87171' }}>
                    Render API: {serverOnline ? 'connected' : 'offline — run npm run dev'}
                  </div>
                </div>

                {isHfRendering ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>{hfRenderStatus || 'Rendering…'}</span>
                      <span>{hfRenderProgress}%</span>
                    </div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${hfRenderProgress}%`, height: '100%', background: 'linear-gradient(90deg, hsl(var(--accent-cyan)), hsl(var(--accent-purple)))' }}></div>
                    </div>
                  </div>
                ) : (
                  <button 
                    className="action-btn"
                    onClick={handleHyperFramesRender}
                    style={{ width: '100%' }}
                  >
                    <Download size={16} />
                    Render HyperFrames MP4
                  </button>
                )}

                <div style={{ borderTop: '1px solid hsl(var(--border-color))', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>Quick Draft (Browser)</h4>
                  <p style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', lineHeight: '1.4', marginBottom: '10px' }}>
                    Optional MediaRecorder overlay bake — lower fidelity than HyperFrames.
                  </p>
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
                      className="action-btn secondary"
                      onClick={handleExport}
                      style={{ width: '100%' }}
                    >
                      <Download size={16} />
                      Start Local Browser Compile
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}
