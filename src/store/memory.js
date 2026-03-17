// In-memory storage adapter — no persistence
// Useful for: testing, demos, embedded mode

import { sortFiles, sanitizeFilename, updateFileList, fileMeta } from './adapter.js';

export class MemoryAdapter {
  constructor() { this.files = new Map(); this.metadata = [] }

  async init() {}

  async getFiles(opts = {}) { return sortFiles([...this.metadata], opts) }

  async getFile(id) {
    let d = this.files.get(id)
    if (!d) throw Object.assign(Error('Not found: ' + id), { name: 'NotFoundError' })
    return new File([d.blob], d.name || 'audio', { type: d.type || '' })
  }

  async hasFile(id) { return this.files.has(id) }

  async addFile(file, extra = {}) {
    let id = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`
    this.files.set(id, { blob: file, name: file.name, type: file.type })
    this.metadata = updateFileList(this.metadata, fileMeta(file, id, extra))
    return id
  }

  async updateFile(id, file, extra = {}) {
    this.files.set(id, { blob: file, name: file.name, type: file.type })
    let i = this.metadata.findIndex(f => f.id === id)
    if (i !== -1) this.metadata[i] = { ...this.metadata[i], size: file.size, type: file.type, ...extra, modified: Date.now() }
  }

  async deleteFile(id) { this.files.delete(id); this.metadata = this.metadata.filter(f => f.id !== id) }

  async clearAll() { this.files.clear(); this.metadata = [] }

  async getStoreInfo() {
    let usage = 0; for (let { blob } of this.files.values()) usage += blob.size || 0
    return { usage, quota: Infinity, usagePercent: '0.00' }
  }
}
