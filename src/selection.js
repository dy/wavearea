
// Selection over a virtualized waveform: the editarea text node holds only a
// window of the document; getBase() gives the window's starting block offset.
export function createSelection(getEl, getBase = () => 0) {
  return {
    get() {
      let s = window.getSelection()
      if (!s.rangeCount) return

      let el = getEl()
      if (!el) return
      let node = s.anchorNode
      if (!node || !el.contains(node)) return

      let base = getBase()
      let range = s.getRangeAt(0)
      // an endpoint dragged outside the waveform clamps to the near edge
      let edge = (node, before) => before ? 0 : cleanText(el.firstChild?.textContent ?? '').length
      let side = (node, off) => el.contains(node)
        ? cleanOffset(node, off, el)
        : edge(node, node.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      let start = base + side(range.startContainer, range.startOffset)
      let end = base + side(range.endContainer, range.endOffset)
      if (start > end) [start, end] = [end, start]

      return { start, end, collapsed: s.isCollapsed, range }
    },

    set(start, end) {
      let s = window.getSelection()
      start = Math.max(0, start)
      if (end == null) end = start

      let el = getEl()
      let textNode = el?.firstChild
      if (!textNode) return { start, end, collapsed: start === end, range: null }

      // clamp into the rendered window
      let base = getBase()
      let rawStart = cleanToRaw(textNode.textContent, Math.max(0, start - base))
      let rawEnd = cleanToRaw(textNode.textContent, Math.max(0, end - base))

      if (s.rangeCount) {
        let cur = s.getRangeAt(0)
        if (cur.startContainer === textNode && cur.startOffset === rawStart &&
            cur.endContainer === textNode && cur.endOffset === rawEnd) {
          return { start, end, collapsed: start === end, range: cur }
        }
      }

      if (start === end) {
        s.collapse(textNode, rawStart)
      } else {
        s.removeAllRanges()
        let range = new Range()
        range.setStart(textNode, rawStart)
        range.setEnd(textNode, rawEnd)
        s.addRange(range)
      }

      return { start, end, collapsed: start === end, range: s.rangeCount ? s.getRangeAt(0) : null }
    }
  }
}

function cleanOffset(node, rawOffset, el) {
  if (node === el) return rawOffset === 0 ? 0 : cleanText(el.firstChild?.textContent ?? '').length
  return cleanText(node.textContent.slice(0, rawOffset)).length
}

// a block char is a wavefont glyph U+0100–U+0180; combining marks (U+0300/0301)
// and segment breaks ('\n') take no block offset
export const isBlock = c => c >= '\u0100' && c < '\u0300'

export function cleanToRaw(content, cleanPos) {
  let clean = 0, raw = 0
  while (clean < cleanPos && raw < content.length) {
    if (isBlock(content[raw])) clean++
    raw++
    while (raw < content.length && !isBlock(content[raw])) raw++
  }
  return raw
}

export function cleanText(str) {
  return str.replace(/[\u0300\u0301\n]/g, '')
}
