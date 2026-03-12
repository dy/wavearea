## [x] Name -> wavearea

* waveedit
* wavearea
  + alliteration ea ea
  + canonical direct name
* waver
* wavee
* waveplay
  + free
  + works with waveplayer
* wavely
  + wave-ply
  + works with wavedy for editor
* waveplayer
* playwave
* waev
  + wæv
  + anagram
  + free
  + refers to sprae
  + phonetically correct form of "wave"
  - can be done without sprae
  - registered company name
* wavea
  + wavearea
* wavescope
* waveview
* waveplae
  + refers to sprae (ostensibly better than waev)
  + refers to waveplay - better association than waev
* plae
  + player
  + refers to waveplae
  + refers to sprae
  - taken
* wavr
  + registered
  + short for wave-area
  + better fits wav
  + refers to plyr

## [ ] Random files / demo cases

* Classics?
* Famous quotes?
* Prabhupada vani?
* Audio books?
* Poetry?
* Mantras/Mahamantra?
* Randomly generated music stream?
* The most popular songs of all time?
* Vedas?
* Random forest sounds!

## [ ] Intro screen: ideas?

* !recent history of files
* !random file?
* !record mic
* !generate speech (some free API)
* !generate signal
* !some AI stuff (generate from prompt)
* !open file(s), drop file(s)
* It must be meaningful & entertaining: each time educative content, like voiced aphorism etc.

## [ ] Cases / integrations

* Drop [Prabhupada] audio (paste by URL, by file, drop file), have multiline waveform with time markers.
  * Separate logical secions by pressing enter.
  * Delete apparent long pauses.
  * Apply normalizer plugin.
  * Select start, apply fade-in; select end, apply fade-out.
* Put cursor at any place: record own speech.
* Drop any audio chunk at specific caret location.
* Generate speech at specific location.
* [ ] Sound fragments sharing platform
* [ ] Hosting files via github
* [ ] Sampler player, like te-re-khe-ta from URL will play sampled phrases by dictionary
* [ ] Multiple variations of theming
* [ ] Voice emails integration
* [ ] Multiple various transforms: speed up, skip silence, enhance recording, normalize
* [ ] Famous voices speak famous phrases - chunk tp share
* [ ] Dictaphone
* [ ] Customizable waveform player component: loudness variants, rendering complexity variants, themes, backend variants
* [ ] Audio books with paged chapters for playback
* [ ] sound-resource.com
* [ ] Assembly AI transcript player https://www.assemblyai.com/playground/transcript/rfj7ddsp95-7929-4158-8cf7-27d897b47b96

## [x] Editing cases: what's the method of identifying changes? -> detect from onbeforeinput inputType

* Delete part (selection)
* Delete single block
* Paste piece from the other part
* Speparate by Enter
* Paste audio file

1. 1a2b3a4a5...123a124b125c

  - letter characters are selectable / navigatable, unlike combos
  + allows identifying parts exactly
  - too extended string

2. \uff** + bar

  - same as above
  + less space taken

3. Detect operation from changed input based on current selection

  + no overhead
  + smart algo
  ~ selection can be unreliable on some devices
  + more reliably detects allowed inputs
  - no way to paste samples from somewhere else

## [x] Paragraphs instead of textarea -> let's try p

+ No hardship detecting line breaks
+ Easy way to display time codes
+ We anyways display single duplication node
- Not textarea already: textarea can be useful for simple small fragments

## [x] CRDT: keep ops in URL -> yes, see readme for latest format details

+ allows undo/redo just from URL
+ allows permanent links to edited audio pieces
* allowed URL chars: ;,/?:@&=+$-_.!~*()#
? ops: `add(0:url(path/to/file)),br(112,5634,12355),del(12:45,123:234)`
  * delete: `-(start:amt,23:12,...)`
  * add: `+(start:src,23:url(https://path/to/file),...)`
  * silence: `_(start:amt,start:amt,...)`
  * breaks: `.(offet,23,112,1523)`
  * normalize?
  * remove-silence?
  * enhance-quality-via-external-processor, like `process(adobe-enhancer)`
