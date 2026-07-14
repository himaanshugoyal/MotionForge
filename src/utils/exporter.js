/**
 * Client-Side Real-Time Video Compositor & Exporter
 * Composites custom overlays (text, badges, progress bars, subtitles) on top of the video
 * and captures the Canvas stream to output a combined video file.
 */
export async function exportVideo({
  videoElement,
  overlays,
  startTime,
  endTime,
  width,
  height,
  onProgress,
}) {
  return new Promise((resolve, reject) => {
    try {
      // 1. Create a workspace canvas with the specified render resolution
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Keep backup state of the video
      const originalTime = videoElement.currentTime;
      const originalLoop = videoElement.loop;
      const originalMuted = videoElement.muted;

      // Configure video for rendering
      videoElement.loop = false;
      videoElement.muted = true;
      videoElement.currentTime = startTime;

      // 2. Setup Media Stream and Recorder
      // Frame rate of capture (e.g. 30 fps)
      const canvasStream = canvas.captureStream(30);
      
      // Attempt to capture audio if available
      let audioTrack = null;
      if (videoElement.captureStream) {
        const videoStream = videoElement.captureStream();
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0].clone();
          canvasStream.addTrack(audioTrack);
        }
      } else if (videoElement.mozCaptureStream) {
        const videoStream = videoElement.mozCaptureStream();
        const audioTracks = videoStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTrack = audioTracks[0].clone();
          canvasStream.addTrack(audioTrack);
        }
      }

      // Check supported MIME type
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/mp4'; // fallback for Safari
      }

      const options = { mimeType };
      const mediaRecorder = new MediaRecorder(canvasStream, options);
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      let animationFrameId = null;
      const totalDuration = endTime - startTime;

      // Draw Loop
      const drawFrame = () => {
        const currentRelativeTime = videoElement.currentTime - startTime;
        const progress = Math.min(currentRelativeTime / totalDuration, 1);
        
        onProgress(Math.round(progress * 100));

        if (videoElement.currentTime >= endTime || progress >= 1) {
          // Stop recording when we reach the end
          cleanupAndStop();
          return;
        }

        // 1. Draw source video frame
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        
        // Handle cropping fit
        const videoRatio = videoElement.videoWidth / videoElement.videoHeight;
        const canvasRatio = width / height;
        let dWidth, dHeight, dx, dy;

        if (videoRatio > canvasRatio) {
          dHeight = height;
          dWidth = height * videoRatio;
          dx = (width - dWidth) / 2;
          dy = 0;
        } else {
          dWidth = width;
          dHeight = width / videoRatio;
          dx = 0;
          dy = (height - dHeight) / 2;
        }

        ctx.drawImage(videoElement, dx, dy, dWidth, dHeight);

        // 2. Draw all active overlays
        overlays.forEach((overlay) => {
          const start = parseFloat(overlay.start);
          const duration = parseFloat(overlay.duration);
          const end = start + duration;
          const relativeVideoTime = videoElement.currentTime;

          // Render overlay if it falls within the current video playback time
          if (relativeVideoTime >= start && relativeVideoTime <= end) {
            ctx.save();

            const xPos = (overlay.x / 100) * width;
            const yPos = (overlay.y / 100) * height;
            const size = parseFloat(overlay.fontSize) * (height / 1080); // scale text relative to render size
            const color = overlay.textColor || '#ffffff';
            const accent = overlay.accentColor || '#a855f7';
            const text = overlay.text || '';

            // Apply different graphic layout presets
            if (overlay.animationType === 'neon') {
              ctx.shadowColor = accent;
              ctx.shadowBlur = 20;
              ctx.font = `800 ${size}px Outfit, sans-serif`;
              ctx.fillStyle = color;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(text, xPos, yPos);
            } 
            else if (overlay.animationType === 'spring') {
              // Bouncy box badge
              ctx.font = `bold ${size}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const textWidth = ctx.measureText(text).width;
              const paddingX = 20 * (height / 1080);
              const paddingY = 10 * (height / 1080);
              const rectWidth = textWidth + paddingX * 2;
              const rectHeight = size + paddingY * 2;
              
              // Draw rounded background badge
              ctx.fillStyle = accent;
              ctx.shadowColor = 'rgba(0,0,0,0.3)';
              ctx.shadowBlur = 10;
              
              const r = 25 * (height / 1080);
              const rx = xPos - rectWidth / 2;
              const ry = yPos - rectHeight / 2;
              
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(rx, ry, rectWidth, rectHeight, r) : ctx.rect(rx, ry, rectWidth, rectHeight);
              ctx.fill();
              
              ctx.shadowBlur = 0;
              ctx.fillStyle = color;
              ctx.fillText(text, xPos, yPos);
            } 
            else if (overlay.animationType === 'cyberpunk') {
              // Cyberpunk lower-third box
              ctx.font = `bold ${size}px Space Grotesk, monospace`;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              
              const textWidth = ctx.measureText(text.toUpperCase()).width;
              const paddingX = 16 * (height / 1080);
              const paddingY = 10 * (height / 1080);
              const rectWidth = textWidth + paddingX * 2;
              const rectHeight = size + paddingY * 2;
              
              const rx = xPos;
              const ry = yPos - rectHeight / 2;
              
              // Dark blurred backdrop
              ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
              ctx.fillRect(rx, ry, rectWidth, rectHeight);
              
              // Solid colored border line
              ctx.fillStyle = accent;
              ctx.fillRect(rx, ry, 6 * (height / 1080), rectHeight);
              
              ctx.fillStyle = color;
              ctx.fillText(text.toUpperCase(), rx + paddingX + 4, yPos);
            } 
            else if (overlay.animationType === 'fade') {
              // Standard Subtitles / Captions style
              ctx.font = `500 ${size}px Inter, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              
              // Dark background box
              const textWidth = ctx.measureText(text).width;
              const paddingX = 16 * (height / 1080);
              const paddingY = 6 * (height / 1080);
              const rx = xPos - textWidth / 2 - paddingX;
              const ry = yPos - size - paddingY * 2;
              
              ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(rx, ry, textWidth + paddingX * 2, size + paddingY * 2, 6) : ctx.rect(rx, ry, textWidth + paddingX * 2, size + paddingY * 2);
              ctx.fill();
              
              ctx.fillStyle = color;
              ctx.fillText(text, xPos, yPos - paddingY);
            }
            else if (overlay.animationType === 'karaoke') {
              const relativeOverlayTime = relativeVideoTime - start;
              const words = Array.isArray(overlay.captionWords) ? overlay.captionWords : [];
              const activeWordIdx = words.findIndex(
                (w) => relativeOverlayTime >= (w.start || 0) && relativeOverlayTime <= (w.end || 0)
              );

              const lineWords = words.length ? words.map((w) => w.text) : [text];
              const spacing = Math.max(4, 6 * (height / 1080));

              ctx.font = `700 ${size}px Inter, sans-serif`;
              ctx.textBaseline = 'middle';
              const totalTextWidth = lineWords.reduce((acc, w) => acc + ctx.measureText(w).width, 0) + spacing * Math.max(0, lineWords.length - 1);
              const paddingX = 22 * (height / 1080);
              const paddingY = 10 * (height / 1080);
              const maxBoxWidth = width * 0.86;
              const boxWidth = Math.min(maxBoxWidth, totalTextWidth + paddingX * 2);
              const boxHeight = size + paddingY * 2;
              const boxX = xPos - boxWidth / 2;
              const boxY = yPos - boxHeight / 2;

              ctx.fillStyle = overlay.backgroundColor || 'rgba(0, 0, 0, 0.72)';
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8) : ctx.rect(boxX, boxY, boxWidth, boxHeight);
              ctx.fill();

              let cursorX = xPos - totalTextWidth / 2;
              lineWords.forEach((word, idx) => {
                const wordWidth = ctx.measureText(word).width;
                const isActive = idx === activeWordIdx;
                ctx.fillStyle = isActive ? (overlay.accentColor || '#22d3ee') : color;
                ctx.font = `${isActive ? '800' : '600'} ${size * (isActive ? (overlay.activeScale || 1.08) : 1)}px Inter, sans-serif`;
                ctx.fillText(word, cursorX, yPos);
                cursorX += wordWidth + spacing;
                ctx.font = `700 ${size}px Inter, sans-serif`;
              });
            }
            else if (overlay.animationType === 'progress') {
              // Draw a progress bar
              ctx.font = `bold ${size}px Inter, sans-serif`;
              ctx.fillStyle = color;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'bottom';
              ctx.fillText(text, xPos - width * 0.3, yPos - 12);

              const barWidth = width * 0.6;
              const barHeight = 8 * (height / 1080);
              const bx = xPos - barWidth / 2;
              const by = yPos;

              // Background bar track
              ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(bx, by, barWidth, barHeight, 4) : ctx.rect(bx, by, barWidth, barHeight);
              ctx.fill();

              // Active fill based on overlay progress
              const elapsedOverlay = relativeVideoTime - start;
              const progressPct = Math.min(elapsedOverlay / duration, 1);
              ctx.fillStyle = accent;
              ctx.beginPath();
              ctx.roundRect ? ctx.roundRect(bx, by, barWidth * progressPct, barHeight, 4) : ctx.rect(bx, by, barWidth * progressPct, barHeight);
              ctx.fill();
            }

            ctx.restore();
          }
        });

        // Request next frame
        animationFrameId = requestAnimationFrame(drawFrame);
      };

      const cleanupAndStop = () => {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        
        mediaRecorder.stop();
        
        // Restore original video state
        videoElement.loop = originalLoop;
        videoElement.muted = originalMuted;
        videoElement.currentTime = originalTime;
        videoElement.pause();

        // Release cloned audio tracks
        if (audioTrack) {
          audioTrack.stop();
        }
      };

      mediaRecorder.onstop = () => {
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        resolve({ blob, filename: `motionforge-render.${fileExtension}` });
      };

      mediaRecorder.onerror = (err) => {
        cleanupAndStop();
        reject(err);
      };

      // 3. Begin playback and capture recording
      mediaRecorder.start();
      videoElement.play();
      drawFrame();

    } catch (error) {
      reject(error);
    }
  });
}
