// Loop highlight layer — highlights the active loop region
// Uses CSS Custom Highlight API when available, falls back to overlay div

// convert clean offset to raw offset (including combining marks)
function cleanToRaw(content, cleanPos) {
  let clean = 0, raw = 0
  while (clean < cleanPos && raw < content.length) {
    if (content[raw] < '\u0300') clean++
    raw++
    while (raw < content.length && content[raw] >= '\u0300') raw++
  }
  return raw
}

export default function loopHighlight(opts = {}) {
  let { color = 'rgba(100, 160, 255, 0.2)', name = 'loop' } = opts

  return (state, root) => {
    let hasAPI = typeof CSS !== 'undefined' && CSS.highlights

    let style = document.createElement('style')
    style.textContent = hasAPI
      ? `::highlight(${name}) { background: ${color}; }`
      : `.loop-highlight-overlay { position: absolute; background: ${color}; pointer-events: none; z-index: 1; }`
    root.appendChild(style)

    let highlight = hasAPI ? new Highlight() : null
    if (hasAPI) CSS.highlights.set(name, highlight)

    let overlay = null
    let raf = null
    let prevStart = -1, prevEnd = -1, prevLoop = false

    let update = () => {
      let ea = state.refs?.editarea
      let textNode = ea?.firstChild

      // skip if unchanged
      if (state.loop === prevLoop && state.clipStart === prevStart && state.clipEnd === prevEnd) return
      prevStart = state.clipStart; prevEnd = state.clipEnd; prevLoop = state.loop

      if (!ea || !textNode || !state.loop || state.clipStart == null || state.clipEnd == null || state.clipStart >= state.clipEnd) {
        if (hasAPI) highlight.clear()
        if (overlay) overlay.style.display = 'none'
        return
      }

      let content = textNode.textContent
      let rawStart = cleanToRaw(content, state.clipStart)
      let rawEnd = cleanToRaw(content, state.clipEnd)

      if (hasAPI) {
        highlight.clear()
        let range = new Range()
        range.setStart(textNode, Math.min(rawStart, content.length))
        range.setEnd(textNode, Math.min(rawEnd, content.length))
        highlight.add(range)
      } else {
        if (!overlay) {
          overlay = document.createElement('div')
          overlay.className = 'loop-highlight-overlay'
          let container = root.querySelector('.container')
          if (container) container.appendChild(overlay)
        }
        let range = new Range()
        range.setStart(textNode, Math.min(rawStart, content.length))
        range.setEnd(textNode, Math.min(rawEnd, content.length))
        let rects = range.getClientRects()
        if (rects.length) {
          let eaRect = ea.getBoundingClientRect()
          let r = rects[0]
          overlay.style.display = ''
          overlay.style.left = (r.left - eaRect.left) + 'px'
          overlay.style.top = (r.top - eaRect.top) + 'px'
          overlay.style.width = r.width + 'px'
          overlay.style.height = r.height + 'px'
        }
      }
    }

    // poll on rAF
    let poll = () => {
      update()
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (hasAPI) CSS.highlights.delete(name)
      if (overlay) overlay.remove()
      style.remove()
    }
  }
}
