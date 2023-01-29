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

## [ ] MVP: basic dubs editor

* [ ] "Open audio", "Generate speech" or "Pick random audio" intro screen.
* [x] Reflect operations in URL
* [x] Backspace-deleting from the beginning of segment doesn't remove break but deletes tail of prev segment instead
  * [x] join operation that serializes as removing break
* [x] mute
* [x] take source from URL.
  * [x] if there's none - take random source
* [x] support dropping files
  * [ ] save dropped files to storage
* [ ] Make history of changes with undo/redo
* [ ] support paste fragment of itself
* [ ] convert ops units to h/s/ms
* [x] Time-codes of following segments are messed up: make them href-able
* [x] Bug: insert silence at the beginning of new segment -> feature
* [x] ~~Save local file edits to kv-storage~~ - saved in history
* [x] BUG: 0:60 in timing
* [x] OPTIMIZATION: use onbeforeinput/oninput for handling operations
* [x] BUG: deleting from left & then from right of caret is different

## Bugs

* [ ] Deleting, changing caret, deleting again causes UI waveform assertion fail
* [ ] Small screens wrongly wrap waveform timing

## Improvements

* [ ] use plain (interleaved?) arrays instead of audio buffers - faster decoding, faster transfering to worker
* [ ] Loudness weighting
  * https://github.com/MTG/essentia/blob/master/src/algorithms/temporal/loudnessebur128.cpp
  * https://github.com/domchristie/needles
* [ ] Display left/right channels with half-transparent blacks, and black is their intersection
* [ ] time codes as # hrefs
* [ ] Faster updates: maybe no point rerendering/encoding full waveform, or parallelize, or faster wav encoder (wasm?)
    * ? should we work straight on wav buffer maybe instead of audio buffers?
* [ ] Highlight of playable/playing region via diff color
* [x] ~~use audio-buffer-list for faster ops?~~ -> use own implementation
* [ ] theme selector: color gradientish, inverse, cool, hot, dynamic, bw, font style
* [ ] move loading/decoding/encoding to worker
* [ ] random phrase player (from URL - like thetamath) via free speech api
* [x] broken sprae condition of `:if :ref`
* [ ] replace file selector with + under caret?
* [ ] open file
* [ ] Make nicer playback UI (bottom of page player)
  * [ ] Errors and loading state must be indicated there
  * [ ] Precise current playback time
* [ ] delete file fully -> displays open file again
* [ ] save file in storage? -> can be done via browser caching
* [ ] Safari: initial audio loading state displays Error (show silent buffer)
* [ ] scroll must follow the current caret position
* [ ] save edits in URL, so that any audio URL can be opened, edited, played.
* [ ] More audio transforms
* [ ] Make reusable (web-) component
* [ ] Think of embeddable links
* [ ] Recording capability
* [ ] Add tests (playright?)
* [ ] Add humble links: support, github, share?
* [ ] MAE loudness measure
* [ ] Measure via LUFS and other methods
* [ ] Process audio with lino?
* [ ] Vary color based on spectrum
* [ ] Use timing object https://github.com/chrisguttandin/timing-object