* Alt: `src=path/to-file&br=112,5634,12355&del=12:45,123:234`
+ colon is perfect separator: `#line:col`
+ one entry is one history item
+ shorturl for audio files

## [x] Store offsets in blocks -> blocks, with sr/block declared in URL

1. Blocks
- depend on block size & sample rate
- block size can change transforms
- no precise editing
  ~ isn't necessarily needed
+ very short notation
+ very natural to what you see
? can define `block=1024&sr=44100` in url
- any zoom change recalculates full url

2. Samples
- depend on sample rate
~ sample rate change recalculates URL
- longer than block
+ more precies
+ zoom change doesn't change url
- big sample rates make very long URLs

3. Time
- too lengthy values
- can be mistakes identifying exact place
+ doesn't depend on zoom / sample rate levels
+ can be very precise
+ can have conventional short notation: br=122.1s,156.432s,

4. Mix of 3 and 1: units indicate time, values indicate block
- lazy solution: can be fixed on experimental stage

-> Blocks win. Reasons:
+ shortest URLs by far (1 char per position vs 5-10 for samples/time)
+ 1:1 mapping to what user sees — each waveform character IS a block
+ zoom change recalculating URL is acceptable: zoom is rare, edits are frequent
+ block=1024&sr=44100 in URL makes it self-describing
+ editing granularity matches visual granularity — no false precision
- we accept: zoom change = URL rewrite (but we can store ops in block-agnostic form internally
  and serialize to current blockSize on URL update)

## [x] From-to vs at-count -> from-to for ranges, at-count for insertions

+ `del=from-to` is more logical as range indicator
  + also easier from code perspective
- `sil=at-count` is more logical to insert silence

-> Both. Each op uses what's natural:
  * `del=from-to` — range semantics
  * `sil=at-count` — insertion semantics
  * `mov=from-to-dest` — range + target
  * `br=offset` — point semantics
  * `norm=from-to-target` — range + parameter
  * `fade=from-to-curve` — range + parameter


## [x] Looping method -> AudioWorklet with ring buffer

0. Same way we observe currentTime via raf, we can loop
- short pieces are not loopable nicely
+ solves long pieces

1. Create a clone of audio with selected fragment and loop it
- keeping UI in sync
+ standard API
+ natural extension
- can be costly to immediately create a big slice
  ~ there's no difference perf-wise between set & loop
-> yes, create bg wav buffer onselection, and fully intercept audio
  * may need alternative UI, since original UI can fail

2. -> Custom UI for audio tag
+ anyways we were going to do that
+ better control over displayed data
+ it can allow removin unusable parts
+ we have raw data anyways

3. Custom UI via AudioSourceNode
+ better integration with audio buffers
+ no need to constantly (re) encode wav
- requires sending audio buffers to main thread
- not as reliable as just audio

4. media-offset
+ separates concern nicely
+ doesn't require worker slicing delay
+ can be messy on small chunks
- small chunks defects
- rough api yet

5. -> AudioWorklet + SAB ring buffer (new decision)
+ Worker writes PCM into SharedArrayBuffer, Worklet reads
+ loop = Worker resets read position in virtual timeline, keeps writing
+ zero-copy, no re-encoding, no audio element quirks
+ sample-accurate loop points
+ works on iOS Safari 16.4+
+ no audio element latency/event issues
+ looping is just: when playback reaches loop end, reset virtual timeline position to loop start
- requires Cross-Origin-Isolation headers (COOP/COEP)
  ~ fallback to Comlink port messaging if no COEP
- more code than audio element
  ~ but cleaner, more testable code


## [x] Inline player vs playback panel -> inline floater, with optional panel later

1. Inline player
+ Inline player is minimalistic
- Inline player is buggy on safari for intersection observer - needs fake scroll container, unless done via scroll
- Inline player is buggy for multiple lines - misses the caret pos
  ~ We still may need to track caret-line properly (scroll into caret)
    ? unless area i able to do it itself

