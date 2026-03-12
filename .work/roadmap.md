# Wavearea Roadmap

> Textarea for audio. Open, see, edit, save.


## Design Principles

1. **Text IS the interface.** Every audio operation maps to a text operation. Select = select audio. Delete = delete audio. The waveform is not a visualization — it is the editable document. Never break this metaphor.

2. **Non-destructive by default.** Original audio stays intact. Operations are a chain of transforms (stored in URL). Undo = pop operation. Share = copy URL. This is the architectural moat.

3. **Browser-native over library.** Use AudioDecoder, AudioWorklet, OPFS, ContentEditable, Range API, CSS animations, variable fonts. Every dependency must justify its existence against a native alternative.

4. **Progressive rendering.** Stream decode → stream render → stream play. Never block on full file. User sees waveform growing as file decodes. 100MB file should feel as snappy as 1MB.

5. **Offline-first, local-only.** Audio never leaves the device. No server, no upload, no account. OPFS for persistence. Service worker for offline. Privacy is a feature.

6. **Single-channel architecture.** Main thread = UI + state (sprae). Worker = decode/encode. Worklet = playback. Store = OPFS. Clean boundaries, no leaking.

7. **Constraint as feature.** Wavefont limits resolution to ~1024 samples/char. This is not a bug — it makes hour-long files viewable in a single scroll. Zoom changes blockSize, not the paradigm.

8. **No hidden state.** URL contains full operation history. Refreshing the page reconstructs exact state. If it's not in the URL or OPFS, it doesn't exist.

9. **Keyboard-first, mouse-friendly.** Every operation accessible via keyboard. Mouse/touch enhances but never required. Space=play, arrows=navigate, backspace=delete. No custom shortcuts to memorize — use what text editors use.

10. **Ship what works, hide what doesn't.** No broken buttons. No "coming soon". Feature either works completely or doesn't exist in UI.


## Anti-Patterns to Avoid

- **Don't build a DAW.** No multi-track. No effects chain. No MIDI. No plugins architecture. One file, one waveform, simple ops.
- **Don't reimplement the browser.** ContentEditable handles selection, caret, text ops. Range API handles positioning. CSS handles animation. Don't fight them.
- **Don't premature-virtualize.** Virtual rendering is complex. Start with plain text content. Only virtualize when we hit measurable perf walls (>10min files).
- **Don't abstract before second use.** No `AudioManager`, no `WaveformRenderer` class, no `OperationDispatcher`. Functions. Direct calls. Abstractions emerge from repetition, not prediction.
- **Don't mock in tests.** Playwright tests with real audio files, real browser, real OPFS. If it passes in tests, it works in production.
- **Don't CSS-in-JS.** Plain CSS. CSS variables for theming. Nesting for structure. No build step for styles.
- **Don't fight sprae.** State in `:scope`, logic in expressions, effects in `:fx`. If you need something sprae doesn't do, check if you're overcomplicating.


---


## Phase 0: Cleanup & Foundation
> Clean slate. Remove dead weight, fix the pipeline, know the limits.

* [ ] Update sprae 12.3.9 → 12.4.15
  * [ ] Audit breaking changes (`:html` template support, directive dispose changes)
  * [ ] Update import paths if needed
  * [ ] Verify all existing sprae bindings still work
* [ ] Remove dead code
  * [ ] `pushOp`, `runOp`, `renderAudio`, `loadAudioFromURL` — dead references
  * [ ] `inputHandlers` object — commented-out handlers, broken `deleteContentBackward`
  * [ ] `caretObserver` IntersectionObserver — commented out
  * [ ] Sample URL loader at bottom of wavearea.js
  * [ ] `normalize()` stub in api.js — references undefined `buffers`
  * [ ] `delete()`, `save()`, `insert()` empty stubs in api.js
  * [ ] `<audio>` element playback code in wavearea.js (`playClip`, `audio.*` refs)
    — don't fix, just strip. Phase 1 replaces with AudioWorklet.
  * [ ] Audit index.html: remove commented-out sections (loader, playback panel, dialog, krsnzd link)
