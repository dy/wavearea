* [x] Finish sprae 10
* [x] no-caret (0 focus) play bug
* [x] space repeat
* [x] head of audio is boosted for some reason
* [~] discrepancy of caret with sound -> can't reproduce
* [ ] click on time must not reload anything
  * [ ] loading link with time should navigate to the line

## Backlog

* [ ] Automatic tests
* [ ] Shift play button to the left
  * [ ] Display current time
* [ ] All editing operations
  * [ ] delete
  * [ ] ctrl+C / ctrl+V
* [ ] Undo/redo history (separate from browser history)
* [ ] Save result
* [ ] Adjustable view
  * [ ] block size
  * [ ] color theme
* [ ] player backends
  * [ ] Audio
  * [ ] WAA
* [ ] Drag-n-drop
* [ ] Separate by fragments (scenes) via enter
* [ ] Playback bar with current time, play/stop, more
  * [ ] Position: bottom floating/appearing, bottom fixed, balloon next to cursor, no (melded into UI)
* [ ] Operations
  * [ ] Normalize audio (from playback bar?)
  * [ ] Revolume selected fragments
  * [ ] Noise-gate plugin
  * [ ] Speedup silences (plugin?)
* [ ] Change number of channels
* [ ] 11labs integration: generate speech of length
* [ ] Switchable main-thread / worker / GPU processing

## Reiterating

* [ ] display audio
* [ ] play audio
* [ ] caret indication
  * [ ] Don't update caret in raf: update only on playback and time change
  * [ ] Don't track caret on every focus: only when user selects by mouse
  * [ ] Make playback within the selection
* [ ] Fix safari
* [ ] loses caret on play, like insert silence, press play etc
* [ ] serialize file in url: ?src=path/to/url/file/to/fetch
* [ ] sprae :onfile-attachment-accepted
* [ ] add preloader (sprae mount-unmount)
* [ ] delete fragments -> updates audio
* [ ] create silence by space
* [ ] download
* [ ] caret must be able to be reoriented during the playback
* [ ] Safari: wrong current time positioning
* [ ] BUG: stopping drops focus
* [ ] Make 'Enter' create segments
* [ ] time codes next to lines
* [ ] br
* [ ] del
  * [ ] fix deleting tail properly
* [ ] normalize
* [ ] BUG: setting caret to the beginning of segment (a bit from the left of segment) doesn't start playback properly
* [ ] faster encoder by just copying changed subbuffer data, opposed to full rerender
* [ ] fix playback multiple segments
* [ ] Add vertical shift of average
* [ ] Shift + select
* [ ] ~~interleaved buffers pointing to chunks of wav file, rather than audiobuffers~~ same as below
* [ ] ~~immediate audio ops via copy~~ - saves 15ms, takes a lot in terms of losing AudioBuffer primitive
* [ ] worker processor
* [ ] actions via beforeinput inputType

## [ ] MVP: basic dubs editor

* [ ] Make delete: `from-to` signature instead of `from-count`
* [ ] Debounce delete better
* [ ] "Open audio"
  * [ ] ~~"Generate speech" or "Pick random audio" intro screen. (+ button at the right)~~ -> use more complete sources config
* [ ] Reflect operations in URL
* [ ] Backspace-deleting from the beginning of segment doesn't remove break but deletes tail of prev segment instead
  * [ ] join operation that serializes as removing break
* [ ] mute
* [ ] take source from URL.
  * [ ] if there's none - take random source
* [ ] support dropping files
  * [ ] save dropped files to storage
* [ ] Make history of changes with undo/redo
* [ ] Time-codes of following segments are messed up: make them href-able
* [ ] Bug: insert silence at the beginning of new segment -> feature
* [ ] ~~Save local file edits to kv-storage~~ - saved in history
* [ ] BUG: 0:60 in timing
* [ ] OPTIMIZATION: use onbeforeinput/oninput for handling operations
* [ ] BUG: deleting from left & then from right of caret is different
* [ ] BUG: fix playback from caret
* [ ] Alt-Space for start/stop
* [ ] Loop play selection


