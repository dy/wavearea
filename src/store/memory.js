// In-memory storage adapter — no persistence
// Useful for: testing, demos, embedded mode, SSR

import { StoreAdapter, sortFiles, sanitizeFilename } from './adapter.js';

export class MemoryAdapter extends StoreAdapter {
  constructor() {
    super();
    this.files = new Map();  // id → { blob, name, type }
    this.metadata = [];      // [{id, name, timestamp, size, type, ...}]
  }

  async init() {}

  async getFiles(options = {}) {
    return sortFiles([...this.metadata], options);
  }

  async getFile(fileId) {
    let data = this.files.get(fileId);
    if (!data) throw Object.assign(Error('File not found: ' + fileId), { name: 'NotFoundError' });
    return new File([data.blob], data.name || 'audio', { type: data.type || '' });
  }

  async hasFile(fileId) {
    return this.files.has(fileId);
  }

  async addFile(file, metadata = {}) {
    let fileId = `${Date.now()}-${sanitizeFilename(file.name || 'audio')}`;
    let timestamp = Date.now();

    this.files.set(fileId, { blob: file, name: file.name, type: file.type });

    let meta = { id: fileId, name: file.name || 'Untitled', timestamp, size: file.size, type: file.type, ...metadata };
    this.metadata = this.metadata.filter(f => f.name !== meta.name);
    this.metadata.unshift(meta);
    this.metadata = this.metadata.slice(0, 10);

    return fileId;
  }

  async updateFile(fileId, file, metadata = {}) {
    if (!this.files.has(fileId)) throw Error('File not found: ' + fileId);
    this.files.set(fileId, { blob: file, name: file.name, type: file.type });

    let idx = this.metadata.findIndex(f => f.id === fileId);
    if (idx !== -1) {
      this.metadata[idx] = { ...this.metadata[idx], size: file.size, type: file.type, ...metadata, modified: Date.now() };
    }
  }

  async deleteFile(fileId) {
    this.files.delete(fileId);
    this.metadata = this.metadata.filter(f => f.id !== fileId);
  }

  async clearAll() {
    this.files.clear();
    this.metadata = [];
  }

  async getStoreInfo() {
    let usage = 0;
    for (let { blob } of this.files.values()) usage += blob.size || 0;
    return { usage, quota: Infinity, usagePercent: '0.00' };
  }
}
