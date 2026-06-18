export const PRESET_TEMPLATES = [
  {
    id: 'neon-title',
    name: 'Neon Glow Title',
    description: 'Vibrant glowing futuristic title overlay',
    category: 'Titles',
    defaultText: 'CREATIVE REEL',
    defaultDuration: 4,
    defaultFontSize: 64,
    defaultTextColor: '#ffffff',
    defaultAccentColor: '#a855f7', // purple
    defaultX: 50,
    defaultY: 40,
    animationType: 'neon',
    style: {
      fontFamily: 'Outfit, sans-serif',
      fontWeight: '800',
      textAlign: 'center',
    },
    hyperframeCode: (cfg) => `<!-- HyperFrames Neon Glow Title -->
<h1 id="neon-title"
    class="clip template-neon"
    data-start="${cfg.start.toFixed(1)}"
    data-duration="${cfg.duration.toFixed(1)}"
    data-track-index="${cfg.trackIndex}"
    style="
      position: absolute;
      left: ${cfg.x}%;
      top: ${cfg.y}%;
      transform: translate(-50%, -50%);
      font-size: ${cfg.fontSize}px;
      color: ${cfg.textColor};
      --neon-color: ${cfg.accentColor};
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      letter-spacing: -1px;
    ">
  ${cfg.text}
</h1>`,
    remotionCode: (cfg) => `import { Sequence, spring, useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

export const NeonTitle = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Custom spring transition based on start time
  const startFrame = Math.round(${cfg.start} * fps);
  const durationInFrames = Math.round(${cfg.duration} * fps);
  
  const scale = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 10, mass: 0.6 }
  });

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
        <h1 style={{
          position: 'absolute',
          left: '${cfg.x}%',
          top: '${cfg.y}%',
          transform: \`translate(-50%, -50%) scale(\${scale})\`,
          fontSize: '${cfg.fontSize}px',
          color: '${cfg.textColor}',
          fontFamily: 'Outfit, sans-serif',
          fontWeight: '800',
          textShadow: '0 0 10px ${cfg.accentColor}, 0 0 20px ${cfg.accentColor}',
          letterSpacing: '-1px',
          textAlign: 'center',
        }}>
          ${cfg.text}
        </h1>
      </AbsoluteFill>
    </Sequence>
  );
};`
  },
  {
    id: 'spring-label',
    name: 'Remotion Spring Label',
    description: 'Dynamic spring-loaded bouncy badge',
    category: 'Badges',
    defaultText: 'NEW RELEASE 🚀',
    defaultDuration: 3,
    defaultFontSize: 24,
    defaultTextColor: '#000000',
    defaultAccentColor: '#06b6d4', // cyan
    defaultX: 50,
    defaultY: 75,
    animationType: 'spring',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: '700',
      textAlign: 'center',
    },
    hyperframeCode: (cfg) => `<!-- HyperFrames Spring Badge -->
<div id="spring-label"
     class="clip template-spring"
     data-start="${cfg.start.toFixed(1)}"
     data-duration="${cfg.duration.toFixed(1)}"
     data-track-index="${cfg.trackIndex}"
     style="
       position: absolute;
       left: ${cfg.x}%;
       top: ${cfg.y}%;
       transform: translate(-50%, -50%);
       background-color: ${cfg.accentColor};
       color: ${cfg.textColor};
       padding: 8px 18px;
       border-radius: 50px;
       font-size: ${cfg.fontSize}px;
       font-weight: 700;
       font-family: 'Inter', sans-serif;
       box-shadow: 0 10px 20px rgba(0,0,0,0.3);
       white-space: nowrap;
     ">
  ${cfg.text}
</div>`,
    remotionCode: (cfg) => `import { Sequence, spring, useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

export const SpringLabel = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = Math.round(${cfg.start} * fps);
  const durationInFrames = Math.round(${cfg.duration} * fps);
  
  const bounce = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 8, stiffness: 120, mass: 0.8 }
  });

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          left: '${cfg.x}%',
          top: '${cfg.y}%',
          transform: \`translate(-50%, -50%) scale(\${bounce})\`,
          backgroundColor: '${cfg.accentColor}',
          color: '${cfg.textColor}',
          padding: '8px 18px',
          borderRadius: '50px',
          fontSize: '${cfg.fontSize}px',
          fontWeight: '700',
          fontFamily: 'Inter, sans-serif',
          boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
          white-space: 'nowrap',
        }}>
          ${cfg.text}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};`
  },
  {
    id: 'cyberpunk-badge',
    name: 'Cyberpunk Lower Third',
    description: 'High-tech neon bar with digital glitch feel',
    category: 'Badges',
    defaultText: 'DEVELOPER LOG: 104',
    defaultDuration: 5,
    defaultFontSize: 18,
    defaultTextColor: '#ffffff',
    defaultAccentColor: '#f43f5e', // pink
    defaultX: 30,
    defaultY: 85,
    animationType: 'cyberpunk',
    style: {
      fontFamily: 'Space Grotesk, monospace',
      fontWeight: '600',
    },
    hyperframeCode: (cfg) => `<!-- HyperFrames Cyberpunk Badge -->
<div id="cyber-badge"
     class="clip template-cyberpunk"
     data-start="${cfg.start.toFixed(1)}"
     data-duration="${cfg.duration.toFixed(1)}"
     data-track-index="${cfg.trackIndex}"
     style="
       position: absolute;
       left: ${cfg.x}%;
       top: ${cfg.y}%;
       transform: translateY(-50%);
       border-left: 4px solid ${cfg.accentColor};
       background-color: rgba(0, 0, 0, 0.75);
       backdrop-filter: blur(5px);
       padding: 8px 14px;
       font-family: 'Space Grotesk', monospace;
       font-size: ${cfg.fontSize}px;
       color: ${cfg.textColor};
       text-transform: uppercase;
       letter-spacing: 1px;
       border-radius: 0 4px 4px 0;
       display: inline-block;
     ">
  ${cfg.text}
</div>`,
    remotionCode: (cfg) => `import { Sequence, interpolate, useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

export const CyberpunkBadge = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = Math.round(${cfg.start} * fps);
  const durationInFrames = Math.round(${cfg.duration} * fps);
  
  // Cyberpunk slide & entry effect
  const slide = interpolate(
    frame - startFrame,
    [0, 10],
    [-50, 0],
    { extrapolateRight: 'clamp' }
  );
  const opacity = interpolate(
    frame - startFrame,
    [0, 6],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          left: '${cfg.x}%',
          top: '${cfg.y}%',
          transform: \`translateY(-50%) translateX(\${slide}px)\`,
          opacity: opacity,
          borderLeft: '4px solid ${cfg.accentColor}',
          backgroundColor: 'rgba(0,0,0,0.75)',
          padding: '8px 14px',
          fontFamily: 'Space Grotesk, monospace',
          fontSize: '${cfg.fontSize}px',
          color: '${cfg.textColor}',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          borderRadius: '0 4px 4px 0',
        }}>
          ${cfg.text}
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};`
  },
  {
    id: 'subtitle-bar',
    name: 'Smart Captions',
    description: 'Clean high-readability speech captions',
    category: 'Captions',
    defaultText: 'Enhancing presentations with high-fidelity visual overlays.',
    defaultDuration: 5,
    defaultFontSize: 22,
    defaultTextColor: '#ffffff',
    defaultAccentColor: '#eab308', // amber yellow
    defaultX: 50,
    defaultY: 82,
    animationType: 'fade',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: '500',
      textAlign: 'center',
    },
    hyperframeCode: (cfg) => `<!-- HyperFrames Captions -->
<div id="captions"
     class="clip"
     data-start="${cfg.start.toFixed(1)}"
     data-duration="${cfg.duration.toFixed(1)}"
     data-track-index="${cfg.trackIndex}"
     style="
       position: absolute;
       left: ${cfg.x}%;
       bottom: ${100 - cfg.y}%;
       transform: translateX(-50%);
       width: 80%;
       text-align: center;
       font-family: 'Inter', sans-serif;
       font-size: ${cfg.fontSize}px;
       color: ${cfg.textColor};
       line-height: 1.4;
       text-shadow: 0 2px 4px rgba(0,0,0,0.8);
     ">
  <span style="background-color: rgba(0,0,0,0.75); padding: 4px 12px; border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
    ${cfg.text}
  </span>
</div>`,
    remotionCode: (cfg) => `import { Sequence, interpolate, useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

export const SmartCaptions = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = Math.round(${cfg.start} * fps);
  const durationInFrames = Math.round(${cfg.duration} * fps);
  
  // Smooth fade-in
  const opacity = interpolate(
    frame - startFrame,
    [0, 8],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          left: '${cfg.x}%',
          bottom: '${100 - cfg.y}%',
          transform: 'translateX(-50%)',
          width: '80%',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: '${cfg.fontSize}px',
          color: '${cfg.textColor}',
          lineHeight: '1.4',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          opacity: opacity,
        }}>
          <span style={{
            backgroundColor: 'rgba(0,0,0,0.75)',
            padding: '4px 12px',
            borderRadius: '6px',
          }}>
            ${cfg.text}
          </span>
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};`
  },
  {
    id: 'progress-bar',
    name: 'Dynamic Progress Bar',
    description: 'Visual indicator of section playback duration',
    category: 'Utilities',
    defaultText: 'Section Progress',
    defaultDuration: 6,
    defaultFontSize: 12,
    defaultTextColor: '#ffffff',
    defaultAccentColor: '#10b981', // green
    defaultX: 50,
    defaultY: 92,
    animationType: 'progress',
    style: {
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
    },
    hyperframeCode: (cfg) => `<!-- HyperFrames Section Progress Bar -->
<div id="progress-wrapper"
     class="clip"
     data-start="${cfg.start.toFixed(1)}"
     data-duration="${cfg.duration.toFixed(1)}"
     data-track-index="${cfg.trackIndex}"
     style="
       position: absolute;
       left: ${cfg.x}%;
       top: ${cfg.y}%;
       transform: translate(-50%, -50%);
       width: 60%;
       display: flex;
       flex-direction: column;
       gap: 4px;
     ">
  <div style="display: flex; justify-content: space-between; font-size: ${cfg.fontSize}px; color: ${cfg.textColor}; font-family: 'Inter', sans-serif;">
    <span>${cfg.text}</span>
  </div>
  <div class="template-progress-bar" style="width: 100%;">
    <div class="template-progress-fill" style="
      width: 0%;
      height: 100%;
      background: ${cfg.accentColor};
      animation: progress-fill-anim ${cfg.duration}s linear forwards;
    "></div>
  </div>
  <style>
    @keyframes progress-fill-anim {
      to { width: 100%; }
    }
  </style>
</div>`,
    remotionCode: (cfg) => `import { Sequence, interpolate, useVideoConfig, useCurrentFrame, AbsoluteFill } from 'remotion';

export const ProgressBar = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = Math.round(${cfg.start} * fps);
  const durationInFrames = Math.round(${cfg.duration} * fps);
  
  const elapsed = frame - startFrame;
  const progress = interpolate(
    elapsed,
    [0, durationInFrames],
    [0, 100],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <Sequence from={startFrame} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          left: '${cfg.x}%',
          top: '${cfg.y}%',
          transform: 'translate(-50%, -50%)',
          width: '60%',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '${cfg.fontSize}px',
            color: '${cfg.textColor}',
            fontFamily: 'Inter, sans-serif',
          }}>
            <span>${cfg.text}</span>
          </div>
          <div style={{
            height: '8px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '4px',
            overflow: 'hidden',
            width: '100%',
          }}>
            <div style={{
              width: \`\${progress}%\`,
              height: '100%',
              background: '${cfg.accentColor}',
              boxShadow: '0 0 10px ${cfg.accentColor}',
            }} />
          </div>
        </div>
      </AbsoluteFill>
    </Sequence>
  );
};`
  }
];