2. Playback panel
+ Always accessible
+ Allows displaying any info: time, download, progress, record
+ Customizable
+ Conventional UX
+ Has no scrolling issues

-> Current floater approach (sticky play button next to current line) is good for MVP.
   Add bottom playback panel later as enhancement (Phase 5) for time display, speed, volume, record.
   Both can coexist: floater for quick play, panel for controls.


## [x] WAA player vs Audio element -> AudioWorklet (supersedes both)

1. Audio element
+ More universally supported
+ Simpler API
+ Decoding out of box
- Big delay in iOS for playback
- No built-in loop support
  ~ Can be relatively safely implemented
- API quirks / inconsistencies across iOS / desktop, like preloading
- Events order is confusing: seeked, seeking, timeupdate - but we factually need just 'looped' or 'usernavigated'
- Likely impossible to organize precise tests (if at all)
+ It opens the file nicely in iOS home screen

2. WAA (AudioSourceNode)
+ short latency
+ no 1.5s playback delay imposed by Safari
- no ready playback API
- may require live audiobuffer manipulations to output sound
+ loopStart/loopEnd support out of box
+ direct access to AudioBuffer: no need to constantly re-encode audio, ops can be more instantaneous
- context instantiation issues (see web-audio-player)

3. web-audio-player https://github.com/Jam3/web-audio-player
+ attempt to fix many gotchas
- switches between 2 modes: element / waa

4. -> AudioBufferSourceNode + Worker (new decision, supersedes 1-3)
+ Worker assembles AudioBuffer window (~30s) from virtual timeline
+ Transfer to main thread → AudioBufferSourceNode → GainNode → speakers
+ Built-in: loop, loopStart, loopEnd, playbackRate — all free
+ Low latency (~3-6ms), works everywhere including iOS
+ No COOP/COEP needed, no SAB, no Worklet complexity
+ On seek/edit: Worker sends new buffer window, recreate source node
+ Approaching window end: Worker sends next window (gapless playback)
+ Volume: GainNode. Speed: playbackRate. Both built-in.
- AudioBufferSourceNode is one-shot (must recreate on stop/seek)
  ~ acceptable: recreating is cheap, Worker pre-builds windows
- Main thread holds ~30s AudioBuffer (~5MB stereo)
  ~ acceptable: one window, not entire file
