function Playback({ }) {
  return
}

{/* <div class="w-playback">
    <div class="w-open w-button" if="!segments.length && !loading">
      <input id="w-file" class="w-file" type="file"
        accept="audio/x-m4a,audio/mp3,audio/amr,audio/aiff,audio/wav,audio/*" :onchange="handleFile" />
      <label for="w-file" title="Open file">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"
          data-slot="icon" width="24" height="24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </label>
      <button class="w-record">
          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><circle cx="12" cy="12" r="8"/></svg>
          Record
        </button>
    </div>

    <button class="w-play w-button" if="segments.length"
      title="loading ? loading : `playing ? 'Pause' : 'Play' (Space)`" :class="'w-loading':loading"
      disabled="loading" :onclick.toggle="play" :onkeydown.document.space="e=>this.click(e)">
      <svg :hidden="playing" xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"
        fill="#000000">
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M8 5v14l11-7L8 5z" />
      </svg>
      <svg :hidden="!playing" xmlns = "http://www.w3.org/2000/svg" height = "24px" viewBox = "0 0 24 24" width = "24px"
  fill = "#000000" >
        <path d="M0 0h24v24H0V0z" fill="none" />
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
      </svg >
    </button >

    <span class="w-time" title="Current time" if="segments.length" :disabled="!segments.length"
      text="timecode(caretOffset, 2)"></span>

    <span style = "opacity: .25" > /</span >
    <span class="w-time" title = "Time until the end" : text = "'‒' + timecode(total - caretOffset, 2)" ></span >

    <div class="w-status" : text = "'Select file'" ></div >
  </div > */}
