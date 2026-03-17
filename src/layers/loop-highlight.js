// Loop highlight layer — highlights the active loop region
// Uses CSS Custom Highlight API when available, falls back to overlay div

import { effect } from 'sprae'
import { cleanToRaw } from '../selection.js'

export default function loopHighlight(opts = {}) {
  let { color = 'rgba(100, 160, 255, 0.2)', name = 'loop' } = opts

  return (state, root) => {
    let hasAPI = typeof CSS !== 'undefined' && CSS.highlights

    let css = document.createElement('style')
    css.textContent = hasAPI
      ? `::highlight(${name}) { background: ${color}; }`
      : `.loop-highlight-overlay { position: absolute; background: ${color}; pointer-events: none; z-index: 1; }`
    root.appendChild(css)

    let highlight = hasAPI ? new Highlight() : null
    if (hasAPI) CSS.highlights.set(name, highlight)

    let overlay = null

    let off = effect(() => {
      let ea = state.refs?.editarea
      let textNode = ea?.firstChild
      let loop = state.loop, start = state.clipStart, end = state.clipEnd

      if (!ea || !textNode || !loop || start == null || end == null || start >= end) {
        if (hasAPI) highlight.clear()
        if (overlay) overlay.style.display = 'none'
        return
      }

      let content = textNode.textContent
      let rawStart = cleanToRaw(content, start)
      let rawEnd = cleanToRaw(content, end)

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
          root.querySelector('.container')?.appendChild(overlay)
        }
        let range = new Range()
        range.setStart(textNode, Math.min(rawStart, content.length))
        range.setEnd(textNode, Math.min(rawEnd, content.length))
        let rects = range.getClientRects()
        if (rects.length) {
          let eaRect = ea.getBoundingClientRect()
          let r = rects[0]
          overlay.style.cssText = `display:block;position:absolute;background:${color};pointer-events:none;z-index:1;left:${r.left - eaRect.left}px;top:${r.top - eaRect.top}px;width:${r.width}px;height:${r.height}px`
        }
      }
    })

    return () => {
      off()
      if (hasAPI) CSS.highlights.delete(name)
      if (overlay) overlay.remove()
      css.remove()
    }
  }
}
