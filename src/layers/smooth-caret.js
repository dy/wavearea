// Smooth caret layer — replaces native caret with animated one
// Uses sprae effect() for reactive updates instead of rAF polling

import { effect } from 'sprae'

export default function smoothCaret(opts = {}) {
  let { width = 1, color = 'currentColor', hideNative = true, transition = '20ms linear' } = opts

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
      position: fixed;
      width: ${width}px;
      background: ${color};
      pointer-events: none;
      z-index: 10;
      opacity: 0;
      will-change: transform;
      top: 0; left: 0;
    `
    document.body.appendChild(caret)

    let lineH = 0
    let prevX = 0, prevY = 0
    let dragRaf = null

    // reactive: runs when caretX, caretY, playing change
    let off = effect(() => {
      let ea = state.refs?.editarea
      if (ea && !lineH) lineH = parseFloat(getComputedStyle(ea).lineHeight) || 20

      let x = state.caretX, y = state.caretY
      let playing = state.playing

      if (x > 0 || y > 0) {
        let yChanged = Math.abs(y - prevY) > 2
        let moved = x !== prevX || yChanged
        caret.style.transition = playing && !yChanged ? `transform ${transition}` : 'none'
        caret.style.height = lineH + 'px'
        caret.style.transform = `translate(${x}px, ${y}px)`
        caret.style.opacity = '1'

        if (playing) {
          caret.style.animation = 'none'
        } else if (moved) {
          caret.style.animation = 'none'
          caret.offsetHeight
          caret.style.animation = 'caret-blink 1024ms step-end infinite'
        }

        prevX = x; prevY = y
      } else {
        caret.style.opacity = '0'
      }

      // sync CSS vars for #caret-line
      let container = state.refs?.container
      if (container && ea) {
        let eaRect = ea.getBoundingClientRect()
        container.style.setProperty('--caretx', (x - eaRect.left) + 'px')
        container.style.setProperty('--carety', (y - eaRect.top) + 'px')
      }
    })

    // drag tracking needs rAF since selection changes aren't reactive
    let dragPoll = () => {
      if (!state.isMouseDown) { dragRaf = null; return }
      let ea = state.refs?.editarea
      if (ea) {
        let s = window.getSelection()
        if (s.rangeCount) {
          let r = document.createRange()
          r.setStart(s.focusNode, s.focusOffset)
          r.collapse(true)
          let rects = r.getClientRects()
          let rect = rects[0]
          if (rect) {
            caret.style.transition = 'none'
            caret.style.transform = `translate(${rect.right}px, ${rect.top}px)`
            caret.style.opacity = '1'
          }
        }
      }
      dragRaf = requestAnimationFrame(dragPoll)
    }

    // watch isMouseDown to start/stop drag polling
    let offDrag = effect(() => {
      if (state.isMouseDown) {
        if (!dragRaf) dragRaf = requestAnimationFrame(dragPoll)
      }
    })

    return () => {
      off()
      offDrag()
      if (dragRaf) cancelAnimationFrame(dragRaf)
      caret.remove()
      css.remove()
    }
  }
}
