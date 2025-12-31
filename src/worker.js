import * as Comlink from 'comlink';
import CodecParser from 'codec-parser';

const CHUNK_SIZE = 184320; // Number of samples per chunk - least common multiple of all format frame sizes (~4.2 sec at 44.1kHz)

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


Comlink.expose({
  async decode(file, cb) {
    console.log('Decoding started for', file.name);
    let count = 0, chunk = new Float32Array(CHUNK_SIZE)

    const decoder = new AudioDecoder({
      output: (audioData) => {
        audioData.copyTo(chunk.subarray(count, count += audioData.numberOfFrames), {
          planeIndex: 0, format: 'f32-planar'
        });

        if (count >= CHUNK_SIZE) {
          cb.onProgress?.(Comlink.transfer(chunk, [chunk.buffer]));
          chunk = new Float32Array(CHUNK_SIZE);
          count = 0;
        }
        audioData.close();
      },
      error: cb.onError
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
    chunk = chunk.slice(0, count);
    if (count > 0) cb.onProgress?.(Comlink.transfer(chunk, [chunk.buffer]));
    decoder.close();
  }
});
