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
  * [ ] sometimes splitting fails (like back-forth splits)
* [x] time codes next to lines
  * [ ] fix segments repositioning of caret
* [ ] Make all basic operations fork from URL:
  * [x] br
  * [x] del
    * [x] fix deleting tail properly
  * [ ] mute
* [ ] Make UI interactions serialize to basic URL operations
* [ ] Display left/right channels with a separate colors, and black is their intersection
* [ ] Shift + select
* [ ] time codes as # hrefs
* [ ] Faster updates: maybe no point rerendering/encoding full waveform, or parallelize, or faster wav encoder (wasm?)
  * [ ] faster encoder by just copying changed subbuffer data, opposed to full rerender
    * ? should we work straight on wav buffer maybe instead of audio buffers?
* [ ] Highlight of playable/playing region via diff color
* [x] ~~use audio-buffer-list for faster ops?~~ -> use own implementation
* [ ] take source from URL, load that and visualize.
  * [x] if there's none - take random source
* [ ] theme selector: color gradientish, inverse, cool, hot, dynamic, bw, font style
* [ ] move loading/decoding/encoding to worker
* [ ] random phrase player (from URL - like thetamath) via free speech api
* [ ] broken sprae condition of `:if :ref`
* [ ] replace file selector with + under caret
* [ ] open file
* [ ] Make nicer playback UI (bottom of page player)
  * [ ] Errors and loading state must be indicated there
* [ ] delete file fully -> displays open file again
* [ ] save file in storage
* [ ] Safari: initial audio loading state displays Error (show silent buffer)
* [ ] paste audio from outside
* [ ] plus sign under the caret
* [ ] ? rebuild player based on media stream to avoid preloading multiple chunks at once
* [ ] scroll must follow the current caret position
* [ ] save edits in URL, so that any audio URL can be opened, edited, played.
* [ ] Make history of changes with undo/redo
* [ ] Save history in query