* [ ] Move samplesToWaveform to Worker
  * [ ] Worker generates waveform string per decoded chunk
  * [ ] Worker sends waveform string (not raw samples) to main thread via Comlink
  * [ ] Main thread NEVER receives raw PCM — only waveform strings
  * [ ] Remove samplesToWaveform from wavearea.js
  * [ ] Update api.js loadFile: onProgress receives waveform string, not Float32Array
* [ ] Fix Worker: decode all channels
  * [ ] Current worker.js only reads planeIndex:0 — stereo files lose R channel
  * [ ] Store both channels as planar Float32Arrays (or interleaved)
  * [ ] Generate waveform string per channel (L and R separately for stereo rendering later)
  * [ ] Mono files: single channel, same as now
* [ ] Fix api.js
  * [ ] loadFile: clean interface — accept File or OPFS file ID, return {duration, channels}
  * [ ] Error handling: decode failure, unsupported codec, empty file
* [ ] Fix store/opfs.js
  * [ ] Verify works across Chrome, Firefox, Safari
  * [ ] Handle storage quota exceeded
  * [ ] Opening stored file must work end-to-end
* [ ] Benchmark contenteditable limits
  * [ ] Generate synthetic waveform strings: 10K, 50K, 100K, 200K chars
  * [ ] Measure: DOM layout time, selection/caret response, scroll performance
  * [ ] Find the threshold where it degrades
  * [ ] Document: "files longer than Xmin at blockSize=1024 need virtualization"
  * [ ] This determines whether Phase 4 virtual rendering is critical or nice-to-have
* [ ] Setup Playwright
  * [ ] Install playwright, configure browsers (chromium, firefox, webkit)
  * [ ] Create test fixtures: 1s silence, 3s sine wave, 30s speech (small mp3s)
  * [ ] Test: open app, verify empty state renders
  * [ ] Test: load fixture file, verify waveform appears
  * [ ] Test: click waveform, verify caret positions
  * [ ] Test: onbeforeinput coverage — which inputTypes fire in each browser
* [ ] Build system
  * [ ] Verify esbuild config handles sprae 12.4.15
  * [ ] Add `npm test` script for playwright
  * [ ] Dev server with watch mode


## Phase 1: Solid Playback
> Play any audio file flawlessly. AudioBufferSourceNode first, AudioWorklet when needed.

* [ ] Playback engine abstraction
  * [ ] Thin interface: `play(fromBlock)`, `pause()`, `seek(block)`, `setLoop(start, end)`, `setVolume(v)`, `setSpeed(r)`
  * [ ] No continuous position reporting — main thread interpolates:
    Engine emits events: `{started: {block, time}}`, `{looped: {block}}`, `{ended: true}`
    Main thread calculates: `currentBlock = startBlock + floor((now - startTime) * sr / blockSize * speed)`
    Updates only on rAF or user interaction. No polling, no MessageChannel, no SAB counter.
  * [ ] UI code only calls the interface, never the engine directly
* [ ] Primary engine: AudioBufferSourceNode
  * [ ] Worker assembles Float32Array window (~30s per channel) from virtual timeline
  * [ ] Transfer Float32Arrays to main thread (Transferable, zero-copy)
  * [ ] Main thread creates AudioBuffer via audioCtx.createBuffer(), copies channel data
    (AudioBuffer is NOT Transferable — this copy is unavoidable but fast)
  * [ ] `source.start(when, offset, duration)` — precise start position
  * [ ] Built-in `loop`, `loopStart`, `loopEnd` — free loop support
  * [ ] `source.playbackRate` — built-in speed control
  * [ ] GainNode before destination — volume/mute
  * [ ] Gapless window transition: schedule next source node before current ends
    `source2.start(audioCtx.currentTime + remainingSeconds)`
    Worker pre-builds next window while current plays
  * [ ] On seek: stop current source, request new window, create new source
  * [ ] On edit during playback: if edit behind caret → rebuild window and resume (see arch notes)
  * [ ] Simple, proven, works everywhere including iOS
* [ ] Future engine: AudioWorklet (for when we need sample-level control)
  * [ ] Needed for: real-time effects, crossfade, recording mix-in
  * [ ] Worker sends PCM chunks to Worklet via port.postMessage + Transferable
  * [ ] SAB ring buffer as optimization (needs COOP/COEP via Service Worker)
  * [ ] Defer to Phase 3/5 — AudioBufferSourceNode is sufficient for playback + editing