- No sample-level output control (can't inject effects in realtime)
  ~ defer AudioWorklet to Phase 3/5 when we need effects/crossfade

5. AudioWorklet (reserved for future)
+ needed for: real-time effects, crossfade, recording mix-in
+ same thin interface — swap engine, UI doesn't change
+ Worker feeds PCM via port.postMessage (or SAB with COOP/COEP)
- more code, more complexity
- not needed for basic playback + editing
-> defer to when sample-level control is actually required


## [x] Where do PCM chunks live? -> Worker only

1. Main thread
- blocks UI on large files
- memory pressure (UI + audio data on same heap)
+ simple: direct access for waveform rendering
  ~ but main thread only needs waveform STRING, not raw samples

2. Worker
+ off-main-thread: no UI blocking
+ can hold large files without affecting UI responsiveness
+ decode + store + resolve ops all in same thread = zero-copy
+ only thread that needs raw samples
- can't feed AudioWorklet directly
  ~ SAB bridges this gap: Worker writes, Worklet reads

3. AudioWorklet
- 128-sample (~3ms) render deadline: no room for anything but read-and-output
- memory-constrained (audio thread)
- no access to OPFS or network
- would duplicate data already in Worker

-> Worker wins. Single source of truth for all audio data.
   Main thread holds: ops list (tiny), waveform string (text), UI state.
   Worklet holds: nothing. Reads SAB.


## [x] Ops resolution: where? -> Worker

1. Main thread
+ direct UI update after resolution
- doesn't hold raw PCM (by design)
- would block UI during complex op chains
- would need to send resolved timeline to Worker for playback anyway

2. Worker
+ holds the PCM chunks — can resolve virtual timeline to actual samples
+ no time pressure (unlike Worklet)
+ can pre-fill SAB ring buffer ahead of playback position
+ resolving ops = index math on chunk references, microseconds even for 1000 ops
+ after resolution: sends back only what main thread needs (waveform string delta, new duration)
- main thread must wait for Worker response to update UI
  ~ latency is <1ms for op resolution, negligible

3. Worklet
- 128-sample deadline: absolutely cannot do op resolution
- doesn't hold chunks
- wrong thread for this

-> Worker. Ops applied → virtual timeline recalculated → SAB updated → waveform delta sent to main.


## [x] Waveform string generation: where? -> Worker during decode, Worker on edit

1. Main thread during decode (current approach)
+ worker sends samples via Comlink.transfer, main thread calls samplesToWaveform()
+ progressive rendering: waveform grows as chunks arrive
- main thread holds raw samples temporarily (discards after conversion)
  ~ samples are transferred (zero-copy), then converted, then GC'd — acceptable

2. Worker generates waveform string
+ main thread never touches raw samples at all
+ Worker already has the samples
+ on edit: Worker can regenerate affected waveform region and send string delta
- transferring waveform string is slightly more overhead than current approach
  ~ waveform string is small: 1 char per 1024 samples = ~43 chars/sec of audio
  ~ for 1hr file: ~155K chars = ~300KB. Trivial.

-> Worker for both decode and edit:
   During decode: Worker generates waveform string per chunk, sends to main thread.
   On edit: Worker recalculates affected region's waveform string, sends delta.
   Main thread NEVER receives raw PCM. Only receives waveform strings.
   This is cleaner than current approach (transfer samples → convert → discard).

! This means samplesToWaveform() moves from wavearea.js to worker.js.


## [x] Playback position tracking -> main thread interpolation, no continuous reporting

1. Worker reports position continuously (MessageChannel / SAB atomic)
- wasteful: position is deterministic between events
- adds complexity: dedicated channel, polling or atomic reads
- latency: even at 60fps, position is 16ms stale

2. Main thread polls Worker periodically
- same problems as 1 but worse: round-trip latency

3. -> Main thread interpolates from events
+ zero messages during steady-state playback
+ Worker emits only on discontinuities: started, looped, seeked, ended
+ `currentBlock = startBlock + floor((now - startTime) * sr / blockSize * speed)`
+ Updated via rAF for caret animation, on interaction for selection
+ Speed/rate changes: Worker sends new event with updated origin
+ Perfectly accurate: sample rate and block size are constants
- clock drift between main thread and audio output?
  ~ negligible for visual caret (human can't see <1ms drift)
  ~ audio timing is handled by AudioBufferSourceNode internally


## [ ] Op serialization format

Current thinking: URL search params, one param per op type, `..` to separate multiple ops of same type.
`?src=file.mp3&del=10-20..50-60&sil=30-5&norm=0-100--1`

Questions:
* What separator between op args?
  - `-` for ranges (del=10-20)
  - `,` for lists (br=10,50,100)
  - `.` conflicts with `..` multi-op separator
  -> use `-` for ranges, `,` for lists, `..` for multi-op
* How to handle ops that reference other files? (paste from external source)
  -> `add=pos-url(encoded_path)` — url() wrapper to distinguish from numeric args
* Max URL length concern?
  ~ 2048 chars is safe for all browsers
  ~ for heavy editing: 50 del ops × ~8 chars each = 400 chars. Fine.
  ~ if URL gets too long: store ops in OPFS, URL points to session ID
    -> `?session=abc123` fallback for complex edit histories
* Should ops be ordered in URL?
  + ordered = deterministic replay
  + natural: user applies ops sequentially
  -> yes, URL param order = application order


## [ ] Bottlenecks & risks to avoid doing work twice

### SAB + COOP/COEP headers
Risk: if hosting doesn't support these headers, SAB is unavailable.
GitHub Pages: does NOT support custom headers.
Blob URL for worklet does NOT bypass this — SAB check is on the top-level document,
not the worklet/worker context. `self.crossOriginIsolated === false` → `new SharedArrayBuffer()` throws.
Workaround: Service Worker can inject COOP/COEP headers on fetch responses (~30 lines,
see coi-serviceworker pattern). Works on GitHub Pages. But requires page reload on first SW install,
so first-time visitors won't have SAB until second load.
Mitigation: must work WITHOUT SAB from day one. Build port-messaging path first,
SAB as optimization later. Don't architect around SAB being available.
-> Build with Comlink port messaging first. Add SAB ring buffer as Phase 1 optimization.
   Service Worker injecting COOP/COEP can be added alongside PWA offline support (Phase 6).
   This means: don't write a ring buffer first and then have to rewrite for port fallback.
   Write port-based playback first, then add SAB as alternative transport.

### Waveform string vs ContentEditable
Risk: ContentEditable mutates its own DOM on user input. If user types/deletes,
the DOM text changes but our op model is the source of truth.
Mitigation: intercept ALL mutations via onbeforeinput.prevent — already in place.
Never let ContentEditable actually modify text. All changes go through ops → Worker → new waveform string → :text binding.
-> This is critical. If ContentEditable ever modifies text directly, we lose sync.
   Test this thoroughly: every input type must be prevented or handled.

### Worker decode: mono vs stereo
Risk: current worker.js only extracts planeIndex: 0 (first channel).
Stereo files lose right channel silently.
Mitigation: decode all channels from the start. Store as interleaved or planar Float32Arrays.
-> Fix in Phase 0: decode all channels. Don't defer or we'll have to re-architect storage.

### Large file waveform rendering
Risk: 1hr file at 1024 block size = ~155K waveform chars. ContentEditable with 155K chars
may be slow (DOM layout, selection, caret positioning).
Unknown threshold: need to benchmark. Could be 10K chars, could be 500K.
Mitigation: benchmark early (Phase 0 or 1). If slow:
  a) Virtual rendering (only render visible lines) — complex with ContentEditable
  b) Larger block size for long files (auto-zoom) — simpler, loses detail
  c) Canvas fallback for rendering (loses text metaphor) — last resort
