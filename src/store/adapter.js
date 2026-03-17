// Store helpers shared across adapters

const FILES_LIMIT = 10

/**
 * Sort file metadata array
 */
export function sortFiles(files, { sortBy = 'date', order = 'desc' } = {}) {
  return [...files].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'name': cmp = a.name.localeCompare(b.name); break
      case 'size': cmp = a.size - b.size; break
      case 'type': cmp = (a.type || '').localeCompare(b.type || ''); break
      case 'date': default: cmp = a.timestamp - b.timestamp;
    }
    return order === 'desc' ? -cmp : cmp;
  });
}

/**
 * Sanitize filename for use as storage key
 */
export function sanitizeFilename(filename) {
  return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
}

/**
 * Update metadata list: dedupe by name, prepend, limit
 */
export function updateFileList(files, meta) {
  files = files.filter(f => f.name !== meta.name)
  files.unshift(meta)
  return files.slice(0, FILES_LIMIT)
}

/**
 * Build file metadata object
 */
export function fileMeta(file, fileId, extra = {}) {
  return { id: fileId, name: file.name || 'Untitled', timestamp: Date.now(), size: file.size, type: file.type, ...extra }
}
