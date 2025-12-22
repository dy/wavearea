
export const selection = {
  // get normalized selection
  get() {
    let s = window.getSelection()

    // return unknown selection
    if (!s.anchorNode || !s.anchorNode.parentNode.closest('.editarea')) return

    // collect start/end offsets
    let start = absOffset(s.anchorNode, s.anchorOffset), end = absOffset(s.focusNode, s.focusOffset)

    // swap selection direction
    let startNode = s.anchorNode.parentNode.closest('.segment'), startNodeOffset = s.anchorOffset,
      endNode = s.focusNode.parentNode.closest('.segment'), endNodeOffset = s.focusOffset;
    if (start > end) {
      [end, endNode, endNodeOffset, start, startNode, startNodeOffset] =
        [start, startNode, startNodeOffset, end, endNode, endNodeOffset]
    }

    return {
      start,
      startNode,
      startNodeOffset,
      end,
      endNode,
      endNodeOffset,
      collapsed: s.isCollapsed,
      range: s.getRangeAt(0)
    }
  },

  /**
   * Set normalized selection
   * @param {number | Array} start – absolute offset (excluding modifier chars) or relative offset [node, offset]
   * @param {number | Array} end – absolute offset (excluding modifier chars) or relative offset [node, offset]
   * @returns {start, , end}
   */
  set(start, end) {
    let s = window.getSelection()

    if (Array.isArray(start)) start = absOffset(...start)
    if (Array.isArray(end)) end = absOffset(...end)

    // start/end must be within limits
    start = Math.max(0, start)
    if (end == null) end = start

    // find start/end nodes
    let editarea = document.querySelector('.editarea')
    let [startNode, startNodeOffset] = relOffset(editarea, start)
    let [endNode, endNodeOffset] = relOffset(editarea, end)

    let currentRange = s.getRangeAt(0)
    if (
      !(currentRange.startContainer === startNode.firstChild && currentRange.startOffset === startNodeOffset) &&
      !(currentRange.endContainer === endNode.firstChild && currentRange.endOffset === endNodeOffset)
    ) {
      // NOTE: Safari doesn't support reusing range
      s.removeAllRanges()
      let range = new Range()
      range.setStart(startNode.firstChild, startNodeOffset)
      range.setEnd(endNode.firstChild, endNodeOffset)
      s.addRange(range)
    }

    return {
      start, startNode, end, endNode,
      startNodeOffset, endNodeOffset,
      collapsed: s.isCollapsed,
      range: s.getRangeAt(0)
    }
  }
}

// calculate absolute offset from relative pair
function absOffset(node, relOffset) {
  let prevNode = node.parentNode.closest('.segment')
  let offset = cleanText(prevNode.textContent.slice(0, relOffset)).length
  while (prevNode = prevNode.previousSibling) offset += cleanText(prevNode.textContent).length
  return offset
}

// calculate node and relative offset from absolute offset
function relOffset(editarea, offset) {
  let node = editarea.firstChild, len
  // discount previous nodes
  while (offset > (len = cleanText(node.textContent).length)) {
    offset -= len, node = node.nextSibling
  }
  // convert current node to relative offset
  let skip = 0
  for (let content = node.textContent, i = 0; i < offset; i++) {
    while (content[i + skip] >= '\u0300') skip++
  }
  return [node, offset + skip]
}

// return clean from modifiers text
export function cleanText(str) {
  return str.replace(/\u0300|\u0301/g, '')
}
