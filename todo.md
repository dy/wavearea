* [x] display audio
* [x] play audio
* [x] caret indication
  * [x] Don't update caret in raf: update only on playback and time change
  * [x] Don't track caret on every focus: only when user selects by mouse
  * [x] Make playback within the selection
* [x] Fix safari
* [x] loses caret on play, like insert silence, press play etc
* [x] serialize file in url: ?src=path/to/url/file/to/fetch
* [x] sprae :onfile-attachment-accepted
* [x] add preloader (sprae mount-unmount)
* [x] delete fragments -> updates audio
* [x] create silence by space
* [x] download
* [x] caret must be able to be reoriented during the playback
* [x] Safari: wrong current time positioning
* [x] BUG: stopping drops focus
* [x] Make 'Enter' create segments
* [x] time codes next to lines
* [x] br
* [x] del
  * [x] fix deleting tail properly
* [x] normalize
* [x] BUG: setting caret to the beginning of segment (a bit from the left of segment) doesn't start playback properly
* [x] faster encoder by just copying changed subbuffer data, opposed to full rerender
* [x] fix playback multiple segments
* [x] Add vertical shift of average
* [x] Shift + select
* [x] ~~interleaved buffers pointing to chunks of wav file, rather than audiobuffers~~ same as below
* [x] ~~immediate audio ops via copy~~ - saves 15ms, takes a lot in terms of losing AudioBuffer primitive
* [x] worker processor
* [x] actions via beforeinput inputType

## [x] ~~MVP: basic dubs editor~~

* [x] Reconstruct non-existent history entry from history path
* [x] Make delete: `from-to` signature instead of `from-count`
* [x] Debounce delete better
* [x] "Open audio"
  * [x] ~~"Generate speech" or "Pick random audio" intro screen. (+ button at the right)~~ -> use more complete sources config
* [x] Reflect operations in URL
* [x] Backspace-deleting from the beginning of segment doesn't remove break but deletes tail of prev segment instead
  * [x] join operation that serializes as removing break
* [x] mute
* [x] take source from URL.
  * [x] if there's none - take random source
* [x] support dropping files
  * [x] save dropped files to storage
* [x] Make history of changes with undo/redo
* [x] Time-codes of following segments are messed up: make them href-able
* [x] Bug: insert silence at the beginning of new segment -> feature
* [x] ~~Save local file edits to kv-storage~~ - saved in history
* [x] BUG: 0:60 in timing
* [x] OPTIMIZATION: use onbeforeinput/oninput for handling operations
* [x] BUG: deleting from left & then from right of caret is different
* [x] BUG: fix playback from caret
* [x] Alt-Space for start/stop
* [x] Loop play selection

## Must fix v1

* [ ] History separate from URLs
  * [ ] Ctrl-z/y
  * [ ] Collapse last operation, eg. delete
* [ ] Outsource audio-decode, add missing codecs
* [ ] Ponyfill Audio gotchas?
* [x] Outsource media loopStart / loopEnd
* [x] Better selection logic: must be immediate
* [x] Display open/loading status
* [ ] Enter for frags
* [ ] Display + for newlines
* [ ] . for silence
* [x] Empty URL shows "Open file"
* [x] Loads source from url on init
* [?] ~~Display loading status in playback~~ not sure still if we need playback
* [x] ~~Show average line in samples~~ use dots instead
* [ ] Deleting, changing caret, deleting again causes UI waveform assertion fail
* [x] Small screens wrongly wrap waveform timing
* [x] Deleting part of audio screws up play button position
* [x] End of file caret positioning is wrong
* [ ] Delete-all case doesn't get saved
* [ ] Big file editing generates tons of error logs : must be good
* [ ] Big files break caret line at the end (see bvg)
* [x] Loaded file misses offset
* [x] Played waveform update on big files is very slow. Use overlap technique or virtual list via intersection observer
* [x] Safari: smooth audio currentTime (opposed to glitchy now)
* [ ] A way to download selected fragment
* [x] Stopping playback causes glitch
* [x] Bug with assets/1s.wav playback - end line caret shifts down
* [x] Problematic mobile rendering
* [x] Mobile playback doesn't start from selection
* [x] Bug: renavigating during play
* [ ] Bug: mobile safari play button sticks glitchly (alternative to intersection observer?)
* [x] Bug: multiline selection is damaged
* [ ] Bug: empty head starts playing something non-silence
* [x] Bug: needs enhanced lines calculation, ideally chars-per-line
* [ ] Bug: playback with space is glitchy
* [ ] Bug: stopping playback with pause click is glitchy
* [ ] Bug: deleting is broken
* [ ] Bug: safari doesn't renavigate by click

## Improvements

* [ ] Zoom
* [ ] Render only visible part - must reduce rendering load significantly
* [ ] Resize throttle
* [ ] `<time-codes>`
* [ ] `<playback-panel>`
* [ ] `<wave-area>`
* [ ] Autoplay, loop, current line - can be navigatable from URL
* [x] Add info icon: support, github, brahman
  * tips, generate theme
  * adjust settings: audio loudness metric, block size
* [ ] support paste fragment of itself
* [ ] Mark loop selection
* [ ] Mark fragments
* [x] Detect characters per line via ranges method: https://www.bennadel.com/blog/4310-detecting-rendered-line-breaks-in-a-text-node-in-javascript.htm
* [ ] Separate audio-decode module with all codecs...
* [x] Make play button clickable area _big_
* [ ] Recent files
* [x] use media-offset for looping -> own function play-loop
* [ ] detect cmd/ctrl key depending on platform
* [x] make player responsive in mobile as bottom play button with overlay
* [x] make playback sticky to avoid hiding playback (intersection observer + position change)
* [x] ~~use plain (interleaved?) arrays instead of audio buffers - faster decoding, faster transfering to worker~~ - limited maintainability, no need to transfer to worker
* [x] use decodeAudioData main thread "worker" for faster decode, detect supported native codecs & video
* [ ] Loudness weighting
  * https://github.com/MTG/essentia/blob/master/src/algorithms/temporal/loudnessebur128.cpp
  * https://github.com/domchristie/needles
* [ ] Better loudness display: it is inadequate now
* [ ] Display left/right channels with half-transparent blacks, and black is their intersection
* [x] time codes as # hrefs
  * [ ] make navigatable
* [x] Faster updates: maybe no point rerendering/encoding full waveform, or parallelize, or faster wav encoder (wasm?)
    * ? should we work straight on wav buffer maybe instead of audio buffers?
* [x] Highlight of playable/playing region via diff color
* [x] ~~use audio-buffer-list for faster ops?~~ -> use own implementation
* [ ] theme selector: color gradientish, inverse, cool, hot, dynamic, bw, font style
* [x] move loading/decoding/encoding to worker
* [ ] random phrase player (from URL - like thetamath) via free speech api
* [x] broken sprae condition of `:if :ref`
* [ ] convert ops units to h/s/ms
* [ ] replace file selector with + under caret?
* [x] open file
* [x] ~~Make nicer playback UI (bottom of page player)~~ -> not proved to be the best
  * [ ] Errors and loading state must be indicated there
  * [ ] Precise current playback time
* [ ] delete file fully -> displays open file again
* [ ] save file in storage? -> can be done via browser caching
* [x] ~~Safari: initial audio loading state displays Error (show silent buffer)~~
* [x] scroll must follow the current caret position
* [x] save edits in URL, so that any audio URL can be opened, edited, played.
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
* [x] ~~?Use timing object https://github.com/chrisguttandin/timing-object~~ -> nah
* [ ] Editable labeling / phrases

## [ ] Final goal

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