-> Benchmark in Phase 0 with synthetic 155K-char content in contenteditable.
   Know the limit before building features that depend on it.

### samplesToWaveform in Worker vs Main
Risk: currently samplesToWaveform is in wavearea.js (main thread), called during decode.
Moving it to Worker changes the decode flow — main thread no longer receives raw samples.
If we move it later, we rewrite the decode pipeline.
-> Move samplesToWaveform to Worker in Phase 0. Don't build more on current pattern.

### Audio element removal
Risk: current playback uses <audio> element (wavearea.js references `audio` global).
Lots of code depends on audio.currentTime, audio.duration, audio events.
Replacing with AudioWorklet touches play(), caret sync, selection, loop — everything.
If we fix <audio> bugs in Phase 0 then replace in Phase 1, we fix things twice.
Mitigation: in Phase 0, DON'T fix <audio> bugs. Just make it minimally work for testing.
Phase 1 replaces it entirely with AudioWorklet.
-> Phase 0: leave <audio> as-is for basic testing. Don't invest in audio element fixes.
   Phase 1: replace wholesale.

### OPFS store: File vs decoded chunks
Risk: currently store saves the original compressed file. But after decode, we have PCM chunks.
If user edits and saves, what do we save? Original file + ops? Or materialized PCM?
Original + ops is smaller but requires re-decode on reload.
Materialized PCM is larger but instant reload.
-> Save original file + ops. Re-decode on reload is acceptable (progressive, fast).
   This keeps storage small and ops are the source of truth.
   For "export", materialize to WAV in Worker.

### Comlink overhead
Risk: Comlink wraps every call in postMessage. For high-frequency communication this is slow.
With AudioBufferSourceNode approach: no high-frequency Worker communication needed.
- Decode: one call, streams chunks back via callback. Infrequent.
- applyOp: one call per edit. Infrequent.
- getPlaybackWindow: one call per ~30s of playback. Infrequent.
- Position tracking: main thread interpolates locally. Zero Worker calls.
-> Comlink is fine for everything. No separate channel needed.

