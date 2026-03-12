import * as Comlink from 'comlink';
import CodecParser from 'codec-parser';

const BLOCK_SIZE = 1024; // samples per waveform character
const CHUNK_SIZE = 184320; // samples per chunk (~4.2s at 44.1kHz), LCM of format frame sizes

// Map file MIME type to codec string for AudioDecoder
const codecMap = {
  'audio/mpeg': 'mp3',
  'audio/aac': 'mp4a.40.2',
  'audio/mp4': 'mp4a.40.2',
  'audio/ogg': 'opus',
  'audio/opus': 'opus',
  'audio/webm': 'opus',
  'audio/flac': 'flac',
  'application/ogg': 'opus'
};

// stored decoded PCM chunks per channel
// chunks[channelIndex] = [Float32Array, Float32Array, ...]
let chunks = [];
let sampleRate = 44100;
let channelCount = 1;
let totalSamples = 0;


// convert f32 samples to waveform string
function samplesToWaveform(samples, blockSize = BLOCK_SIZE) {
  const LEVELS = 128, RANGE = 2

  let str = ''
  for (let i = 0, nextBlock = blockSize; i < samples.length;) {
    let sum = 0, x, v, shift

    // peak amplitude
    let max = -1, min = 1
    for (; i < nextBlock; i++) {
      x = i >= samples.length ? 0 : samples[i]
      sum += x
      max = Math.max(max, x)
      min = Math.min(min, x)
    }
    v = Math.min(LEVELS, Math.ceil(LEVELS * (max - min) / RANGE)) || 0
    shift = Math.round(LEVELS * (max + min) / (2 * RANGE))

    str += String.fromCharCode(0x0100 + v)
    str += (shift > 0 ? '\u0301' : '\u0300').repeat(Math.abs(shift))

    nextBlock += blockSize
  }

  return str
}


Comlink.expose({
  // decode file, send waveform strings progressively
  // cb.onWaveform(waveformStr) — called per chunk
  // cb.onError(e) — on decode error
  // returns {duration, channels, sampleRate}
  async decode(file, cb) {
    // reset state
    chunks = [];
    totalSamples = 0;
    channelCount = 1;
    sampleRate = 44100;

    let configured = false;
    // per-channel accumulators
    let count = 0;
    let channelChunks = null; // [Float32Array, ...] per channel

    const flushChunk = () => {
      if (count === 0) return;
      for (let ch = 0; ch < channelCount; ch++) {
        let data = count < CHUNK_SIZE ? channelChunks[ch].slice(0, count) : channelChunks[ch];
        chunks[ch].push(data);
      }
      totalSamples += count;
      // generate waveform from channel 0 (primary display channel)
      let waveform = samplesToWaveform(
        count < CHUNK_SIZE ? channelChunks[0].slice(0, count) : channelChunks[0]
      );
      cb.onWaveform?.(waveform);
      // reset
      count = 0;
      channelChunks = Array.from({ length: channelCount }, () => new Float32Array(CHUNK_SIZE));
    };

    const decoder = new AudioDecoder({
      output: (audioData) => {
        if (!configured) {
          channelCount = audioData.numberOfChannels;
          sampleRate = audioData.sampleRate || 44100;
          chunks = Array.from({ length: channelCount }, () => []);
          channelChunks = Array.from({ length: channelCount }, () => new Float32Array(CHUNK_SIZE));
          configured = true;
        }

        let frames = audioData.numberOfFrames;

        // copy each channel
        for (let ch = 0; ch < channelCount; ch++) {
          audioData.copyTo(channelChunks[ch].subarray(count, count + frames), {
            planeIndex: ch, format: 'f32-planar'
          });
        }
        count += frames;

        if (count >= CHUNK_SIZE) flushChunk();

        audioData.close();
      },
      error: (e) => cb.onError?.(e)
    });

    const parser = new CodecParser(file.type, {});
    const reader = file.stream().getReader();
    let ts = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      for (const frame of parser.parseChunk(value)) {
        if (decoder.state === "unconfigured") {
          decoder.configure({
            codec: codecMap[file.type],
            sampleRate: frame.header.sampleRate || 44100,
            numberOfChannels: frame.header.channels || 2
          });
        }
        decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: ts, data: frame.data }));
        ts += (frame.duration || 0.026) * 1000000;
      }
    }

    await decoder.flush();
    flushChunk(); // flush remaining samples
    decoder.close();

    return { duration: totalSamples / sampleRate, channels: channelCount, sampleRate };
  }
});