* [ ] Fallback engine: `<audio>` element
  * [ ] For browsers without AudioContext (rare, but wire the interface)
  * [ ] Minimal implementation, no investment
* [ ] Caret animation during playback
  * [ ] Main thread interpolates block position from start event + elapsed time
  * [ ] Update caret via rAF: compute block → set selection → update CSS vars
  * [ ] Investigate CSS @property + animation for smooth caret overlay
  * [ ] Auto-scroll: follow caret when offscreen
  * [ ] Respect user scroll — if user scrolls during playback, pause auto-scroll
  * [ ] Resume auto-scroll when caret re-enters viewport
* [ ] Selection & loop
  * [ ] Select range → play loops that range (AudioBufferSourceNode.loop = true)
  * [ ] Visual indication of loop range (subtle background color)
  * [ ] Escape or click outside to clear selection and stop loop
  * [ ] Selection during playback: update loop range live
* [ ] Keyboard controls
  * [ ] Space: play/pause
  * [ ] Left/Right: move caret by 1 block
  * [ ] Shift+Left/Right: extend selection
  * [ ] Home/End: jump to start/end
  * [ ] Ctrl+Left/Right: jump by 10 blocks (or by "line" worth)
* [ ] Stereo rendering
  * [ ] Worker already sends L/R waveform strings separately (from Phase 0)
  * [ ] Render L/R as overlapping waveforms with different opacity/color via CSS variable
  * [ ] Mono files: single waveform (current behavior)
  * [ ] Toggle: show stereo / show mono (mixdown)
* [ ] Timecodes
  * [ ] Accurate time display per line
  * [ ] Click timecode → jump to that position
  * [ ] Current time display near play button
  * [ ] Format: `m:ss` for <1hr, `h:mm:ss` for ≥1hr
* [ ] Volume control
  * [ ] GainNode in audio graph — simple slider
  * [ ] Mute toggle
  * [ ] Remember volume in localStorage
* [ ] Playback speed
  * [ ] 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
  * [ ] Click to cycle or small dropdown
  * [ ] `source.playbackRate.value = rate` — built-in, no sample manipulation
* [ ] Tests
  * [ ] Play from start, verify caret moves
  * [ ] Play from middle, verify correct audio position
  * [ ] Pause and resume, verify continuity
  * [ ] Loop selection, verify repeats
  * [ ] Keyboard navigation
  * [ ] Stereo file renders two channels
  * [ ] Volume/speed controls work


## Phase 2: Editing Operations
> The textarea metaphor comes alive: delete, insert, copy, paste.

* [ ] Operation model
  * [ ] Define op types: `del(from-to)`, `sil(at-dur)`, `mov(from-to-dest)`, `br(offset)`
  * [ ] Ops are append-only list — never mutate original PCM chunks
  * [ ] Worker resolves ops → virtual timeline (position → chunk+offset mapping)
  * [ ] Playback reads virtual timeline; export materializes it
  * [ ] Op chain stored in URL search params, serialized/deserialized on load
  * [ ] Ops are composable and orderable
* [ ] Delete
  * [ ] Backspace: delete 1 block before caret
  * [ ] Delete key: delete 1 block after caret
  * [ ] Select range + Backspace/Delete: delete selection
  * [ ] Debounce consecutive backspace presses into single `del` op
  * [ ] Visual: waveform shrinks, caret repositions
  * [ ] Audio: Worker updates virtual timeline, playback adapts immediately
* [ ] Insert silence
  * [ ] Position caret → insert N blocks of silence
  * [ ] Via keyboard shortcut or menu action
  * [ ] Use case: add pause between speech segments
* [ ] Copy / Cut / Paste
  * [ ] Ctrl+C: copy selected audio blocks to internal clipboard
  * [ ] Ctrl+X: cut (copy + delete)
  * [ ] Ctrl+V: paste at caret position
  * [ ] Internal clipboard (not system clipboard — raw audio data is not text)
  * [ ] Visual feedback: brief highlight on paste
* [ ] Trim to selection
  * [ ] Select range → trim: delete everything outside selection
  * [ ] Common workflow: select the good part, trim the rest