### AudioBuffer is NOT Transferable
Risk: roadmap originally said "Transfer AudioBuffer to main thread" — AudioBuffer
cannot be transferred via postMessage. Only ArrayBuffer/Float32Array are Transferable.
Mitigation: Worker sends raw Float32Arrays (Transferable, zero-copy).
Main thread creates AudioBuffer via audioCtx.createBuffer() and copies channel data in.
The copy is ~30s × 2ch × 4bytes = ~10MB, takes <1ms. Acceptable.
-> Documented in roadmap. Don't try to transfer AudioBuffer.

### Gapless window transitions
Risk: AudioBufferSourceNode is one-shot — can't append data to a playing source.
When current 30s window approaches end, we need seamless transition to next window.
Mitigation: schedule next source node to start at exact end time:
  `source2.start(audioCtx.currentTime + secondsRemaining)`
  Worker pre-builds next window while current plays (~30s lead time, plenty).
  Request next window when ~5s remain in current.
Risk: clock drift between scheduled start and actual playback → click/gap.
  ~ Web Audio scheduling is sample-accurate by spec. No drift.
  ~ But if Worker is slow building next window → gap.
  ~ Mitigation: 30s windows give Worker >>1s to build. If still slow, reduce window to 10s.
-> This is the only tricky part of AudioBufferSourceNode approach. Test thoroughly.

### Edit during playback
Risk: user edits while playing. What happens to the current playback window?
Cases:
1. Edit is AHEAD of playback position → no impact, current window still valid.
2. Edit is BEHIND but within current window → window is stale.
   Must stop, rebuild from current position, resume.
3. Edit DELETES current playback position → clamp to nearest valid block.
4. Edit SHORTENS file past current position → jump to new end.
Mitigation: playback engine has an `invalidate()` method called after any op that
affects blocks within the current or next window. Engine rebuilds as needed.
-> Must handle all 4 cases. Test each.

### Undo/redo vs browser history
Risk: original plan used history.pushState per op, browser back = undo.
Problems:
- User navigates away and back — undo stack is lost or corrupted.
- pushState pollutes browser history with hundreds of audio edit entries.
- User expects back button = go to previous page, not undo audio edit.
-> Undo is app-level stack, NOT browser history. Ctrl+Z / Ctrl+Shift+Z.
   URL is updated (replaceState) to reflect current ops, for sharing/bookmarking.
   But URL history ≠ undo history.

### Op storage: URL limits
Risk: URL search params have ~2KB practical limit. Heavy editing hits this.
50 del ops × ~8 chars = 400 chars. Fine. But with norm, fade, mov → longer.
100+ ops with long file names → easily >2KB.
Mitigation: two persistence modes:
1. URL params for light edits (<50 ops). Shareable, bookmarkable.
2. OPFS session for heavy edits. URL becomes `?session=abc123`.
   Ops stored as JSON in OPFS alongside source file.
-> Implement URL mode first (Phase 2). Add OPFS session fallback when URL gets long.
   The persistence layer is behind an interface: serialize(ops) / deserialize(url|session).

### CSS playback overlay (caret tracking)
Risk: current approach uses CSS ::before/::after with --carety/--caretx variables,
updated via JS setInterval every 10.8ms. This is janky.
Better: CSS animation from current position to end, paused/resumed on play/stop.
But CSS animation on custom properties requires @property registration.
-> Investigate CSS @property + animation for caret overlay in Phase 1.
   If not viable, use requestAnimationFrame (not setInterval).
   Don't optimize the current setInterval approach — it's being replaced.

### onbeforeinput: browser differences
Risk: onbeforeinput inputType values vary across browsers.
Safari may not fire for all input types. Firefox has gaps.
If we rely on this for ALL editing, gaps = lost edits or broken state.
Mitigation: comprehensive test matrix for onbeforeinput across browsers.
Fallback: compare before/after text content to detect what changed.
-> Test onbeforeinput coverage in Phase 0 Playwright tests (Chrome, Firefox, WebKit).
   Document which inputTypes we handle and which we block.
