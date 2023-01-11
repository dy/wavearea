## [ ] Name

* waveedit
* wavearea
* waver
* wavee
* waveplay
  + free
* waveplayer
* playwave
* waev
  + wæv
  + anagram
  + free
* wavea
  + wavearea
* wavescope
* waveview

## [ ] Demo cases

* Classics?
* Famous quotes?
* Prabhupada vani?
* Audio books?
* Poetry?
* Mantras/Mahamantra?
* Randomly generated music stream?
* The most popular songs of all time?
* Vedas?

## [ ] Use cases?

* Drop [Prabhupada] audio (paste by URL, by file, drop file), have multiline waveform with time markers.
  * Separate logical secions by pressing enter.
  * Delete apparent long pauses.
  * Apply normalizer plugin.
  * Select start, apply fade-in; select end, apply fade-out.

* Put cursor at any place: record own speech.
* Drop any audio chunk at specific caret location.
* Generate speech at specific location.

## [ ] Editing cases: what's the method of identifying changes? -> detect from operation

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