* [ ] Segments / breaks
  * [ ] Enter key: insert segment break at caret
  * [ ] Visual: slight gap or line between segments
  * [ ] Segments allow per-segment operations (normalize one segment, etc.)
  * [ ] Backspace at segment start: join with previous segment
* [ ] Undo / Redo
  * [ ] App-level undo stack (NOT browser history — don't abuse pushState)
  * [ ] Ctrl+Z: pop last op from ops list → push to redo stack → Worker.applyOp(undo)
  * [ ] Ctrl+Shift+Z: pop from redo stack → push to ops list → Worker.applyOp(redo)
  * [ ] New edit clears redo stack
  * [ ] URL updated after each op change (or session persisted to OPFS if ops > ~50)
* [ ] Waveform sync after edits
  * [ ] After op applied: Worker recalculates virtual timeline
  * [ ] Worker returns waveform string delta (only changed region) + new total duration
  * [ ] Main thread splices delta into waveform string, updates UI
  * [ ] If playing: engine handles buffer rebuild if edit affects current window (see arch notes)
* [ ] Tests
  * [ ] Delete single block (backspace)
  * [ ] Delete selection (various positions: head, middle, tail)
  * [ ] Delete all
  * [ ] Insert silence at start, middle, end
  * [ ] Copy+paste within same file
  * [ ] Cut+paste
  * [ ] Trim to selection
  * [ ] Undo each operation
  * [ ] Redo after undo
  * [ ] URL reflects operations after each edit
  * [ ] Refresh page → same state (URL reconstruction)


## Phase 3: Audio Processing
> Audacity's essential transforms, nothing more.

* [ ] Normalize loudness
  * [ ] Peak normalization: scale to target peak (default -1dBFS)
  * [ ] RMS normalization: scale to target RMS
  * [ ] LUFS normalization: broadcast-standard loudness
  * [ ] Apply to selection or entire file
  * [ ] Non-destructive: `norm(from-to-target)` op
* [ ] Trim silence
  * [ ] Detect silence below threshold (configurable, default -40dB)
  * [ ] Trim leading/trailing silence
  * [ ] Option: trim all internal silences longer than N seconds
  * [ ] Keep configurable padding (default 100ms) around speech
  * [ ] Preview before applying
* [ ] Fade in / Fade out
  * [ ] Apply to selection start/end
  * [ ] Linear or logarithmic curve
  * [ ] Default duration: 50ms (click removal) or selection length
  * [ ] Visual: waveform amplitude tapers
* [ ] Equalization
  * [ ] 3-band EQ: low (<300Hz), mid (300-3kHz), high (>3kHz)
  * [ ] Simple gain per band: -12dB to +12dB
  * [ ] Biquad filters via Web Audio API
  * [ ] Apply to selection or whole file
  * [ ] Real-time preview during adjustment
* [ ] Noise gate
  * [ ] Threshold: below which audio is silenced
  * [ ] Attack/release times
  * [ ] Good for: removing background noise between speech
  * [ ] Simpler than full noise reduction, more reliable
* [ ] Amplify / Gain
  * [ ] Adjust volume of selection by dB amount
  * [ ] Clip indicator if result would exceed 0dBFS
* [ ] Tests
  * [ ] Normalize: verify peak reaches target
  * [ ] Trim silence: verify silence removed, speech preserved
  * [ ] Fade: verify amplitude envelope shape
  * [ ] EQ: verify frequency response change
  * [ ] Noise gate: verify silence between speech


## Phase 4: Zoom & Navigation
> See the forest and the trees.

* [ ] Zoom levels
  * [ ] blockSize: 256, 512, 1024, 2048, 4096 samples/char
  * [ ] Ctrl+scroll or pinch to zoom
  * [ ] Zoom centered on caret position
  * [ ] Re-render waveform string on zoom change
  * [ ] Cache decoded samples — only regenerate waveform string
* [ ] Minimap
  * [ ] Small fixed-height overview of entire file at top or side
  * [ ] Viewport indicator: rectangle showing current scroll position
  * [ ] Click minimap to jump
  * [ ] Drag viewport rectangle to scroll
  * [ ] Renders at coarsest zoom level (4096+ blockSize)
* [ ] Markers / Bookmarks
  * [ ] Click gutter to add marker at line
  * [ ] Keyboard shortcut to add marker at caret
  * [ ] Navigate between markers: Ctrl+Up/Down or dropdown
  * [ ] Markers stored in URL: `m=offset1,offset2,...`
* [ ] Search by time
  * [ ] Jump to specific time: click timecode area, type time
  * [ ] `g` key (like vim) → enter time → jump
* [ ] Virtual rendering (if needed)
  * [ ] Only render visible lines + buffer above/below
  * [ ] Maintain scroll position and caret mapping
  * [ ] Benchmark first: how many chars before DOM is slow?
  * [ ] ContentEditable + virtualization is hard — may need creative approach
* [ ] Tests
  * [ ] Zoom in/out preserves caret time position
  * [ ] Minimap reflects scroll position
  * [ ] Marker add/navigate/remove
  * [ ] Jump to time


## Phase 5: Settings, Theme & Export
> Make it yours. Get your work out.

* [ ] Theme system
  * [ ] CSS custom properties for all visual aspects
  * [ ] Presets: light (default), dark, high-contrast
  * [ ] Wavefont tuning: weight (thin→thick), roundness, alignment
  * [ ] Waveform color: mono, gradient by amplitude, gradient by frequency
  * [ ] Store preference in localStorage
* [ ] Settings panel
  * [ ] Block size (zoom default)
  * [ ] Sample rate display format
  * [ ] Time display format (m:ss, m:ss.ms, samples, SMPTE)
  * [ ] Default normalization target
  * [ ] Silence threshold
  * [ ] Theme selection
  * [ ] Keyboard shortcut reference
  * [ ] About / credits / license (Krishnized)
* [ ] Export / Download
  * [ ] WAV export (straightforward: write header + samples)
  * [ ] MP3 export (via lame.js or similar wasm encoder)
  * [ ] Export selection only
  * [ ] Filename: `{original}-edited.{ext}`
  * [ ] Progress indicator for encoding
* [ ] Recording
  * [ ] Microphone input via MediaStream
  * [ ] Record at caret position (insert recording into waveform)
  * [ ] Record to new file
  * [ ] Visual: live waveform grows as you record
  * [ ] Stop recording → audio integrated into waveform
* [ ] Drag and drop
  * [ ] Drop file anywhere → open it
  * [ ] Drop on existing waveform → insert at caret? or replace?
  * [ ] Visual feedback during drag
  * [ ] Multiple files: open first, queue rest? or reject?
* [ ] File management
  * [ ] Delete stored files from recent list
  * [ ] Clear all stored files
  * [ ] Storage usage indicator
  * [ ] Sort by: name, date, size, duration
* [ ] Tests
  * [ ] Theme switching doesn't break layout
  * [ ] Export WAV: re-import and compare waveforms
  * [ ] Recording: start, stop, verify waveform appears
  * [ ] Drag-drop file opens correctly
  * [ ] Settings persist across sessions


## Phase 6: Robustness & Polish
> Production quality. No embarrassments.

* [ ] Cross-browser
  * [ ] Chrome/Edge: full feature set
  * [ ] Firefox: verify OPFS, AudioWorklet, AudioDecoder
  * [ ] Safari: verify all workarounds (latency, preload, etc.)
  * [ ] Mobile Safari: touch selection, playback start on gesture
  * [ ] Mobile Chrome: responsive layout, touch-friendly controls
* [ ] Error handling
  * [ ] Unsupported codec: clear message, suggest converting
  * [ ] Corrupt file: graceful failure, no crash
  * [ ] Storage full: warn before losing data
  * [ ] AudioContext blocked: guide user to click/tap to enable
  * [ ] Network error (URL source): retry + offline fallback
* [ ] Performance
  * [ ] Profile: decode time, render time, playback latency
  * [ ] Target: <2s to first waveform line for 10MB file
  * [ ] Target: <50ms caret response time
  * [ ] Target: <16ms playback position update
  * [ ] Memory: don't hold decoded samples twice (worker + main)
  * [ ] Large files (>1hr): streaming decode, chunked render
* [ ] Accessibility
  * [ ] ARIA roles for custom controls
  * [ ] Focus management: trap in modals, return on close
  * [ ] Screen reader: announce playback state, current time
  * [ ] Respect prefers-reduced-motion
  * [ ] Respect prefers-color-scheme for auto dark mode
* [ ] Offline / PWA
  * [ ] Service worker for static assets
  * [ ] App manifest for installability
  * [ ] Works fully offline after first load
* [ ] Responsive layout
  * [ ] Mobile: waveform fills width, larger touch targets
  * [ ] Tablet: comfortable with or without keyboard
  * [ ] Desktop: keyboard-optimized, dense layout
  * [ ] Test at: 320px, 768px, 1024px, 1440px widths
* [ ] Final tests
  * [ ] Full E2E: open → edit → export → re-import → verify
  * [ ] Stress test: 1hr file, rapid operations
  * [ ] All 47 test specs from test.js implemented
  * [ ] Cross-browser test matrix
  * [ ] Accessibility audit (axe-core via playwright)


## Architecture Notes

### Thread responsibilities
```
Main thread (UI):        ops list, waveform string, caret/selection, sprae state. NO raw PCM.
                         Creates AudioBufferSourceNode from received Float32Arrays.
Web Worker (engine):     original PCM chunks, ops list copy, virtual timeline resolver,
                         waveform string generator, playback buffer assembler.
                         Exposes clean API — see Worker API below.
AudioWorklet (future):   for effects/crossfade/recording. Not used in Phase 1.
```

### Audio pipeline
```
Compressed file (MP3/AAC/Opus/FLAC)
  → Web Worker: AudioDecoder + CodecParser → Float32Array chunks (~4.2s, stored in Worker)
  → Worker generates waveform string per chunk → sends string to Main thread
  → Main thread appends to waveform display. Never sees raw PCM.
  → On play: Worker resolves ops → assembles Float32Array window (~30s per channel)
    → transfers Float32Arrays to Main thread (Transferable, zero-copy)
    → Main thread creates AudioBuffer via audioCtx.createBuffer(), copies channel data
    → AudioBufferSourceNode → GainNode → speakers
  → Gapless: main thread schedules next source node at exact end time of current
    → source2.start(audioCtx.currentTime + remainingSeconds)
    → Worker pre-builds next window while current plays
  → (Future: AudioWorklet for effects/crossfade/recording — same playback interface)
```

Raw PCM chunks live ONLY in the Worker. Main thread never holds raw audio data long-term.
Waveform string is generated IN the Worker during decode, sent as text to main thread.
Main thread holds only the current + next playback Float32Arrays (~30s × 2 ≈ 10MB stereo).
Note: AudioBuffer is NOT Transferable — Worker sends raw Float32Arrays, main thread wraps.

### Worker API (Comlink-exposed)
```
decode(file, onWaveform, onError) → {duration, channels, sampleRate}
applyOp(op) → {waveformDelta, newDuration}  // updates virtual timeline, returns affected waveform
getPlaybackWindow(fromBlock, length) → {channels: Float32Array[], fromBlock, toBlock}
getWaveform(fromBlock, toBlock) → string     // for re-rendering after zoom change
getState() → {duration, totalBlocks, sampleRate, channelCount, ops}
```
Each method is a clean request/response. No shared mutable state between threads.
Playback engine calls getPlaybackWindow; UI calls applyOp; both independent.

### Playback engine interface
```
// Any engine implements this:
engine.play(fromBlock, loop?)
engine.pause() → currentBlock
engine.seek(block)
engine.setLoop(startBlock, endBlock)  // null to clear
engine.setVolume(0..1)
engine.setSpeed(rate)
engine.onEvent(cb)  // cb receives: started, looped, seeked, ended, windowNeeded
engine.dispose()
```
UI binds to this interface only. Swapping AudioBufferSourceNode → AudioWorklet
means implementing same interface, no UI changes.

### Playback position
No continuous reporting. Main thread interpolates from events:
- `{started: {block, time, speed}}` → `currentBlock = block + floor((now - time) * sr / blockSize * speed)`
- `{looped: {block, time}}` → reset interpolation origin
- `{ended}` → stop animation
Updated on rAF for caret, on user interaction for selection.
Zero messages during steady-state playback.

### Editing model (CRDT-style ops)
Ops are the single source of truth. No buffer is ever mutated.

Original decoded chunks are immutable. Editing = appending ops to an ordered list.
Worker maintains a "virtual timeline" — a resolved view mapping virtual position → (chunk_id, offset, length).

Op types:
- `del(from-to)` — marks range as skipped in virtual timeline
- `sil(at-dur)` — inserts zero-filled virtual region
- `mov(from-to-dest)` — remaps region to different virtual position
- `br(offset)` — segment boundary (visual only, no audio effect)
- `norm(from-to-target)` — gain multiplier derived from target loudness
- `fade(from-to-curve)` — amplitude envelope

Resolving ops is cheap (index math). Materializing audio (for playback/export) only
happens in the Worker, lazily, as the playback head advances through the virtual timeline.

### Op storage & history (separate concerns)
Ops list is the authoritative state. It lives in main thread and is synced to Worker via applyOp().
Ops are serialized/stored via a pluggable persistence layer:

1. **URL serialization** (primary, for short edit chains):
   `?src=file.mp3&del=10-20..50-60&sil=30-5`
   Good for: sharing, bookmarking, <50 ops.
   Limit: ~2KB URL in practice. Beyond that, URL becomes unwieldy.

2. **OPFS session** (fallback, for heavy editing):
   `?session=abc123` — ops stored as JSON in OPFS alongside the source file.
   Good for: 50+ ops, complex edit history, persistence across sessions.
   Loaded on page refresh from OPFS.

Undo/redo is an APP-LEVEL stack, NOT browser history:
- Ctrl+Z = pop last op from ops list, push to redo stack.
- Ctrl+Shift+Z = pop from redo stack, push to ops list.
- Ops list change → Worker.applyOp() → waveform delta → UI update → URL/OPFS sync.
- Browser back/forward is for PAGE navigation, not undo. Don't abuse pushState.
  Exception: initial file load can use replaceState for shareable URLs.

### Edit during playback
When user edits while playing:
1. Main thread applies op, sends to Worker.
2. Worker updates virtual timeline, returns waveformDelta + newDuration.
3. Main thread updates UI (waveform string, caret position).
4. If edit is AHEAD of playback position: no playback impact, current window still valid.
5. If edit is AT or BEHIND playback position: engine must rebuild.
   - Pause current source node.
   - Request new playback window from Worker starting at adjusted position.
   - Create new source node, resume.
   - Position may need clamping if edit shortened file past current position.
6. If edit deletes current playback position: clamp to nearest valid block, resume.

### Why ops resolution lives in Worker
- Worker holds the PCM chunks — can resolve virtual timeline to actual samples
- Worker has no time pressure (unlike Worklet's 3ms render deadline)
- Worker pre-builds playback windows ahead of time
- Main thread doesn't hold raw PCM — can't resolve ops even if it wanted to
- Clean request/response: main sends op → Worker returns waveform delta + new duration
- Playback and editing are independent callers of the same Worker API

### WAV export metadata
When exporting WAV, embed optional RIFF chunks:
- `cue` + `labl` — markers/bookmarks as cue points
- `bext` — broadcast metadata (originator, date, loudness)
- `smpl` — loop points if selection was looped
- `LIST INFO` — title, software ("wavearea"), date

### Cross-Origin Isolation (future — not needed for Phase 1)
SharedArrayBuffer requires these headers (only needed if/when we add AudioWorklet engine):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
Can be injected via Service Worker (coi-serviceworker pattern) even on GitHub Pages.
AudioBufferSourceNode approach (Phase 1) does NOT need any of this.


## Future Ideas (Not Roadmap)

* Spectrogram view toggle
* Waveform minimap as separate component
* Batch processing (open folder, normalize all)
* System clipboard integration (paste audio from other apps)
* Shareable edit URLs (short-url service)
* Embedded player component (`<wave-area src="...">`)
* Audiobook mode (chapters as segments, paged playback)
* AI transcript overlay (AssemblyAI / Whisper)
* Speech generation at caret (11labs / free TTS API)
* Sampler mode (dictionary of named segments, play by sequence)
* Peak meters / level display during playback
* Auto-save during editing
