# Decode Benchmark Results

Date: 2026-03-13
Platform: macOS Darwin 24.6.0, Chromium (Playwright headless)
Machine: Apple Silicon (M-series)

## Test Files

| File | Size | Duration | Channels | Native Rate |
|------|------|----------|----------|-------------|
| birds-forest.mp3 | 6.08 MB | ~12.7 min | 2 (stereo) | 24000 Hz |
| sine-3s.mp3 | 0.05 MB | 3 s | 1 (mono) | 44100 Hz |

## Large File: birds-forest.mp3 (6 MB, stereo, 24 kHz)

3-run average:

| Decoder | Total (ms) | First chunk (ms) | Samples | Output Rate | Throughput |
|---------|-----------|-------------------|---------|-------------|------------|
| decodeAudioData | **1419** | 1419 (no streaming) | 33,638,112 | 44100 (resampled!) | 537x |
| WebCodecs + codec-parser | **1436** | 97.5 | 18,308,160 | 24000 (native) | 531x |
| mpg123-wasm | **469** | **5.9** | 18,306,456 | 24000 (native) | 1628x |

## Small File: sine-3s.mp3 (50 KB, mono, 44.1 kHz)

3-run average:

| Decoder | Total (ms) | First chunk (ms) | Samples | Output Rate | Throughput |
|---------|-----------|-------------------|---------|-------------|------------|
| decodeAudioData | **2.2** | 2.2 | 132,300 | 44100 | 1385x |
| WebCodecs + codec-parser | **6.9** | 1.9 | 133,632 | 44100 | 439x |
| mpg123-wasm | **3.1** | 3.1 | 132,300 | 44100 | 968x |

## Key Findings

### 1. mpg123-wasm is fastest overall (3x faster than native APIs)

Surprising result. mpg123-wasm decodes the 6MB file in **469ms** vs **1419ms** for decodeAudioData and **1436ms** for WebCodecs. This is likely because:
- mpg123 is a highly optimized C decoder compiled to WASM
- No resampling overhead (outputs at native rate)
- Synchronous, tight loop — no async/callback overhead
- No AudioData/AudioBuffer object creation overhead

### 2. decodeAudioData resamples — inflates sample count

decodeAudioData output 33.6M samples at 44100 Hz from a 24 kHz source file. That's a forced resample from 24 kHz → 44100 Hz, nearly doubling the data. This resampling explains ~40% of its overhead. The OfflineAudioContext was created with 44100 Hz — and there's no way to match source rate without knowing it first.

### 3. First-chunk latency: mpg123-wasm wins decisively

- mpg123-wasm: **5.9ms** to first decoded samples
- WebCodecs: **97.5ms** to first decoded output
- decodeAudioData: **1419ms** (must finish entire file first)

For progressive waveform rendering, mpg123-wasm delivers first visible waveform data in under 6ms.

### 4. WebCodecs has high overhead from codec-parser

WebCodecs native decoder is fast, but codec-parser's JS-based frame parsing adds significant per-frame cost. The total time (1436ms) is comparable to decodeAudioData despite skipping resampling — the frame-by-frame JS overhead eats the advantage.

### 5. Small files: all are fast enough

For a 3s file, all decoders complete in <7ms. The choice doesn't matter for small files — any path works.

## Decoder Comparison Summary

| Property | decodeAudioData | WebCodecs | mpg123-wasm |
|----------|----------------|-----------|-------------|
| Speed (large) | Slow (resample) | Slow (parser overhead) | **Fast** |
| Speed (small) | **Fastest** | Slowest | Fast |
| First chunk | Blocked until done | ~100ms | **~6ms** |
| Streaming | No | Yes | Yes |
| Output rate | Forces AudioContext rate | Native | Native |
| Browser support | Universal | Chrome/Edge | Universal (WASM) |
| Codec support | All browser codecs | All via parser | **MP3 only** |
| Bundle size | 0 (native) | codec-parser ~50KB | ~77KB (inlined WASM) |
| Worker support | No (needs AudioContext) | Yes | Yes |

## Architecture Recommendation

**Default decoder: mpg123-wasm** for MP3 files.
- 3x faster total decode
- 6ms to first waveform chunk (vs 100ms WebCodecs, 1400ms decodeAudioData)
- Streaming capable — feed chunks, get PCM immediately
- Runs in Worker — zero main thread blocking
- Universal browser support via WASM

**Fallback: WebCodecs** for non-MP3 formats (AAC, Opus, FLAC, Vorbis).
- Only option that supports multiple codecs in Worker
- codec-parser overhead acceptable when mpg123-wasm can't handle the format

**decodeAudioData**: not recommended as primary path.
- Forced resampling wastes time and memory
- Cannot run in Worker
- No streaming — blocks until entire file decoded
- Only advantage: zero bundle size, universal codec support

### For non-MP3 codecs (future)

wasm-audio-decoders family provides:
- `ogg-opus-decoder` (114 KB) — Opus/OGG
- `@wasm-audio-decoders/flac` (67 KB) — FLAC
- `@wasm-audio-decoders/ogg-vorbis` (99 KB) — Vorbis/OGG

Same API pattern as mpg123-decoder. Can be lazy-loaded per codec.

## Benchmark Source

`bench/decode-bench.html` + `bench/bench-src.js` — browser-based benchmark page.
`bench/run-bench.mjs` — headless Playwright runner.

Run: `node bench/run-bench.mjs [path-to-mp3]`
