// Smooth caret layer — replaces native caret with animated one
// Blinks in editing mode, smooth transition during playback,
// follows selection endpoint during drag

export default function smoothCaret(opts = {}) {
  let { width = 1, color = 'currentColor', hideNative = true, transition = '20ms linear' } = opts

  return (state, root) => {
    // inject styles: blink animation + hide native caret
    let css = document.createElement('style')
    css.textContent = `
      @keyframes caret-blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
      @keyframes caret-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .2 } }
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

    let raf = null
    let lineH = 20
    let prevX = 0, prevY = 0

    let poll = () => {
      let ea = state.refs?.editarea
      if (ea) lineH = parseFloat(getComputedStyle(ea).lineHeight) || 20

      let x = state.caretX, y = state.caretY

      // during mouse drag, read live selection endpoint (state doesn't update until mouseup)
      if (state.isMouseDown && ea) {
        let s = window.getSelection()
        if (s.rangeCount) {
          // use focus end of selection (where the mouse is)
          let r = document.createRange()
          r.setStart(s.focusNode, s.focusOffset)
          r.collapse(true)
          let rects = r.getClientRects()
          let rect = rects[0]
          if (rect) { x = rect.right; y = rect.top }
        }
      }

      if (x > 0 || y > 0) {
        let yChanged = Math.abs(y - prevY) > 2
        let moved = x !== prevX || yChanged
        caret.style.transition = state.playing && !yChanged ? `transform ${transition}` : 'none'
        caret.style.height = lineH + 'px'
        caret.style.transform = `translate(${x}px, ${y}px)`
        caret.style.opacity = '1'

        if (state.playing) {
          caret.style.animation = 'none'
        } else if (moved) {
          // restart blink cycle on move — visible immediately at new position
          caret.style.animation = 'none'
          caret.offsetHeight // force reflow to reset animation
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

      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      caret.remove()
      css.remove()
    }
  }
}
