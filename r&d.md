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

## [ ] Store offsets in blocks or samples?

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

## [ ] From-to vs at-count

+ `del=from-to` is more logical as range indicator
  + also easier from code perspective
- `sil=at-count` is more logical to insert silence


## [x] Looping method -> custom UI for audio element: we need better UI anyways

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


## [ ] Inline player vs playback panel

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

## [x] WAA player vs Audio element -> use compensated audio for now. Too many benefits

1. Audio
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
