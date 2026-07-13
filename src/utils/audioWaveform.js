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

/**
 * Extract audio from a media URL and encode it as WAV Base64
 * @param {string} url - Media URL
 * @param {number} startSec - Trim start time
 * @param {number} endSec - Trim end time
 * @returns {Promise<string>} Base64 encoded WAV string
 */
export async function extractAudioAsWavBase64(url, startSec, endSec) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const startOffset = Math.floor(startSec * sampleRate);
    const endOffset = Math.min(Math.floor(endSec * sampleRate), audioBuffer.length);
    const length = endOffset - startOffset;

    if (length <= 0) return null;

    const channels = audioBuffer.numberOfChannels;
    const wavBuffer = new ArrayBuffer(44 + length * channels * 2); // 16-bit PCM
    const view = new DataView(wavBuffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length * channels * 2, true);
    writeString(view, 8, 'WAVE');
    
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * channels * 2, true); // ByteRate
    view.setUint16(32, channels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, length * channels * 2, true);

    // Write interleaved PCM samples
    const channelData = [];
    for (let i = 0; i < channels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < channels; channel++) {
        let sample = Math.max(-1, Math.min(1, channelData[channel][startOffset + i]));
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, sample, true);
        offset += 2;
      }
    }

    // Convert to Base64 using chunks to avoid call stack limit
    let binary = '';
    const bytes = new Uint8Array(wavBuffer);
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (err) {
    console.error('Failed to extract WAV from video:', err);
    return null;
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
