# Wavearea todo

> Textarea for audio. Open, see, edit, save.
> Merged from roadmap.md + legacy todo (2026-07); shipped work archived at the bottom.

## Next

* [ ] Undo/redo during playback (edits hold the playhead now; undo still pauses)
* [ ] Loop-range visual tint; played-region highlight refinement
* [ ] Click timecode gutter to add a marker at that line
* [ ] Export re-import differential test (encode → decode → same stats)
* [ ] Network-source resilience: retry + clear error for `?src=url`
* [ ] Mobile layout: touch targets, floater/toolbar placement, 320–768px checks

Done this wave (wavefont 3.6.0 published + consumed):
* [x] Trim edge silence — toolbar button, first/last block above settings threshold, commits as plain `clip` op
* [x] Paste/insert flash (CSS Custom Highlight API) + drop-target affordance (dashed outline)
* [x] Opener: sort select (date/name/size), two-step clear-all, file list state moved into the component
* [x] Per-segment ops — double-click selects the segment; gain/fade/trim apply (normalize needs engine range stats)
* [x] Gapless playback — next window prefetched and start()-scheduled at the seam; block-aligned cap removed the per-seam sample skip
* [x] Storage-quota failures surface an actionable notice (edits + background saves)

Previous waves:
* [x] Escape · edit-during-playback · pinch zoom · minimap overlays · live rec preview · `?` help
* [x] Gain by dB + clip warning · shrink threshold · export progress + FLAC · marker labels · opener delete/usage
* [x] Firefox CI project + iPhone-13 webkit smoke — physical iOS/Android pass still open

## Backlog

### Playback
* [ ] Consider facade transport (engine worker playback + live varispeed) as a player backend — would replace player.js window pump
* [ ] Gapless seam on mid-window speed change (currently drops the schedule, refetches once)

### Editing
* [ ] Breaks/markers positions are kept-but-clamped across `shrink` (multi-remove op) — remap them through the emitted removes
* [ ] Visible glyphs: `¶` for segment breaks, `·` for silence blocks?
* [ ] Delete-all edge: empty doc state, undo from opener

### Processing (engine has the ops — needs UI)
* [ ] Normalize: RMS/LUFS targets; per-selection (needs range-scoped stats resolve)
* [ ] Adjustable fade length/curve per use (settings default shipped)
* [ ] EQ (3-band via engine filter), noise gate / denoise (dynamics atoms from the 2.4+ plugin registry)
* [ ] Reverse selection, remix channels (mono↔stereo), crossfade soft-insert on paste
* [ ] Stereo view: L/R overlapped half-transparent, intersection dark

### View & navigation
* [ ] Zoom in below 1024 samples/char (needs engine stat granularity < BLOCK_SIZE or raw-PCM window stats)

### Settings & theming
* [ ] Theme system: CSS vars presets (light/dark/high-contrast), wavefont weight/roundness tuning, color ramps; respect prefers-color-scheme

### Robustness
* [ ] Physical-device pass: iOS Safari, Android Chrome (CI now covers Firefox + emulated iPhone webkit)
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
&norm=[target]                 peak dB number or LUFS preset name
&gain=f-t-db                   db signed, one decimal
&fadein=f-t[-curve] &fadeout=f-t[-curve]
&shrink=[f-t-]gapMs[_thr]      _thr = silence threshold, dB below zero
&br=a..b                       segment breaks (visual, current coords, applied after ops)
&m=a[-label]..b                markers, label URL-encoded (dots as %2E)
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

Transport wave: shrink pauses (gap in URL) · h:mm:ss timecodes · playback auto-scroll
with user-scroll respect · bottom transport bar (time/speed/volume/mute, persisted) ·
settings popover (gap/curve/norm target/theme, params serialize per-op) · dark theme ·
keyboard caret (arrows/shift/home/end/line) · `?session=` fallback for >50-op chains.

Processing wave (2026-07-10): gain by dB + clip warning · shrink silence threshold ·
export progress bar + FLAC · marker labels (URL/session/WAV labl) · opener delete +
storage usage · Firefox CI project + iPhone-webkit smoke · 353 e2e green across 4
browser projects.

Live wave (2026-07-10): edit during playback (playhead remap + window rebuild) ·
Escape (popovers → selection → loop) · ctrl+scroll/pinch zoom · minimap overlays
(selection/breaks/markers, cached redraw) · live recording level tail · `?` shortcuts
help · WebKit hidden-input focus fix · 374 e2e green.

Polish wave (2026-07-10, wavefont 3.6.0): trim edge silence (clip op via stats) ·
paste flash + drop affordance · opener sort/clear-all (file state → component) ·
segment double-click select · gapless playback windows (prefetch + seam schedule,
block-aligned cap) · quota notice · 392 e2e green.
