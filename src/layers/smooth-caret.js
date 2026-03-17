// Smooth caret layer — replaces native caret with animated one
// Positions absolutely within the shared overlay container

import { effect } from 'sprae'

export default function smoothCaret(opts = {}) {
  let { width = 1, color = 'currentColor', hideNative = true } = opts

  return (state, root) => {
    let css = document.createElement('style')
    css.textContent = `
      @keyframes caret-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      ${hideNative ? '#editarea { caret-color: transparent; }' : ''}
    `
    root.appendChild(css)

    let caret = document.createElement('div')
    caret.className = 'smooth-caret'
    caret.style.cssText = `
      position: absolute;
      width: ${width}px;
      background: ${color};
      pointer-events: none;
      z-index: 10;
      opacity: 0;
      will-change: transform;
      top: 0; left: 0;
    `

    // get or create overlay container (shared by all layers, 1:1 over editarea)
    let getOverlay = () => {
      let ea = state.refs?.editarea
      if (!ea) return null
      let ov = ea.parentElement?.querySelector('.wavearea-overlay')
      if (!ov) {
        ov = document.createElement('div')
        ov.className = 'wavearea-overlay'
        ov.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;'
        // insert overlay right after editarea
        ea.after(ov)
      }
      if (!ov.contains(caret)) ov.appendChild(caret)
      return ov
    }

    let lineH = 0, prevX = 0, prevY = 0, prevTime = 0, dragRaf = null

    let position = (x, y, smooth) => {
      let ea = state.refs?.editarea
      if (!ea || !getOverlay()) return
      if (!lineH) lineH = parseFloat(getComputedStyle(ea).lineHeight) || 20

      // convert viewport coords to editarea-relative
      let eaRect = ea.getBoundingClientRect()
      let lx = x - eaRect.left, ly = y - eaRect.top

      if (x <= 0 && y <= 0) { caret.style.opacity = '0'; return }

      let yChanged = Math.abs(ly - prevY) > 2
      let moved = lx !== prevX || yChanged
      // during playback: use transition that bridges to next expected update
      // during idle: snap instantly
      let now = performance.now()
      let dt = now - prevTime
      prevTime = now
      // estimate next update interval from last interval, clamp to sane range
      let dur = smooth && !yChanged ? Math.min(Math.max(dt, 16), 500) : 0
      caret.style.transition = dur ? `transform ${dur}ms linear` : 'none'
      caret.style.height = lineH + 'px'
      caret.style.transform = `translate(${lx}px, ${ly}px)`
      caret.style.opacity = '1'

      if (state.playing) {
        caret.style.animation = 'none'
      } else if (moved) {
        caret.style.animation = 'none'
        caret.offsetHeight
        caret.style.animation = 'caret-blink 1024ms step-end infinite'
      }
      prevX = lx; prevY = ly

      // sync CSS vars for #caret-line
      let container = state.refs?.container
      if (container) {
        container.style.setProperty('--caretx', lx + 'px')
        container.style.setProperty('--carety', ly + 'px')
      }
    }

    let off = effect(() => position(state.caretX, state.caretY, state.playing))

    let dragPoll = () => {
      if (!state.isMouseDown) { dragRaf = null; return }
      let s = window.getSelection()
      if (s.rangeCount) {
        let r = document.createRange()
        r.setStart(s.focusNode, s.focusOffset)
        r.collapse(true)
        let rects = r.getClientRects()
        let rect = rects[0]
        if (rect) position(rect.right, rect.top, false)
      }
      dragRaf = requestAnimationFrame(dragPoll)
    }
    let offDrag = effect(() => {
      if (state.isMouseDown && !dragRaf) dragRaf = requestAnimationFrame(dragPoll)
    })

    return () => {
      off(); offDrag()
      if (dragRaf) cancelAnimationFrame(dragRaf)
      caret.remove(); css.remove()
    }
  }
}
