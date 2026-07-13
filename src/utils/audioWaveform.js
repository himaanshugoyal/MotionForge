/**
 * Audio Waveform Extraction Utility using Web Audio API
 */

export async function fetchAndDecodePeaks(url, numberOfPeaks = 100) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch video file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Use standard AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser');
    }

    const audioCtx = new AudioContextClass();
    
    // Decode audio data from MP4/WebM/MOV container
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    if (audioBuffer.numberOfChannels === 0) {
      return new Array(numberOfPeaks).fill(0);
    }

    const channelData = audioBuffer.getChannelData(0);
    const sampleSize = Math.floor(channelData.length / numberOfPeaks);
    const peaks = [];

    for (let i = 0; i < numberOfPeaks; i++) {
      const start = i * sampleSize;
      const end = start + sampleSize;
      let max = 0;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }

    // Normalize peaks to [0, 1] range
    const maxPeak = Math.max(...peaks);
    if (maxPeak > 0) {
      return peaks.map((p) => p / maxPeak);
    }

    return peaks;
  } catch (err) {
    console.warn(`Audio waveform extraction skipped for ${url}:`, err);
    return null;
  }
}

/**
 * Analyze audio to detect continuous speaking segments (silence removal).
 * @param {string} url - Media URL
 * @param {number} threshold - Amplitude threshold [0, 1] (e.g. 0.03 for 3%)
 * @param {number} minSilenceSec - Minimum duration of silence to be cut
 * @param {number} minKeepSec - Minimum duration of a keep segment
 * @returns {Array<{start: number, end: number}>} Array of keeping segments
 */
export async function detectAudioSegments(url, threshold = 0.03, minSilenceSec = 0.5, minKeepSec = 0.2) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    if (audioBuffer.numberOfChannels === 0) return null;

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    const chunkDuration = 0.1; // 100ms
    const chunkSize = Math.floor(sampleRate * chunkDuration);
    const totalChunks = Math.floor(channelData.length / chunkSize);
    
    const isChunkLoud = new Array(totalChunks).fill(false);
    
    // 1. Analyze 100ms chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = start + chunkSize;
      let max = 0;
      for (let j = start; j < end; j++) {
        const val = Math.abs(channelData[j]);
        if (val > max) max = val;
      }
      isChunkLoud[i] = max >= threshold;
    }
    
    // 2. Form contiguous loud segments
    let segments = [];
    let currentStart = null;
    
    for (let i = 0; i < totalChunks; i++) {
      if (isChunkLoud[i]) {
        if (currentStart === null) currentStart = i;
      } else {
        if (currentStart !== null) {
          segments.push({ startChunk: currentStart, endChunk: i - 1 });
          currentStart = null;
        }
      }
    }
    if (currentStart !== null) {
      segments.push({ startChunk: currentStart, endChunk: totalChunks - 1 });
    }
    
    if (segments.length === 0) return null; // Fully silent
    
    // 3. Merge segments separated by silences shorter than minSilenceSec
    const minSilenceChunks = Math.ceil(minSilenceSec / chunkDuration);
    let mergedSegments = [segments[0]];
    
    for (let i = 1; i < segments.length; i++) {
      const prev = mergedSegments[mergedSegments.length - 1];
      const curr = segments[i];
      const gap = curr.startChunk - prev.endChunk - 1;
      
      if (gap < minSilenceChunks) {
        // Merge them
        prev.endChunk = curr.endChunk;
      } else {
        mergedSegments.push(curr);
      }
    }
    
    // 4. Convert to seconds and filter by minKeepSec
    const timeSegments = mergedSegments.map(seg => ({
      start: seg.startChunk * chunkDuration,
      end: (seg.endChunk + 1) * chunkDuration
    })).filter(seg => (seg.end - seg.start) >= minKeepSec);
    
    return timeSegments.length > 0 ? timeSegments : null;
  } catch (err) {
    console.warn('Audio segmentation failed:', err);
    return null;
  }
}
