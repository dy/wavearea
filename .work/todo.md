# Wavearea todo

> Textarea for audio. Open, see, edit, save.
> Merged from roadmap.md + legacy todo (2026-07); shipped work archived at the bottom.

## Next

* [ ] Gain/amplify selection by dB (settings has the popover pattern; needs value input + clip indicator)
* [ ] Silence threshold setting wired into shrink/trim ops
* [ ] Export progress bar (engine emits `progress`) + FLAC button
* [ ] Marker labels (editable phrases; export as cue labl text)
* [ ] File management in opener: delete stored file, storage usage
* [ ] Real-device pass: Firefox, iOS Safari (transport bar, drag selection, playback)

Done this wave: shrink pauses (2.6, gap in URL) · h:mm:ss timecodes · playback
auto-scroll with user-scroll respect · bottom transport bar (time/speed/volume/
mute, persisted) · settings popover (gap/curve/norm target/theme, params
serialize per-op) · dark theme · keyboard caret (arrows/shift/home/end/line) ·
`?session=` fallback for >50-op chains

## Backlog

### Playback
* [ ] Edit during playback: rebuild window when edit is at/behind playhead, clamp position (arch notes below)
* [ ] Gapless window transitions: schedule next source before current ends (10s window auto-continue can dip)
* [ ] Escape clears selection and stops loop
* [ ] Highlight of played region refinement; loop-range visual tint
* [ ] Consider facade transport (engine worker playback + live varispeed) as a player backend — would replace player.js window pump

### Editing
* [ ] Per-segment operations (normalize/gain one segment)
* [ ] Marker labels (editable phrases; exports as cue labl text)
* [ ] Paste visual feedback (brief highlight)
* [ ] Breaks/markers positions are kept-but-clamped across `shrink` (multi-remove op) — remap them through the emitted removes
* [ ] Visible glyphs: `¶` for segment breaks, `·` for silence blocks?
* [ ] Delete-all edge: empty doc state, undo from opener

### Processing (engine has the ops — needs UI)
* [ ] Gain/amplify selection by dB + clip indicator
* [ ] Normalize: RMS/LUFS targets; per-selection (needs range-scoped stats resolve)
* [ ] Fade curves (linear/exp/log/cos); adjustable-fade
* [ ] EQ (3-band via engine filter), noise gate / denoise (dynamics atoms from the 2.4+ plugin registry)
* [ ] Reverse selection, remix channels (mono↔stereo), crossfade soft-insert on paste
* [ ] Stereo view: L/R overlapped half-transparent, intersection dark

### View & navigation
* [ ] Ctrl+scroll / pinch zoom, centered on caret
* [ ] Zoom in below 1024 samples/char (needs engine stat granularity < BLOCK_SIZE or raw-PCM window stats)
* [ ] Click gutter to add marker at line
* [ ] Minimap: show markers/breaks/selection; current-window shading polish

### Files & export
* [ ] File management in opener: delete stored file, clear all, storage usage, sort control
* [ ] Export progress bar (engine emits `progress`), FLAC button, re-import differential test
* [ ] Recording: live waveform preview while recording (pushable instance streams stats)
* [ ] Drop-on-waveform visual affordance (dragover style exists, needs design)
* [ ] Network-source resilience: retry + clear error for `?src=url`

### Settings & theming
* [ ] Theme system: CSS vars presets (light/dark/high-contrast), wavefont weight/roundness tuning, color ramps; respect prefers-color-scheme
* [ ] Keyboard shortcuts reference + about (support/github/ॐ)
* [ ] Storage quota exceeded: surface a warning, not just console

### Robustness
* [ ] Real-device pass: Firefox, iOS Safari touch/selection/playback, Android Chrome
* [ ] Mobile layout: touch targets, floater/toolbar placement, 320–768px checks
* [ ] A11y: roles + screen-reader announcements (playback state, time), keyboard access design for op buttons (command palette?), axe-core audit
* [ ] Offline/PWA verification on deployed https (SW is registered there only)
* [ ] Perf: waveform delta re-render instead of full stat re-query per edit (~100ms at 8h scale today); profile decode/render/latency targets
* [ ] Stress: 8h real-file soak (decode minutes, OPFS quota), rapid-ops E2E

## Ideas

* Spectrogram view toggle; color by spectrum
* Embeddable component (`<wave-area src>`), textarea mode, adjustable everything
* Audiobook mode: chapters as segments, export with cover
* AI: transcript overlay (Whisper), speech generation at caret (11labs/free TTS)
* Sampler mode: named segments dictionary, play by sequence
* Batch processing (open folder, normalize all)
* System clipboard audio interop; shareable short URLs
* Peak meters during playback; auto-save sessions
* Random phrase/sample sources config (quotes, mantras, Prabhupada vani)

## Reference

### URL scheme (the state)
```
?src=<store-id | remote-url>   source (store ids are ts-name)
&bs=2048                       display block size (zoom), default 1024
&del=f-t &sil=at-n &clip=f-t   ops, repeated params, document order = application order
&cp=f-t-v-at                   paste: clip of chain-state v inserted at `at`
&ins=at-<store-id>             external file / recording insert
&norm= &fadein=f-t &fadeout=f-t &shrink=[f-t]
&br=a..b                       segment breaks (visual, current coords, applied after ops)
&m=a..b                        markers
```
All offsets in blocks of `bs` samples. One UI op = one engine edit (undo pops both).

### Architecture
- Engine = `audio` (npm) self-hosted in a Worker (`src/engine-worker.js`); main thread holds
  the `audio/worker` facade — PCM never leaves the worker (paged, OPFS-evicted).
- Waveform = wavefont string from per-block min/max stats; progressive via `data` deltas.
- Rendering is virtualized: full string in state, DOM text node holds visible lines ± buffer,
  spacers are #editarea padding (single-text-node invariant; `winBase` maps selection offsets).
- Ops history/redo live UI-side as URL ops; engine executes; breaks/markers shift per op
  with per-op snapshots for undo.
- Player: AudioBufferSourceNode windows over `a.read()` (Safari-tested); `<audio>`/worklet fallbacks.

### Principles (short form)
Text IS the interface · non-destructive op chain in URL (no hidden state) · browser-native
over library · progressive everything · offline/local-only · keyboard-first · ship what
works, hide what doesn't. Anti: no DAW, no premature abstraction, no mocks in tests,
no CSS-in-JS, don't fight sprae.

## Done (archive)

Phases 0–6 of the original roadmap shipped 2026-07: engine swap to published `audio`
(worker facade, stat-delta progressive render) · playback (3 backends, loop selection,
smooth caret) · editing (delete/merge, silence typing, copy/cut/paste with chain-state
snapshots, trim, drop-insert, segments via Enter/Backspace-join, markers, undo/redo,
full URL serialize/replay) · processing (normalize, fades) · zoom 1024–8192 with coord
rescale · minimap · jump-to-time (g) + timecode click · mic recording (insert at caret /
new doc) · export WAV/MP3, selection export, segment cue points · opener (open/sample/
silence/record/drop + recent files) · virtualization for multi-hour files (~0ms scroll,
~100ms edit at 8h scale) · PWA shell + reduced-motion/aria pass · 199 e2e/unit tests.
