
export function createSelection(getEl) {
  return {
    get() {
      let s = window.getSelection()
      if (!s.rangeCount) return

      let el = getEl()
      if (!el) return
      let node = s.anchorNode
      if (!node || !el.contains(node)) return

      let range = s.getRangeAt(0)
      let start = cleanOffset(range.startContainer, range.startOffset, el)
      let end = cleanOffset(range.endContainer, range.endOffset, el)
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

      let rawStart = cleanToRaw(textNode.textContent, start)
      let rawEnd = cleanToRaw(textNode.textContent, end)

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

export function cleanToRaw(content, cleanPos) {
  let clean = 0, raw = 0
  while (clean < cleanPos && raw < content.length) {
    if (content[raw] < '\u0300') clean++
    raw++
    while (raw < content.length && content[raw] >= '\u0300') raw++
  }
  return raw
}

export function cleanText(str) {
  return str.replace(/[\u0300\u0301]/g, '')
}