* [ ] Outsource audio-decode, add missing codecs
* [ ] Outsource media loopStart / loopEnd
* [ ] Better selection logic: must be immediate
* [ ] Display open/loading status
* [ ] Display + for newlines
* [ ] . for silence
* [ ] Empty URL shows "Open file"
* [ ] Loads source from url on init
* [?] ~~Display loading status in playback~~ not sure still if we need playback
* [ ] ~~Show average line in samples~~ use dots instead
* [ ] Deleting, changing caret, deleting again causes UI waveform assertion fail
* [ ] Small screens wrongly wrap waveform timing
* [ ] Deleting part of audio screws up play button position
* [ ] End of file caret positioning is wrong
* [ ] Delete-all case doesn't get saved
* [ ] Big file editing generates tons of error logs : must be good
* [ ] Big files break caret line at the end (see bvg)
* [ ] Loaded file misses offset
* [ ] Played waveform update on big files is very slow. Use overlap technique or virtual list via intersection observer
* [ ] Safari: smooth audio currentTime (opposed to glitchy now)
* [ ] A way to download / reverse / etc selected fragment (... at the right)
* [ ] Stopping playback causes glitch
* [ ] Bug with assets/1s.wav playback - end line caret shifts down
* [ ] Problematic mobile rendering
* [ ] Mobile playback doesn't start from selection
* [ ] Bug: renavigating during play
* [ ] Bug: mobile safari play button sticks glitchly (alternative to intersection observer?)
* [ ] Bug: multiline selection is damaged
* [ ] Bug: empty head starts playing something non-silence
* [ ] Bug: needs enhanced lines calculation, ideally chars-per-line
* [ ] Bug: playback with space is glitchy (resets caret)
* [ ] Bug: deleting is broken
* [ ] Bug: doesn't renavigate by click
* [ ] Bug: doesn't scroll on caret offset
* [ ] Bug: loop playback selection is broken
* [ ] Make play always cover the time, then it leaves space for "record" button
* [ ] Zoom
* [ ] Render only visible part (virtual) - must reduce rendering load significantly
* [ ] Resize throttle
* [ ] `<time-codes>`
* [ ] `<playback-panel>`
* [ ] `<wave-area>`
* [ ] Autoplay, loop, current line - can be navigatable from URL
* [ ] Add info icon: support, github, brahman
  * tips, generate theme
  * adjust settings: audio loudness metric, block size
* [ ] support paste fragment of itself
* [ ] Mark loop selection
* [ ] Mark fragments
* [ ] Detect characters per line via ranges method: https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
* [ ] Separate audio-decode module with all codecs...
* [ ] Make play button clickable area _big_
* [ ] Recent files
* [ ] use media-offset for looping -> own function play-loop
* [ ] detect cmd/ctrl key depending on platform
* [ ] make player responsive in mobile as bottom play button with overlay
* [ ] make playback sticky to avoid hiding playback (intersection observer + position change)
* [ ] ~~use plain (interleaved?) arrays instead of audio buffers - faster decoding, faster transfering to worker~~ - limited maintainability, no need to transfer to worker
* [ ] use decodeAudioData main thread "worker" for faster decode, detect supported native codecs & video
* [ ] Loudness weighting
  * https://github.com/MTG/essentia/blob/master/src/algorithms/temporal/loudnessebur128.cpp
  * https://github.com/domchristie/needles
* [ ] Better loudness display: it is inadequate now
* [ ] Display left/right channels with half-transparent blacks, and black is their intersection
* [ ] time codes as # hrefs
  * [ ] make navigatable
* [ ] Faster updates: maybe no point rerendering/encoding full waveform, or parallelize, or faster wav encoder (wasm?)
    * ? should we work straight on wav buffer maybe instead of audio buffers?
* [ ] Highlight of playable/playing region via diff color
* [ ] ~~use audio-buffer-list for faster ops?~~ -> use own implementation
* [ ] theme selector: color gradientish, inverse, cool, hot, dynamic, bw, font style
* [ ] move loading/decoding/encoding to worker
* [ ] random phrase player (from URL - like thetamath) via free speech api
* [ ] broken sprae condition of `:if :ref`
* [ ] convert ops units to h/s/ms
* [ ] replace file selector with + under caret?
* [ ] open file
* [ ] ~~Make nicer playback UI (bottom of page player)~~ -> not proved to be the best
  * [ ] Errors and loading state must be indicated there
  * [ ] Precise current playback time
* [ ] delete file fully -> displays open file again
* [ ] save file in storage? -> can be done via browser caching
* [ ] ~~Safari: initial audio loading state displays Error (show silent buffer)~~
* [ ] scroll must follow the current caret position
* [ ] save edits in URL, so that any audio URL can be opened, edited, played.
* [ ] More audio transforms
* [ ] Make reusable (web-) component
  * [ ] Textarea mode: no-line-breaks simple renderer on any textarea, no autosizer
  * [ ] Adjustable timecodes
  * [ ] Adjustable menu
  * [ ] Adjustable theme
  * [ ] Adjustable line breaks / ops
* [ ] Think of embeddable links
* [ ] Recording capability
* [ ] Add tests (playwright?)
* [ ] Measure via LUFS and other methods
* [ ] Process audio with lino?
* [ ] Vary color based on spectrum
* [ ] ~~?Use timing object https://github.com/chrisguttandin/timing-object~~ -> nah
* [ ] Editable labeling / phrases
