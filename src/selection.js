
export const selection = {
  // get normalized selection within editarea
  get() {
    let s = window.getSelection()
    if (!s.rangeCount) return

    let editarea = document.querySelector('#editarea')
    let node = s.anchorNode

    // selection must be inside editarea
    if (!node || !editarea.contains(node)) return

    let range = s.getRangeAt(0)
    let start = cleanOffset(range.startContainer, range.startOffset, editarea)
    let end = cleanOffset(range.endContainer, range.endOffset, editarea)

    // swap if backwards
    if (start > end) [start, end] = [end, start]

    return { start, end, collapsed: s.isCollapsed, range }
  },

  // set selection by clean offsets (excluding combining marks)
  set(start, end) {
    let s = window.getSelection()

    start = Math.max(0, start)
    if (end == null) end = start

    let editarea = document.querySelector('#editarea')
    let textNode = editarea.firstChild
    if (!textNode) return { start, end, collapsed: start === end, range: null }

    let rawStart = cleanToRaw(textNode.textContent, start)
    let rawEnd = cleanToRaw(textNode.textContent, end)

    // skip if already at correct position
    if (s.rangeCount) {
      let cur = s.getRangeAt(0)
      if (cur.startContainer === textNode && cur.startOffset === rawStart &&
          cur.endContainer === textNode && cur.endOffset === rawEnd) {
        return { start, end, collapsed: start === end, range: cur }
      }
    }

    // Safari doesn't support reusing range
    s.removeAllRanges()
    let range = new Range()
    range.setStart(textNode, rawStart)
    range.setEnd(textNode, rawEnd)
    s.addRange(range)

    return { start, end, collapsed: start === end, range: s.getRangeAt(0) }
  }
}

// convert raw (node, offset) to clean offset (excluding combining marks)
function cleanOffset(node, rawOffset, editarea) {
  // if node is the editarea element itself, rawOffset is child index (not char offset)
  if (node === editarea) {
    // child index 0 = before first child = position 0
    // child index >= childNodes.length = after last child = end of text
    if (rawOffset === 0) return 0
    let textNode = editarea.firstChild
    return textNode ? cleanText(textNode.textContent).length : 0
  }
  return cleanText(node.textContent.slice(0, rawOffset)).length
}

// convert clean offset to raw offset (including combining marks)
function cleanToRaw(content, cleanPos) {
  let clean = 0, raw = 0
  while (clean < cleanPos && raw < content.length) {
    if (content[raw] < '\u0300') clean++
    raw++
    // skip combining marks after this character
    while (raw < content.length && content[raw] >= '\u0300') raw++
  }
  return raw
}

// return text with combining marks removed
export function cleanText(str) {
  return str.replace(/[\u0300\u0301]/g, '')
}
