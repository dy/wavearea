* [x] display audio
* [x] play audio
* [x] caret indication
  * [x] Don't update caret in raf: update only on playback and time change
  * [x] Don't track caret on every focus: only when user selects by mouse
  * [x] Make playback within the selection
* [x] Fix safari
* [ ] Highlight of playable/playing region
* [ ] Make nicer playback look (end of page)
* [ ] take source from URL, load that and visualize.
  * [x] if there's none - take random source
* [ ] theme selector: color gradientish, inverse, cool, hot, dynamic, bw, font style
* [ ] move loading/decoding/encoding to worker
* [ ] random phrase player (from URL - like thetamath) via free speech api
* [ ] broken sprae condition of `:if :ref`
* [ ] serialize file in url: ?load=path/to/url/file/to/fetch
* [ ] replace file selector with + under caret
* [ ] sprae :onfile-attachment-accepted
* [ ] add preloader (sprae mount-unmount)
* [ ] open file
* [ ] delete file fully -> displays open file again
* [ ] save file in storage
* [ ] delete fragments -> updates audio
* [ ] Safari: wrong current time positioning
* [ ] Safari: initial audio loading state displays Error (show silent buffer)
* [ ] time codes next to lines
* [ ] edit audio: cut, paste
* [ ] create silence by space
* [x] download
* [ ] plus sign under the caret
* [ ] ? rebuild player based on media stream to avoid preloading multiple chunks at once
* [ ] caret must be able to be reoriented during the playback
* [ ] scroll must follow the current caret position
* [ ] BUG: stopping drops focus
* [ ] save edits in URL, so that any audio URL can be opened, edited, played.